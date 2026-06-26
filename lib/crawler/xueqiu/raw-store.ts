/**
 * 雪球原始帖子存储
 * 写入 data/raw/xueqiu/{userId}/{postId}.md + 去重游标
 */

import path from 'node:path';
import { mkdir, readFile, writeFile, readdir, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import matter from 'gray-matter';
import { DATA_DIRECTORIES, ensureProjectDirectories } from '@/lib/storage/paths';
import { stringifyFrontmatter } from '@/lib/storage/frontmatter';
import type { DocumentFrontmatter } from '@/lib/types/document';
import type { RawPost, CursorData, RawPostMeta } from './types';

/** 某个用户的帖子目录 */
function userDir(userId: string): string {
  return path.join(DATA_DIRECTORIES.rawXueqiu, userId);
}

/** 游标文件路径 */
function cursorPath(userId: string): string {
  return path.join(userDir(userId), '.cursor.json');
}

/** 帖子文件路径 */
function postPath(userId: string, postId: string): string {
  return path.join(userDir(userId), `${postId}.md`);
}

/** 读取游标 */
async function readCursor(userId: string): Promise<CursorData> {
  try {
    const data = await readFile(cursorPath(userId), 'utf8');
    return JSON.parse(data);
  } catch {
    return { lastFetch: '', seenIds: [] };
  }
}

/** 写入游标 */
async function writeCursor(userId: string, data: CursorData): Promise<void> {
  await mkdir(userDir(userId), { recursive: true });
  await writeFile(cursorPath(userId), JSON.stringify(data, null, 2), 'utf8');
}

/** 保存一条原始帖子（去重，已存在的跳过） */
export async function saveRawPost(post: RawPost): Promise<{ saved: boolean; path: string }> {
  await ensureProjectDirectories();

  const cursor = await readCursor(post.userId);

  // 去重
  if (cursor.seenIds.includes(post.id)) {
    return { saved: false, path: postPath(post.userId, post.id) };
  }

  const timestamp = new Date().toISOString();
  const filePath = postPath(post.userId, post.id);

  const frontmatter: DocumentFrontmatter & {
    xueqiu: Record<string, unknown>;
  } = {
    type: 'raw',
    title: `${post.author} · ${post.text.slice(0, 40)}`,
    date: post.createdAt,
    author: post.author,
    platform: '雪球',
    tags: ['雪球', post.userId],
    created_at: timestamp,
    xueqiu: {
      userId: post.userId,
      postId: post.id,
      url: post.url,
      type: post.type,
      isRetweet: post.isRetweet,
      isPinned: post.isPinned,
      status: 'pending',
    },
  };

  const content = [
    `# ${post.author} 雪球发言`,
    '',
    `- **作者**：${post.author}`,
    `- **平台**：雪球`,
    `- **发布时间**：${post.createdAt}`,
    `- **归档时间**：${timestamp}`,
    `- **链接**：${post.url}`,
    '',
    '## 原始内容',
    '',
    post.fullText || post.text,
  ].join('\n');

  await mkdir(userDir(post.userId), { recursive: true });
  await writeFile(filePath, stringifyFrontmatter(frontmatter, content), 'utf8');

  // 更新游标
  cursor.seenIds.push(post.id);
  cursor.lastFetch = timestamp;
  await writeCursor(post.userId, cursor);

  return { saved: true, path: filePath };
}

/** 批量保存（自动去重：内存级 + 文件游标双重去重） */
export async function saveRawPosts(posts: RawPost[]): Promise<{ saved: number; skipped: number; paths: string[] }> {
  // 内存级去重
  const seenInBatch = new Set<string>();
  const uniquePosts = posts.filter(p => {
    const key = `${p.userId}/${p.id}`;
    if (seenInBatch.has(key)) return false;
    seenInBatch.add(key);
    return true;
  });

  let saved = 0;
  let skipped = 0;
  const paths: string[] = [];

  for (const post of uniquePosts) {
    const result = await saveRawPost(post);
    if (result.saved) saved++;
    else skipped++;
    paths.push(result.path);
  }

  return { saved, skipped, paths };
}

/** 列出已抓取的原始帖子 */
export async function listRawPosts(userId?: string): Promise<RawPostMeta[]> {
  await ensureProjectDirectories();
  const allPosts: RawPostMeta[] = [];

  let dirs: string[];
  if (userId) {
    const d = userDir(userId);
    if (!existsSync(d)) return [];
    dirs = [d];
  } else {
    if (!existsSync(DATA_DIRECTORIES.rawXueqiu)) return [];
    dirs = (await readdir(DATA_DIRECTORIES.rawXueqiu, { withFileTypes: true }))
      .filter(d => d.isDirectory())
      .map(d => path.join(DATA_DIRECTORIES.rawXueqiu, d.name));
  }

  for (const dir of dirs) {
    const files = (await readdir(dir)).filter(f => f.endsWith('.md'));
    for (const file of files) {
      const filePath = path.join(dir, file);
      try {
        const source = await readFile(filePath, 'utf8');
        const frontmatter = parseRawFrontmatter(source);
        const content = extractContent(source);
        if (!frontmatter.xueqiu) continue;

        allPosts.push({
          id: frontmatter.xueqiu.postId,
          userId: frontmatter.xueqiu.userId,
          author: frontmatter.author || '',
          text: content,
          url: frontmatter.xueqiu.url || '',
          createdAt: frontmatter.date || '',
          type: (frontmatter.xueqiu.type as RawPostMeta['type']) || 'short',
          isRetweet: frontmatter.xueqiu.isRetweet === true,
          isPinned: frontmatter.xueqiu.isPinned === true,
          status: (frontmatter.xueqiu.status as RawPostMeta['status']) || 'pending',
          viewpointDocId: frontmatter.xueqiu.viewpointDocId,
          filePath,
        });
      } catch {
        // 跳过损坏的文件
      }
    }
  }

  // 按时间降序
  allPosts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return allPosts;
}

/** 更新帖子状态（提取后回填） */
export async function updatePostStatus(
  userId: string,
  postId: string,
  status: 'extracted' | 'skipped',
  viewpointDocId?: string,
): Promise<void> {
  const filePath = postPath(userId, postId);
  const source = await readFile(filePath, 'utf8');
  const parsed = matter(source);
  parsed.data.xueqiu = parsed.data.xueqiu || {};
  parsed.data.xueqiu.status = status;
  if (viewpointDocId) parsed.data.xueqiu.viewpointDocId = viewpointDocId;
  const output = matter.stringify(parsed.content.trim(), parsed.data).trim() + '\n';

  await writeFile(filePath, output, 'utf8');
  // 注意：不要读写游标文件，避免与 saveRawPost 的游标操作产生竞态
}

/** 删除原始帖子（仅删除文件，保留游标中的 ID 防止重复抓取） */
export async function deleteRawPost(userId: string, postId: string): Promise<void> {
  const filePath = postPath(userId, postId);
  try {
    await unlink(filePath);
  } catch {
    // 文件可能已不存在
  }
  // 注意：不操作游标文件，保留 postId 在 seenIds 中，
  // 防止下次抓取时重复入库相同帖子
}

// ---- 内部辅助 ----

interface RawPostFrontmatter extends DocumentFrontmatter {
  xueqiu?: {
    userId: string;
    postId: string;
    url: string;
    type: string;
    isRetweet: boolean;
    isPinned: boolean;
    status: string;
    viewpointDocId?: string;
  };
}

function parseRawFrontmatter(source: string): RawPostFrontmatter {
  const parsed = matter(source);
  return parsed.data as RawPostFrontmatter;
}

function extractContent(source: string): string {
  const parsed = matter(source);
  // 取 "原始内容" 标题后的文本
  const content = parsed.content.trim();
  const sectionMatch = content.match(/## 原始内容\n+([\s\S]*)/);
  if (sectionMatch) return sectionMatch[1].trim();
  return content.slice(0, 200);
}
