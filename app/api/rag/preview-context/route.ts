import { NextResponse } from 'next/server';
import { z } from 'zod';
import { retrieveRelevantChunks } from '@/lib/rag/retrieve';
import { routeQuerySource } from '@/lib/rag/source-router';
import { getDocumentTypeLabel } from '@/lib/utils/display';

const requestSchema = z.object({
  query: z.string().min(1),
  topK: z.number().min(1).max(20).default(8),
});

export async function POST(request: Request) {
  try {
    const { query, topK } = requestSchema.parse(await request.json());

    // 走完整检索管线（同 QA 系统）
    const route = await routeQuerySource(query);
    const searchQuery = route.rewrittenQuery || query;
    const hits = await retrieveRelevantChunks({
      query: searchQuery,
      topK,
      sourceBoosts: Object.keys(route.docTypeBoosts).length > 0 ? route.docTypeBoosts : undefined,
      weights: route.weights,
      mmrLambda: 0.7,
    });

    // 模拟 prompt 上下文组装（同 QA 系统）
    const contextChunks = hits.map((hit, i) => {
      const type = getDocumentTypeLabel(hit.chunk.docType);
      const heading = hit.chunk.headingPath.join(' > ') || '正文';
      const date = hit.chunk.date ? ` (${hit.chunk.date})` : '';
      return {
        rank: i + 1,
        chunkId: hit.chunk.id,
        docId: hit.chunk.docId,
        title: hit.chunk.title,
        docType: hit.chunk.docType,
        heading,
        date: hit.chunk.date,
        score: hit.finalScore,
        contextLine: `[${i + 1}] ${hit.chunk.title} [${type}${date}] [${heading}]\n${hit.chunk.content}`,
      };
    });

    const contextText = contextChunks.map((c) => c.contextLine).join('\n\n');

    // 统计信息
    const totalChars = contextText.length;
    const estimatedTokens = Math.round(totalChars * 0.4); // 中文估算

    return NextResponse.json({
      ok: true,
      data: {
        query,
        rewrittenQuery: searchQuery,
        intent: route.intent,
        totalCandidates: hits.length,
        contextChunks,
        contextText,
        stats: {
          totalChars,
          estimatedTokens,
          chunkCount: contextChunks.length,
        },
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: error.flatten() }, { status: 400 });
    }
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
