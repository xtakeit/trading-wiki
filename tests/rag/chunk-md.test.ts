import { describe, expect, it } from 'vitest';
import { chunkMarkdownDocument } from '@/lib/rag/chunk-md';
import type { RagSourceDocument } from '@/lib/rag/types';

describe('chunk markdown document', () => {
  it('keeps heading path and metadata when splitting markdown', () => {
    const document: RagSourceDocument = {
      id: 'viewpoint-2026-06-12-demo',
      slug: 'demo',
      title: '某关注人观点蒸馏',
      absolutePath: '/tmp/demo.md',
      relativePath: 'data/viewpoints/demo.md',
      frontmatter: {
        type: 'viewpoint',
        title: '某关注人观点蒸馏',
        date: '2026-06-12',
        author: '某关注人',
        platform: '雪球',
        mentioned_stocks: ['300604'],
        mentioned_themes: ['半导体设备'],
        tags: ['观点蒸馏'],
      },
      content: `# 某关注人观点蒸馏

## 核心观点
长川科技作为设备链核心标的，当前反馈偏强。半导体设备方向有继续跟踪价值，交易逻辑集中在先进封装扩散和订单预期改善。

## 风险点
若量能无法持续放大，板块强度可能回落。`,
      excerpt: 'demo',
    };

    const chunks = chunkMarkdownDocument(document, {
      minLength: 30,
      maxLength: 120,
    });

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0]?.headingPath).toContain('核心观点');
    expect(chunks[0]?.stocks).toContain('300604');
    expect(chunks[0]?.themes).toContain('半导体设备');
  });
});
