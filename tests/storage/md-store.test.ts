import { mkdtemp, mkdir, rm, writeFile, access } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  listMarkdownPaths,
  readMarkdownDocument,
  writeMarkdownDocument,
  deleteMarkdownDocument,
} from '@/lib/storage/md-store';

const tempDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirectories.map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
  tempDirectories.length = 0;
});

describe('md-store', () => {
  it('lists markdown files recursively', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'md-store-'));
    tempDirectories.push(directory);
    await mkdir(path.join(directory, 'nested'), { recursive: true });
    await writeFile(
      path.join(directory, 'nested', 'sample.md'),
      '---\ntype: note\ntitle: 示例\n---\n\n内容',
    );

    const items = await listMarkdownPaths(directory);

    expect(items).toHaveLength(1);
    expect(items[0]).toContain('sample.md');
  });

  it('reads markdown document into structured data', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'md-read-'));
    tempDirectories.push(directory);
    const filePath = path.join(directory, 'review.md');
    await writeFile(
      filePath,
      '---\ntype: daily_review\ntitle: 示例复盘\ndate: 2026-06-12\n---\n\n复盘内容',
    );

    const document = await readMarkdownDocument(filePath);

    expect(document.title).toBe('示例复盘');
    expect(document.frontmatter.date).toBe('2026-06-12');
    expect(document.excerpt).toContain('复盘内容');
  });

  it('writes markdown document with frontmatter', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'md-write-'));
    tempDirectories.push(directory);
    const filePath = path.join(directory, 'note.md');

    await writeMarkdownDocument({
      absolutePath: filePath,
      frontmatter: {
        type: 'note',
        title: '测试笔记',
        date: '2026-06-13',
        themes: ['AI算力'],
        stocks: ['300604'],
        tags: ['测试'],
      },
      content: '# 标题\n\n正文内容',
    });

    const document = await readMarkdownDocument(filePath);
    expect(document.title).toBe('测试笔记');
    expect(document.frontmatter.themes).toEqual(['AI算力']);
    expect(document.content).toBe('# 标题\n\n正文内容');
  });

  it('deletes markdown document', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'md-delete-'));
    tempDirectories.push(directory);
    const filePath = path.join(directory, 'to-delete.md');

    await writeMarkdownDocument({
      absolutePath: filePath,
      frontmatter: { type: 'note', title: '待删除' },
      content: '内容',
    });

    // 确认文件存在
    await access(filePath);

    await deleteMarkdownDocument(filePath);

    // 确认文件已删除
    await expect(access(filePath)).rejects.toThrow();
  });

  it('overwrites existing document on write', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'md-overwrite-'));
    tempDirectories.push(directory);
    const filePath = path.join(directory, 'update.md');

    await writeMarkdownDocument({
      absolutePath: filePath,
      frontmatter: { type: 'note', title: '原始标题' },
      content: '原始内容',
    });

    // 覆盖写入
    await writeMarkdownDocument({
      absolutePath: filePath,
      frontmatter: { type: 'note', title: '更新标题' },
      content: '更新内容',
    });

    const document = await readMarkdownDocument(filePath);
    expect(document.title).toBe('更新标题');
    expect(document.content).toBe('更新内容');
  });
});
