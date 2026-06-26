/**
 * 雪球用户主页帖子抓取
 * 通过 Playwright 模拟浏览器访问用户主页，滚动加载并提取帖子。
 */

import type { BrowserContext, Page } from 'playwright-core';
import type { RawPost, XueqiuCrawlConfig } from './types';

/** 相对时间转绝对时间（雪球格式） */
function parseRelativeTime(text: string): string {
  const now = new Date();
  const trimmed = text.trim();

  if (trimmed === '刚刚') return now.toISOString();

  const minMatch = trimmed.match(/^(\d+)分钟前$/);
  if (minMatch) {
    const d = new Date(now.getTime() - parseInt(minMatch[1]) * 60000);
    return d.toISOString();
  }

  const hourMatch = trimmed.match(/^(\d+)小时前$/);
  if (hourMatch) {
    const d = new Date(now.getTime() - parseInt(hourMatch[1]) * 3600000);
    return d.toISOString();
  }

  const dayMatch = trimmed.match(/^(\d+)天前$/);
  if (dayMatch) {
    const d = new Date(now.getTime() - parseInt(dayMatch[1]) * 86400000);
    return d.toISOString();
  }

  if (trimmed.startsWith('今天')) {
    const timePart = trimmed.replace('今天', '').trim();
    const [h, m] = timePart.split(':').map(Number);
    const d = new Date(now);
    d.setHours(h || 0, m || 0, 0, 0);
    return d.toISOString();
  }

  if (trimmed.startsWith('昨天')) {
    const timePart = trimmed.replace('昨天', '').trim();
    const [h, m] = timePart.split(':').map(Number);
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    d.setHours(h || 0, m || 0, 0, 0);
    return d.toISOString();
  }

  // MM-DD HH:mm
  const mdMatch = trimmed.match(/^(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})$/);
  if (mdMatch) {
    const [, month, day, h, m] = mdMatch;
    const d = new Date(now.getFullYear(), parseInt(month) - 1, parseInt(day), parseInt(h), parseInt(m));
    return d.toISOString();
  }

  // YYYY-MM-DD
  const ymdMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ymdMatch) {
    const d = new Date(parseInt(ymdMatch[1]), parseInt(ymdMatch[2]) - 1, parseInt(ymdMatch[3]));
    return d.toISOString();
  }

  return now.toISOString();
}

/** 检查雪球是否已登录（通过 session cookie，最可靠） */
async function checkLogin(page: Page): Promise<boolean> {
  try {
    // 方法 1: 检查雪球的 session cookie（不受 DOM 变化影响）
    const cookies = await page.context().cookies('https://xueqiu.com');
    const hasSessionCookie = cookies.some(
      c => c.name.includes('xq_a_token') || c.name.includes('xq_id_token')
    );
    if (hasSessionCookie) return true;

    // 方法 2: 备用 - DOM 检测（雪球登录后 .login-btn 会消失）
    const domLoggedIn = await page.evaluate(() => {
      // 登录按钮存在 → 未登录
      if (document.querySelector('.login-btn, [class*="logined"]')) return false;
      // 用户信息存在 → 已登录
      return !!(
        document.querySelector('[class*="user-info"]')
        || document.querySelector('[class*="avatar"]')
        || document.querySelector('[class*="user-show"]')
        || document.querySelector('.nav-user')
      );
    });
    return domLoggedIn;
  } catch {
    return false;
  }
}

/** 等待用户手动登录（最多等 5 分钟） */
async function waitForManualLogin(page: Page, author: string): Promise<void> {
  // 先检查是否已登录（用多种方式检测）
  if (await checkLogin(page)) return;

  // 确保当前在雪球页面（用户看到的应该是首页/登录页）
  const currentUrl = page.url();
  if (!currentUrl.includes('xueqiu.com')) {
    try {
      await page.goto('https://xueqiu.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
    } catch { /* ignore */ }
  }

  console.log(`[雪球] ${author} 尚未登录，请在打开的浏览器窗口中手动登录雪球...`);

  // 轮询等待登录状态（最多 5 分钟）
  for (let i = 0; i < 150; i++) {
    await new Promise(r => setTimeout(r, 2000));

    if (await checkLogin(page)) {
      console.log(`[雪球] ${author} 登录成功，继续抓取`);
      return;
    }

    // 每 30 秒提示一次（给服务器日志）
    if (i > 0 && i % 15 === 0) {
      console.log(`[雪球] 等待登录中... (已等待 ${i * 2} 秒)`);
    }
  }

  throw new Error(
    `雪球登录超时。请在打开的浏览器窗口中登录雪球 (xueqiu.com)。\n`
    + `登录后会自动继续。如果登录窗口已关闭，请重新点击「抓取最新帖子」。`
  );
}

/** 抓取单个用户的帖子 */
export async function scrapeUserPosts(
  context: BrowserContext,
  userId: string,
  author: string,
  config: XueqiuCrawlConfig = {},
): Promise<RawPost[]> {
  const maxPosts = config.maxPosts ?? 20;
  const page = await context.newPage();

  try {
    // 设置超时
    page.setDefaultTimeout(15000);

    // 直接导航到用户主页
    console.log(`[雪球] 正在加载 https://xueqiu.com/u/${userId} ...`);
    try {
      await page.goto(`https://xueqiu.com/u/${userId}`, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
    } catch (err) {
      console.log(`[雪球] 导航到用户页失败: ${err}`);
    }

    // 等待登录（如果未登录，打开首页让用户手动登录）
    await waitForManualLogin(page, author);

    // 切换到「原发」tab（只抓用户原创帖，不含转发和回复）
    try {
      const tabClicked = await page.evaluate(() => {
        const tabItems = document.querySelectorAll('a, button, span, div');
        for (const el of tabItems) {
          if (el.textContent?.trim() === '原发' && el.classList.length > 0) {
            (el as HTMLElement).click();
            return true;
          }
        }
        return false;
      });
      if (tabClicked) {
        console.log('[雪球] 已切换到「原发」tab');
        await new Promise(r => setTimeout(r, 3000));
      } else {
        console.log('[雪球] 未找到「原发」tab，使用全部 tab');
      }
    } catch {
      console.log('[雪球] 切换 tab 失败');
    }

    // 滚动加载更多帖子
    // 使用 Keyboard End 键触发雪球的无限滚动（比 scrollTo 更接近用户操作）
    // 配合鼠标滚轮双重保障
    const scrollCount = 12;
    for (let i = 0; i < scrollCount; i++) {
      await page.keyboard.press('End');
      await new Promise(r => setTimeout(r, 2000));
      await page.mouse.wheel(0, 1500);
      await new Promise(r => setTimeout(r, 1000));
    }
    // 等所有异步加载完成
    await new Promise(r => setTimeout(r, 2000));

    // 提取帖子数据
    const extracted = await page.evaluate((maxItems: number) => {
      const timePattern = /刚刚|\d+分钟前|\d+小时前|\d+天前|今天\s*\d+:\d+|昨天\s*\d+:\d+/;

      // 步骤 1：找到时间线容器（限定搜索范围，避免侧栏/评论区噪音）
      function findTimeline(): Element {
        const selectors = [
          '[class*="timeline"]',
          '[class*="status-list"]',
          '[class*="feed-list"]',
          '[class*="user-timeline"]',
          '[class*="main-area"]',
          'main',
          '[role="main"]',
        ];
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el && (el.textContent?.length || 0) > 200) return el;
        }
        return document.body;
      }
      const timeline = findTimeline();

      // 步骤 2：只在时间线容器内找帖子链接
      const links = timeline.querySelectorAll('a');
      const linkPosts: Array<{ link: HTMLAnchorElement; postId: string }> = [];
      for (const link of links) {
        const href = link.href || '';
        const m = href.match(/xueqiu\.com\/\d+\/(\d+)/);
        if (m) linkPosts.push({ link: link as HTMLAnchorElement, postId: m[1] });
        if (linkPosts.length >= maxItems * 3) break;
      }

      // 步骤 3：去重后提取文本
      const seenIds = new Set<string>();
      const results: Array<{ text: string; time: string; url: string; id: string }> = [];

      for (const { link, postId } of linkPosts) {
        if (seenIds.has(postId) || !postId) continue;

        // 向上走 6 层，找合适的帖子容器
        let container: Element | null = link;
        let bestText = '';
        let bestTime = '';

        for (let d = 0; d < 6; d++) {
          if (!container) break;
          const ct = container.textContent?.trim() || '';
          if (ct.length > 3000 || ct.length < 25) { container = container.parentElement; continue; }
          const tm = ct.match(timePattern);
          if (tm) { bestText = ct; bestTime = tm[0]; break; }
          container = container.parentElement;
        }

        if (!bestText || !bestTime) continue;
        seenIds.add(postId);

        // 从容器中找「正文」子元素（去掉用户信息、按钮等噪音）
        // 策略：找容器内文本最长的子元素作为正文
        let bodyText = bestText;
        if (container) {
          const children = Array.from(container.querySelectorAll('*'));
          let longestChild = '';
          for (const child of children) {
            const t = child.textContent?.trim() || '';
            if (t.length > longestChild.length && t.length < 2000) {
              longestChild = t;
            }
          }
          if (longestChild.length > 30) bodyText = longestChild;
        }

        const clean = bodyText.replace(/\s+/g, ' ').trim();
        if (clean.length > 15) {
          results.push({ text: clean, time: bestTime, url: link.href, id: postId });
        }
        if (results.length >= maxItems) break;
      }

      return results.map(item => ({
        text: item.text, time: item.time, url: item.url, id: item.id,
        isPinned: false,
        isRetweet: item.text.startsWith('转发') || item.text.startsWith('//'),
        isReply: item.text.includes('回复') && item.text.includes('@'),
        type: item.text.length > 500 ? 'long' : 'short',
      }));
    }, maxPosts);

    // 转换为 RawPost 格式
    const posts = extracted.map(item => ({
      id: item.id,
      userId,
      author,
      text: item.text,
      url: item.url || `https://xueqiu.com/${userId}/${item.id}`,
      createdAt: parseRelativeTime(item.time),
      type: (item.type === 'article' ? 'article' : item.text.length > 500 ? 'long' : 'short') as RawPost['type'],
      isRetweet: item.isRetweet,
      isPinned: item.isPinned,
    }));

    // 应用过滤：只保留用户原发帖子
    return posts.filter(post => {
      if (!post.text) return false; // 空内容
      if (config.skipPinned && post.isPinned) return false;
      if (config.skipRetweets && post.isRetweet) return false;
      // 过滤回复帖（"回复@xxx" 格式的评论性发言）
      if (post.text.includes('回复') && post.text.includes('@')) return false;
      return true;
    });

  } finally {
    // 不关闭页面，保留浏览器 tab 以便用户查看
  }
}
