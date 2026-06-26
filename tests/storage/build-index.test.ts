import { describe, expect, it } from 'vitest';
import { documentToIndexItem } from '@/lib/storage/index-store';
import type { MarkdownDocument } from '@/lib/types/document';

describe('index-store', () => {
  it('normalizes stock and theme fields into index item', () => {
    const document: MarkdownDocument = {
      id: 'viewpoint-demo',
      slug: 'viewpoint-demo',
      title: '观点示例',
      absolutePath: '/tmp/viewpoint-demo.md',
      relativePath: 'data/viewpoints/viewpoint-demo.md',
      frontmatter: {
        type: 'viewpoint',
        title: '观点示例',
        date: '2026-06-12',
        author: '测试作者',
        platform: '雪球',
        mentioned_stocks: ['300604'],
        mentioned_themes: ['半导体设备'],
        tags: ['测试'],
      },
      content: '正文',
      excerpt: '正文摘要',
    };

    const item = documentToIndexItem(document);

    expect(item.stocks).toEqual(['300604']);
    expect(item.themes).toEqual(['半导体设备']);
    expect(item.summary).toBe('正文摘要');
  });
});
