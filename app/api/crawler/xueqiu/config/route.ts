/**
 * GET /api/crawler/xueqiu/config
 * 返回雪球关注用户配置
 */

import { NextResponse } from 'next/server';
import { loadWatchlist } from '@/lib/crawler/xueqiu/config';

export async function GET() {
  const config = loadWatchlist();
  return NextResponse.json(config);
}
