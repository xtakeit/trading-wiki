import { z } from 'zod';
import { streamDeepSeekResponse } from '@/lib/ai/stream';
import { extractJsonObject } from '@/lib/ai/model';
import { normalizeAiOutput } from '@/lib/ai/normalize';
import type { StreamEvent } from '@/lib/ai/stream';

const streamRequestSchema = z.object({
  action: z.enum([
    'extract-viewpoint',
    'generate-review',
    'generate-theme-research',
    'generate-stock-profile',
  ]),
  params: z.record(z.unknown()),
});

/**
 * 通用 SSE 流式 AI 端点。
 * POST body: { action, params }
 * 返回 SSE 事件流：chunk（思考过程）→ result（结构化结果）或 error
 */
export async function POST(request: Request) {
  let input: z.infer<typeof streamRequestSchema>;

  try {
    const json = await request.json();
    input = streamRequestSchema.parse(json);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({ ok: false, error: error.flatten() }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({ ok: false, error: 'Invalid request' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const { action, params } = input;

  // 动态导入各模块的 prompt 和 schema
  const { prompts, schema } = await loadActionModules(action);

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      function emit(event: StreamEvent<unknown>) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }

      let answerText = '';
      let jsonText = '';
      let parsedObj: unknown = null;

      try {
        // 构建 prompt
        const systemPrompt = prompts.system(params as never);
        const userPrompt = prompts.user(params as never);

        for await (const chunk of streamDeepSeekResponse({
          system: systemPrompt,
          user: userPrompt,
        })) {
          // chunk.content = 答案正文，chunk.thinking = 思考过程
          if (chunk.content) answerText = chunk.content;

          if (!chunk.done) {
            emit({ type: 'chunk', content: chunk.thinking || chunk.content, delta: chunk.delta });
          }
        }

        // 解析最终 JSON（从答案正文提取，不含思考过程）
        const strategies = [
          () => extractJsonObject(answerText),
          () => {
            const first = answerText.indexOf('{');
            const last = answerText.lastIndexOf('}');
            if (first >= 0 && last > first) return answerText.slice(first, last + 1);
            throw new Error('no braces');
          },
        ];

        for (const strategy of strategies) {
          try {
            jsonText = strategy();
            JSON.parse(jsonText); // 测试是否合法
            break;
          } catch {
            continue;
          }
        }

        if (!jsonText) {
          emit({ type: 'error', message: `未找到合法 JSON，原文前200字符: ${answerText.slice(0, 200)}` });
          controller.close();
          return;
        }

        parsedObj = JSON.parse(jsonText);

        const normalized = normalizeAiOutput(parsedObj);
        const parsed = schema.parse(normalized);
        emit({ type: 'result', data: parsed });
      } catch (error) {
        if (error instanceof z.ZodError) {
          const issues = error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
          emit({ type: 'error', message: `校验失败: ${issues}` });
        } else {
          const message = error instanceof Error ? error.message : '流式生成失败';
          emit({ type: 'error', message });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

interface ActionModules {
  prompts: {
    system: (params: unknown) => string;
    user: (params: unknown) => string;
  };
  schema: { parse: (data: unknown) => unknown };
}

async function loadActionModules(action: string): Promise<ActionModules> {
  switch (action) {
    case 'extract-viewpoint': {
      const [{ buildExtractViewpointSystemPrompt, buildExtractViewpointUserPrompt }, { viewpointExtractionSchema }] =
        await Promise.all([
          import('@/lib/ai/prompts'),
          import('@/lib/types/viewpoint'),
        ]);
      return {
        prompts: {
          system: () => buildExtractViewpointSystemPrompt(),
          user: (_p: unknown) => buildExtractViewpointUserPrompt(_p as Parameters<typeof buildExtractViewpointUserPrompt>[0]),
        },
        schema: viewpointExtractionSchema,
      };
    }
    case 'generate-review': {
      const [{ buildGenerateReviewSystemPrompt, buildGenerateReviewUserPrompt }, { dailyReviewGenerationSchema }] =
        await Promise.all([
          import('@/lib/ai/prompts'),
          import('@/lib/types/review'),
        ]);
      return {
        prompts: {
          system: () => buildGenerateReviewSystemPrompt(),
          user: (p) => buildGenerateReviewUserPrompt(p as Parameters<typeof buildGenerateReviewUserPrompt>[0]),
        },
        schema: dailyReviewGenerationSchema,
      };
    }
    case 'generate-theme-research': {
      const [{ buildGenerateThemeResearchSystemPrompt, buildGenerateThemeResearchUserPrompt }, { themeResearchGenerationSchema }] =
        await Promise.all([
          import('@/lib/ai/prompts'),
          import('@/lib/types/theme'),
        ]);
      return {
        prompts: {
          system: () => buildGenerateThemeResearchSystemPrompt(),
          user: (p) => buildGenerateThemeResearchUserPrompt(p as Parameters<typeof buildGenerateThemeResearchUserPrompt>[0]),
        },
        schema: themeResearchGenerationSchema,
      };
    }
    case 'generate-stock-profile': {
      const [{ buildGenerateStockProfileSystemPrompt, buildGenerateStockProfileUserPrompt }, { stockProfileGenerationSchema }] =
        await Promise.all([
          import('@/lib/ai/prompts'),
          import('@/lib/types/stock'),
        ]);
      return {
        prompts: {
          system: () => buildGenerateStockProfileSystemPrompt(),
          user: (p) => buildGenerateStockProfileUserPrompt(p as Parameters<typeof buildGenerateStockProfileUserPrompt>[0]),
        },
        schema: stockProfileGenerationSchema,
      };
    }
    default:
      throw new Error(`未知的流式 action: ${action}`);
  }
}
