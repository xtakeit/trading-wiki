/**
 * 雪球爬虫类型定义
 */

/** 从 config/xueqiu-watchlist.json 读取的用户配置 */
export interface XueqiuUserConfig {
  id: string;
  name: string;
}

export interface XueqiuWatchlist {
  users: XueqiuUserConfig[];
  defaultMaxPosts: number;
}

/** 雪球帖子的原始形态（从 DOM 解析后） */
export interface RawPost {
  /** 帖子 ID（从 URL 提取的数字） */
  id: string;
  /** 雪球用户 ID */
  userId: string;
  /** 用户显示名 */
  author: string;
  /** 帖子文本内容 */
  text: string;
  /** 完整文本（长文展开后） */
  fullText?: string;
  /** 帖子 URL */
  url: string;
  /** 发布时间（ISO 字符串） */
  createdAt: string;
  /** 帖子类型 */
  type: 'short' | 'long' | 'article';
  /** 是否为转发 */
  isRetweet: boolean;
  /** 是否为置顶 */
  isPinned: boolean;
}

/** 抓取配置 */
export interface XueqiuCrawlConfig {
  maxPosts?: number;
  skipPinned?: boolean;
  skipRetweets?: boolean;
}

/** 单次抓取结果 */
export interface FetchResult {
  userId: string;
  author: string;
  posts: RawPost[];
}

/** 原始帖子的元数据（用于列表展示，不含全文） */
export interface RawPostMeta {
  id: string;
  userId: string;
  author: string;
  text: string;
  url: string;
  createdAt: string;
  type: 'short' | 'long' | 'article';
  isRetweet: boolean;
  isPinned: boolean;
  /** 提取状态: pending(待提取) | extracted(已提取) | skipped(已跳过) */
  status: 'pending' | 'extracted' | 'skipped';
  /** 对应观点文档 ID（提取后回填） */
  viewpointDocId?: string;
  /** 文件路径 */
  filePath: string;
}

/** 去重游标 */
export interface CursorData {
  lastFetch: string;
  seenIds: string[];
}
