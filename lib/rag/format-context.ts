import type { RagSearchHit } from '@/lib/rag/types';

export function formatRetrievedContext(items: RagSearchHit[]): string {
  if (!items.length) {
    return '无';
  }

  return items
    .map((item, index) => {
      const heading =
        item.chunk.headingPath.length > 0 ? item.chunk.headingPath.join(' > ') : '正文';

      return [
        `${index + 1}. 标题: ${item.chunk.title}`,
        `类型: ${item.chunk.docType}`,
        `路径: ${heading}`,
        `日期: ${item.chunk.date ?? '未知'}`,
        `摘要片段: ${item.chunk.content.slice(0, 240)}`,
      ].join('\n');
    })
    .join('\n\n');
}
