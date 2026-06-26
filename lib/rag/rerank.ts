/**
 * DeepSeek 重排序。
 *
 * 将 top 30 候选发给 DeepSeek，让模型判断每个候选与问题的相关性（0-10分），
 * 按得分降序输出。比单纯排序更鲁棒，且得分可用于分析。
 */
import { getDeepSeekConfig } from '@/lib/ai/model';
import type { RagSearchHit } from '@/lib/rag/types';

export async function rerankHits(
  query: string,
  hits: RagSearchHit[],
): Promise<RagSearchHit[]> {
  if (hits.length <= 1) return hits;

  const candidates = hits.slice(0, 30);
  const topK = Math.min(8, hits.length);

  try {
    const config = getDeepSeekConfig();

    const candidateText = candidates
      .map((h, i) => `[${i}] ${h.chunk.title}\n${h.chunk.content.slice(0, 200)}`)
      .join('\n\n');

    const res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        temperature: 0,
        max_tokens: 200,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: [
              '你是 A 股投研 RAG 重排序助手。根据问题判断每个候选段落的相关性。',
              '评分标准：',
              '- 10-8分: 内容直接回答问题，包含关键事实或数据',
              '- 7-5分: 内容部分相关，提供背景或辅助信息',
              '- 4-1分: 内容边缘相关，仅提及相同主题',
              '- 0分: 不相关或重复内容',
              '注意事项：',
              '- 优先保留有具体数据、事实和引用的段落',
              '- 对同一文档的多个段落，只保留得分最高的一个（避免重复）',
              '- 确保答案多样性：尽可能覆盖不同来源',
              '只输出 JSON。',
            ].join('\n'),
          },
          {
            role: 'user',
            content: `问题: ${query}\n\n候选段落:\n${candidateText}\n\n为每个候选段落打分（0-10）并输出得分最高的 top ${topK} 的索引，按得分降序排列。输出 JSON: { "ranked": [得分最高的索引, ...], "scores": { "0": 8, "1": 3, ... } }。`,
          },
        ],
      }),
    });

    if (!res.ok) return hits;

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content ?? '';
    const json = content.match(/\{[\s\S]*\}/)?.[0];
    if (!json) return hits;

    const parsed = JSON.parse(json);
    const ranked = parsed.ranked;
    if (!Array.isArray(ranked) || ranked.length === 0) return hits;

    return ranked
      .map((idx: number) => candidates[idx])
      .filter(Boolean)
      .slice(0, topK);
  } catch {
    return hits;
  }
}
