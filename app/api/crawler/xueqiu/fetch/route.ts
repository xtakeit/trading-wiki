/**
 * POST /api/crawler/xueqiu/fetch
 * 触发雪球用户帖子抓取（Playwright 浏览器自动化）
 */

import { NextRequest, NextResponse } from 'next/server';
import { getBrowserContext } from '@/lib/crawler/xueqiu/browser';
import { scrapeUserPosts } from '@/lib/crawler/xueqiu/scraper';
import { saveRawPosts } from '@/lib/crawler/xueqiu/raw-store';
import { loadWatchlist } from '@/lib/crawler/xueqiu/config';

export const maxDuration = 300; // 最长 5 分钟

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userIds: string[] = body.userIds;
    const maxPosts = body.maxPosts ?? 20;
    const skipPinned = body.skipPinned !== false;
    const skipRetweets = body.skipRetweets !== false;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json(
        { error: '请至少指定一个用户 ID（userIds）' },
        { status: 400 },
      );
    }

    const watchlist = loadWatchlist();
    const results: Array<{
      userId: string;
      author: string;
      fetched: number;
      saved: number;
      skipped: number;
      error?: string;
    }> = [];

    // 获取或创建浏览器（单例，不关闭）
    let context;
    try {
      context = await getBrowserContext();
    } catch (err) {
      return NextResponse.json(
        { error: '浏览器启动失败', detail: String(err) },
        { status: 503 },
      );
    }

    // 逐个用户抓取
    for (const userId of userIds) {
      const userConfig = watchlist.users.find(u => u.id === userId);
      const author = userConfig?.name || userId;

      try {
        const posts = await scrapeUserPosts(context, userId, author, {
          maxPosts,
          skipPinned,
          skipRetweets,
        });

        const { saved, skipped } = await saveRawPosts(posts);

        results.push({
          userId,
          author,
          fetched: posts.length,
          saved,
          skipped,
        });
      } catch (err) {
        results.push({
          userId,
          author,
          fetched: 0,
          saved: 0,
          skipped: 0,
          error: String(err),
        });
      }
    }

    const totalFetched = results.reduce((s, r) => s + r.fetched, 0);
    const totalSaved = results.reduce((s, r) => s + r.saved, 0);

    return NextResponse.json({
      success: true,
      results,
      summary: {
        totalFetched,
        totalSaved,
        totalErrors: results.filter(r => r.error).length,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: '抓取失败', detail: String(err) },
      { status: 500 },
    );
  }
}
