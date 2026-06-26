/**
 * 原始资料自动归档 —— 不可变证据层。
 * 每次 AI 生成或文档保存时，将用户提供的原始输入快照到 data/raw/ 下。
 */

import path from 'node:path';
import { writeMarkdownDocument } from '@/lib/storage/md-store';
import { DATA_DIRECTORIES, ensureProjectDirectories } from '@/lib/storage/paths';
import { slugify } from '@/lib/storage/slug';
import type { DocumentFrontmatter } from '@/lib/types/document';

export interface ViewpointRawInput {
  author: string;
  platform: string;
  date: string;
  source?: string;
  rawText: string;
}

export interface ReviewRawInput {
  date: string;
  marketSummary: string;
  sectorPerformance: string;
  newsCatalysts: string;
  personalObservation: string;
}

export interface ThemeRawInput {
  themeName: string;
  rawMaterials: string;
  personalObservation: string;
}

export interface StockRawInput {
  stockName: string;
  themes: string[];
  companyInfo: string;
  announcements: string;
  news: string;
  viewpointSummary: string;
  personalObservation: string;
}

/** 归档关注人观点原始发言 */
export async function archiveViewpointRaw(input: ViewpointRawInput): Promise<string> {
  await ensureProjectDirectories();
  const timestamp = new Date().toISOString();
  const fileSlug = slugify(`${input.date}-${input.author}-raw-${Date.now().toString(36)}`);
  const absolutePath = path.join(DATA_DIRECTORIES.rawPosts, `${fileSlug}.md`);

  const frontmatter: DocumentFrontmatter = {
    type: 'raw',
    title: `${input.author}原始发言`,
    date: input.date,
    author: input.author,
    platform: input.platform,
    source: input.source?.trim() || undefined,
    tags: ['原始发言', input.author, input.platform],
    created_at: timestamp,
  };

  const content = [
    `# ${input.author} 原始发言`,
    '',
    `- **作者**：${input.author}`,
    `- **平台**：${input.platform}`,
    `- **日期**：${input.date}`,
    input.source ? `- **来源**：${input.source}` : '',
    `- **归档时间**：${timestamp}`,
    '',
    '## 原始内容',
    '',
    input.rawText.trim(),
  ].join('\n');

  await writeMarkdownDocument({ absolutePath, frontmatter, content });
  return absolutePath;
}

/** 归档每日复盘原始输入 */
export async function archiveReviewRaw(input: ReviewRawInput): Promise<string> {
  await ensureProjectDirectories();
  const timestamp = new Date().toISOString();
  const fileSlug = slugify(`${input.date}-review-input-${Date.now().toString(36)}`);
  const absolutePath = path.join(DATA_DIRECTORIES.rawMarket, `${fileSlug}.md`);

  const frontmatter: DocumentFrontmatter = {
    type: 'raw',
    title: `${input.date} 复盘原始输入`,
    date: input.date,
    tags: ['复盘输入', '市场摘要'],
    created_at: timestamp,
  };

  const content = [
    `# ${input.date} 复盘原始输入`,
    '',
    `- **日期**：${input.date}`,
    `- **归档时间**：${timestamp}`,
    '',
    '## 市场摘要',
    '',
    input.marketSummary.trim() || '（未提供）',
    '',
    '## 板块表现',
    '',
    input.sectorPerformance.trim() || '（未提供）',
    '',
    '## 新闻催化',
    '',
    input.newsCatalysts.trim() || '（未提供）',
    '',
    '## 个人观察',
    '',
    input.personalObservation.trim() || '（未提供）',
  ].join('\n');

  await writeMarkdownDocument({ absolutePath, frontmatter, content });
  return absolutePath;
}

/** 归档主题研究原始资料 */
export async function archiveThemeRaw(input: ThemeRawInput): Promise<string> {
  await ensureProjectDirectories();
  const timestamp = new Date().toISOString();
  const fileSlug = slugify(`${input.themeName}-materials-${Date.now().toString(36)}`);
  const absolutePath = path.join(DATA_DIRECTORIES.rawPosts, `${fileSlug}.md`);

  const frontmatter: DocumentFrontmatter = {
    type: 'raw',
    title: `${input.themeName} 研究资料`,
    themes: [input.themeName],
    tags: ['研究资料', input.themeName],
    created_at: timestamp,
  };

  const content = [
    `# ${input.themeName} 研究原始资料`,
    '',
    `- **主题**：${input.themeName}`,
    `- **归档时间**：${timestamp}`,
    '',
    '## 原始资料',
    '',
    input.rawMaterials.trim() || '（未提供）',
    '',
    '## 个人观察',
    '',
    input.personalObservation.trim() || '（未提供）',
  ].join('\n');

  await writeMarkdownDocument({ absolutePath, frontmatter, content });
  return absolutePath;
}

/** 归档个股研究原始资料 */
export async function archiveStockRaw(input: StockRawInput): Promise<string> {
  await ensureProjectDirectories();
  const timestamp = new Date().toISOString();
  const fileSlug = slugify(`${input.stockName}-materials-${Date.now().toString(36)}`);
  const absolutePath = path.join(DATA_DIRECTORIES.rawPosts, `${fileSlug}.md`);

  const frontmatter: DocumentFrontmatter = {
    type: 'raw',
    title: `${input.stockName} 研究资料`,
    themes: input.themes,
    tags: ['研究资料', input.stockName, ...input.themes],
    created_at: timestamp,
  };

  const content = [
    `# ${input.stockName} 研究原始资料`,
    '',
    `- **公司**：${input.stockName}`,
    `- **关联主题**：${input.themes.length ? input.themes.join('、') : '未指定'}`,
    `- **归档时间**：${timestamp}`,
    '',
    '## 公司资料',
    '',
    input.companyInfo.trim() || '（未提供）',
    '',
    '## 公告信息',
    '',
    input.announcements.trim() || '（未提供）',
    '',
    '## 新闻信息',
    '',
    input.news.trim() || '（未提供）',
    '',
    '## 关注人观点汇总',
    '',
    input.viewpointSummary.trim() || '（未提供）',
    '',
    '## 个人观察',
    '',
    input.personalObservation.trim() || '（未提供）',
  ].join('\n');

  await writeMarkdownDocument({ absolutePath, frontmatter, content });
  return absolutePath;
}
