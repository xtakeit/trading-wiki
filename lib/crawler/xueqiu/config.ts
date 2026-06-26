/**
 * 雪球爬虫配置加载
 * 从 config/xueqiu-watchlist.json 读取关注用户列表
 */

import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import type { XueqiuWatchlist } from './types';

const CONFIG_PATH = path.join(process.cwd(), 'config', 'xueqiu-watchlist.json');

let cachedConfig: XueqiuWatchlist | null = null;

export function loadWatchlist(): XueqiuWatchlist {
  if (cachedConfig) return cachedConfig;

  try {
    if (!existsSync(CONFIG_PATH)) {
      cachedConfig = { users: [], defaultMaxPosts: 20 };
      return cachedConfig;
    }
    const raw = readFileSync(CONFIG_PATH, 'utf8');
    cachedConfig = JSON.parse(raw) as XueqiuWatchlist;
    return cachedConfig;
  } catch {
    cachedConfig = { users: [], defaultMaxPosts: 20 };
    return cachedConfig;
  }
}

export function reloadWatchlist(): XueqiuWatchlist {
  cachedConfig = null;
  return loadWatchlist();
}
