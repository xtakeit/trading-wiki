/**
 * 雪球爬虫浏览器管理
 *
 * 使用 Playwright 调用系统已安装的 Chrome，持久化 Profile 保存登录态。
 * 浏览器保持单例运行，抓取完成后不关闭，下次复用。
 * 手动关闭浏览器窗口不影响下次使用（会启动新实例）。
 */

import path from 'node:path';
import { chromium, type BrowserContext } from 'playwright-core';

const CDP_URL = process.env.XUEQIU_CDP_URL || '';

interface BrowserSession {
  context: BrowserContext;
}

/** 持久化 Profile 目录 */
function getProfileDir(): string {
  return process.env.XUEQIU_USER_DATA_DIR
    || path.join(process.cwd(), '.runtime', 'browser', 'xueqiu');
}

// 模块级单例：跨 API 请求复用同一个浏览器
let cachedContext: BrowserContext | null = null;

/** 获取或创建浏览器上下文（单例） */
export async function getBrowserContext(): Promise<BrowserContext> {
  // CDP 模式（仅当显式设置 XUEQIU_CDP_URL）
  if (CDP_URL) {
    try {
      const browser = await chromium.connectOverCDP(CDP_URL);
      return browser.contexts()[0] || await browser.newContext();
    } catch (err) {
      throw new Error(
        `无法连接 CDP: ${CDP_URL}\n原始错误: ${err}`
      );
    }
  }

  // 缓存命中 → 直接复用
  if (cachedContext) {
    try {
      // 验证缓存是否有效
      const pages = cachedContext.pages();
      if (pages.length > 0 || cachedContext.browser()?.isConnected()) {
        return cachedContext;
      }
    } catch {
      // 缓存失效，重新创建
    }
  }

  // 创建新浏览器
  const USER_DATA_DIR = getProfileDir();
  console.log(`[雪球] 启动 Chrome，Profile: ${USER_DATA_DIR}`);

  const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
    channel: 'chrome',
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--no-default-browser-check',
    ],
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    viewport: { width: 1440, height: 900 },
    ignoreDefaultArgs: ['--enable-automation'],
  });

  if (!context.browser()) {
    throw new Error('Chrome 启动失败');
  }

  cachedContext = context;
  return context;
}

/** 获取持久化 Profile 目录路径 */
export function getProfilePath(): string {
  return getProfileDir();
}
