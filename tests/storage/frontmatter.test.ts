import { describe, expect, it } from 'vitest';
import { parseFrontmatter, stringifyFrontmatter } from '@/lib/storage/frontmatter';

describe('frontmatter helpers', () => {
  it('parses markdown frontmatter and content', () => {
    const source = `---
type: daily_review
title: 测试复盘
date: 2026-06-12
---

## 一、市场环境
内容`;
    const result = parseFrontmatter(source);

    expect(result.frontmatter.type).toBe('daily_review');
    expect(result.frontmatter.title).toBe('测试复盘');
    expect(result.content).toContain('市场环境');
  });

  it('stringifies frontmatter and body', () => {
    const output = stringifyFrontmatter(
      {
        type: 'daily_review',
        title: '测试复盘',
        date: '2026-06-12',
      },
      '# 标题',
    );

    expect(output).toContain('title: 测试复盘');
    expect(output).toContain('# 标题');
  });
});
