import { NextResponse } from 'next/server';
import path from 'node:path';
import { getDocumentIndex } from '@/lib/server/documents';
import { readMarkdownDocument } from '@/lib/storage/md-store';

interface QASource {
  id: string;
  title: string;
  docType: string;
  heading: string;
  date?: string;
  snippet: string;
  score?: number;
}

interface QARound {
  question: string;
  answer: string;
  timestamp: string;
  sources?: QASource[];
}

interface QAThreadItem {
  /** 文档 ID，用于删除 */
  docId: string;
  /** 线程 ID，用于继续对话 */
  threadId: string;
  title: string;
  date: string;
  createdAt: string;
  updatedAt: string;
  /** 轮次数 */
  roundCount: number;
  /** 第一轮回答的摘要 */
  snippet: string;
  /** 所有轮次 */
  rounds: QARound[];
}

/** 从线程文件解析轮次 */
function parseRounds(content: string): QARound[] {
  // 去掉 frontmatter
  const body = content.replace(/^---[\s\S]*?---\n*/, '');

  // 按 --- 分割各轮
  const blocks = body.split(/\n---\n/);

  const rounds: QARound[] = [];
  for (const block of blocks) {
    const headerMatch = block.match(/## 第 (\d+) 轮 · (.+)/);
    if (!headerMatch) continue;

    const questionMatch = block.match(/\*\*🙋 用户\*\*: (.+?)(?=\n\n\*\*🤖)/s);
    const answerMatch = block.match(/\*\*🤖 助手\*\*: ([\s\S]*?)(?=\n\n引用来源:|\n\n```sources|$)/s);

    // 解析来源 JSON 块（新格式）
    let sources: QASource[] | undefined;
    const sourcesBlock = block.match(/```sources\n([\s\S]*?)\n```/);
    if (sourcesBlock) {
      try {
        const parsed = JSON.parse(sourcesBlock[1]);
        if (Array.isArray(parsed) && parsed.length > 0) {
          sources = parsed;
        }
      } catch { /* JSON 解析失败，忽略 */ }
    }

    rounds.push({
      question: (questionMatch?.[1] || '').trim(),
      answer: (answerMatch?.[1] || '').trim(),
      timestamp: headerMatch[2].trim(),
      ...(sources ? { sources } : {}),
    });
  }

  return rounds;
}

export async function GET() {
  try {
    const items = await getDocumentIndex();
    const qaItems = items
      .filter((item) => item.type === 'qa')
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    const seen = new Set<string>();
    const threads: QAThreadItem[] = [];

    for (const item of qaItems.slice(0, 50)) {
      try {
        const doc = await readMarkdownDocument(path.join(process.cwd(), item.path));
        const threadId = (doc.frontmatter.thread_id as string) || item.id;

        // 去重（同一个 thread 可能因为索引重建出现多次）
        if (seen.has(threadId)) continue;
        seen.add(threadId);

        const rounds = parseRounds(doc.content);
        const firstRound = rounds[0];

        threads.push({
          docId: item.id,
          threadId,
          title: (doc.frontmatter.title as string) || item.title,
          date: (doc.frontmatter.date as string) || item.date || '',
          createdAt: (doc.frontmatter.created_at as string) || '',
          updatedAt: (doc.frontmatter.updated_at as string) || '',
          roundCount: rounds.length || 1,
          snippet: firstRound?.answer?.slice(0, 200)?.replace(/\n/g, ' ') || item.summary.slice(0, 200),
          rounds,
        });
      } catch {
        // 文件读取失败，跳过
      }
    }

    // 按更新时间降序
    threads.sort((a, b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt));

    return NextResponse.json({ ok: true, data: threads });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : '获取失败' },
      { status: 500 },
    );
  }
}
