import { getDeepSeekConfig, extractJsonObject } from '@/lib/ai/model';

export interface StreamChunk {
  content: string;
  delta: string;
  done: boolean;
  /** 思考过程（reasoning_content） */
  thinking?: string;
}

/**
 * 调用 DeepSeek，开启 stream 模式。逐个产出文本块，最终块 done: true 包含完整文本。
 */
export async function* streamDeepSeekResponse(prompts: {
  system: string;
  user: string;
}): AsyncGenerator<StreamChunk> {
  const config = getDeepSeekConfig();
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.2,
      reasoning_effort: 'max',
      max_tokens: 393216,
      stream: true,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: prompts.system },
        { role: 'user', content: prompts.user },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepSeek 流式请求失败: ${response.status} ${errorText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('无法获取响应流');
  }

  const decoder = new TextDecoder();
  let thinkingContent = '';
  let answerContent = '';
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;

        const data = trimmed.slice(6);
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data) as {
            choices?: Array<{
              delta?: { content?: string; reasoning_content?: string };
            }>;
          };
          const reasoning = parsed.choices?.[0]?.delta?.reasoning_content ?? '';
          const answer = parsed.choices?.[0]?.delta?.content ?? '';

          if (reasoning) {
            thinkingContent += reasoning;
          }
          if (answer) {
            answerContent += answer;
          }

          const delta = reasoning || answer;
          if (delta) {
            yield {
              content: answerContent || thinkingContent,
              delta,
              done: false,
              thinking: thinkingContent,
            };
          }
        } catch {
          // 跳过无法解析的行
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  yield { content: answerContent || thinkingContent, delta: '', done: true, thinking: thinkingContent };
}

/** 流式输出事件类型 */
export type StreamEvent<T> =
  | { type: 'chunk'; content: string; delta: string }
  | { type: 'result'; data: T }
  | { type: 'error'; message: string };

/**
 * 流式调用 AI 并产出结构化结果。
 * 先产出 chunk 事件让前端实时展示思考过程，
 * 流结束后解析 JSON 并产出 result 事件。
 */
export async function collectStreamResult<T>(
  schema: { parse: (data: unknown) => T },
  prompts: { system: string; user: string },
  onChunk: (content: string, delta: string) => void,
): Promise<T> {
  let fullText = '';

  for await (const chunk of streamDeepSeekResponse(prompts)) {
    fullText = chunk.content;

    if (!chunk.done) {
      onChunk(chunk.content, chunk.delta);
    }
  }

  const jsonText = extractJsonObject(fullText);
  return schema.parse(JSON.parse(jsonText));
}
