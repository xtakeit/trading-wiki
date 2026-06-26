/**
 * GET /api/crawler/xueqiu/posts
 * 列出已抓取的雪球原始帖子（供审核列表渲染）
 */

import { NextRequest, NextResponse } from 'next/server';
import { listRawPosts, updatePostStatus, deleteRawPost } from '@/lib/crawler/xueqiu/raw-store';
import { loadWatchlist } from '@/lib/crawler/xueqiu/config';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || undefined;
    const status = searchParams.get('status') || undefined;

    const posts = await listRawPosts(userId);

    // 按状态过滤
    const filtered = status ? posts.filter(p => p.status === status) : posts;

    // 注入用户显示名
    const watchlist = loadWatchlist();
    const enriched = filtered.map(post => {
      const user = watchlist.users.find(u => u.id === post.userId);
      return { ...post, author: user?.name || post.author };
    });

    return NextResponse.json({ posts: enriched });
  } catch (err) {
    return NextResponse.json(
      { error: '读取帖子列表失败', detail: String(err) },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/crawler/xueqiu/posts
 * 更新帖子状态（提取/跳过后回填）
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, postId, status, viewpointDocId } = body;

    if (!userId || !postId || !status) {
      return NextResponse.json(
        { error: '缺少必填字段：userId, postId, status' },
        { status: 400 },
      );
    }

    await updatePostStatus(userId, postId, status, viewpointDocId);

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: '更新状态失败', detail: String(err) },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/crawler/xueqiu/posts
 * 删除原始帖子（支持重新抓取）
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const postId = searchParams.get('postId');

    if (!userId || !postId) {
      return NextResponse.json(
        { error: '缺少必填参数：userId, postId' },
        { status: 400 },
      );
    }

    await deleteRawPost(userId, postId);

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: '删除失败', detail: String(err) },
      { status: 500 },
    );
  }
}
