import path from 'node:path';
import { buildLocalDocumentIndex } from '@/lib/storage/build-index';
import { writeMarkdownDocument } from '@/lib/storage/md-store';
import { DATA_DIRECTORIES, ensureProjectDirectories } from '@/lib/storage/paths';

async function main() {
  await ensureProjectDirectories();

  await Promise.all([
    writeMarkdownDocument({
      absolutePath: path.join(DATA_DIRECTORIES.dailyReviews, '2026-06-12.md'),
      frontmatter: {
        type: 'daily_review',
        date: '2026-06-12',
        title: '2026-06-12 A股每日复盘',
        market_phase: '分歧修复',
        themes: ['AI算力', '半导体设备'],
        core_stocks: ['长川科技', '华工科技'],
        stocks: ['300604'],
        tags: ['每日复盘', '情绪周期', '资金流'],
        created_at: '2026-06-12T18:00:00+08:00',
        updated_at: '2026-06-12T18:00:00+08:00',
      },
      content: `# 2026-06-12 A股每日复盘

## 一、市场环境
指数震荡修复，成交额温和回升，风险偏好较前一日改善。

## 二、情绪周期
高位连板分化后出现修复，资金更偏好有基本面预期的科技方向。

## 三、资金流向
资金从核心光模块个股扩散到半导体设备与先进封装链条。

## 四、主线板块
AI算力、半导体设备表现更强，机器人分支维持轮动。

## 五、核心个股
长川科技、华工科技获得更高关注度。

## 六、关注人观点共识与分歧
市场对设备国产替代的中期空间较有共识，但对节奏分歧仍大。

## 七、明日观察点
观察设备链能否继续放量，核心股是否走出趋势强化。

## 八、风险传导
若指数回落，短线高弹性科技股可能率先承压。

## 九、个人备注
继续跟踪半导体设备和先进封装的订单预期。`,
    }),
    writeMarkdownDocument({
      absolutePath: path.join(DATA_DIRECTORIES.viewpoints, 'mou-guanzhuren-2026-06-12.md'),
      frontmatter: {
        type: 'viewpoint',
        date: '2026-06-12',
        title: '某关注人观点蒸馏',
        author: '某关注人',
        platform: '雪球',
        mentioned_stocks: ['300604'],
        mentioned_themes: ['半导体设备', '先进封装'],
        tags: ['大V观点', '半导体设备'],
        created_at: '2026-06-12T15:30:00+08:00',
        updated_at: '2026-06-12T15:30:00+08:00',
      },
      content: `# 某关注人观点蒸馏

## 原始发言
半导体设备这轮更多像订单和预期共振，先进封装设备值得继续跟踪。

## AI 摘要
观点偏向短中期看多，核心聚焦设备国产替代逻辑。

## 涉及方向
半导体设备、先进封装。

## 核心观点
订单兑现与国产替代预期是当前主线。

## 事实依据
市场关注度提升，产业链景气预期回暖。

## 推理链条
如果先进封装景气回升，设备端可能先于下游表现。

## 风险点
订单兑现节奏可能不及预期。

## 后续验证
跟踪公司公告、行业资本开支与板块成交。`,
    }),
    writeMarkdownDocument({
      absolutePath: path.join(DATA_DIRECTORIES.themes, 'ai-suanli-yanjiu.md'),
      frontmatter: {
        type: 'theme_research',
        title: 'AI算力产业链研究',
        themes: ['AI算力'],
        tags: ['产业链', '资金流', '利润流'],
        updated_at: '2026-06-12T18:00:00+08:00',
      },
      content: `# AI算力产业链研究

## 一、产业链位置
算力基础设施处于大模型和应用扩张的底座层。

## 二、资金流
市场资金更偏好业绩与产业催化共振的细分方向。`,
    }),
    writeMarkdownDocument({
      absolutePath: path.join(DATA_DIRECTORIES.notes, '2026-week24-notes.md'),
      frontmatter: {
        type: 'note',
        title: '2026 第24周观察笔记',
        date: '2026-06-12',
        tags: ['周度观察', '半导体设备'],
        themes: ['半导体设备'],
        stocks: ['300604'],
        updated_at: '2026-06-12T21:00:00+08:00',
      },
      content: `# 2026 第24周观察笔记

## 交易面
高弹性方向仍集中在科技成长。

## 研究面
设备链的订单节奏和新技术扩散速度值得继续跟踪。`,
    }),
  ]);

  const items = await buildLocalDocumentIndex();
  console.log(`Seeded ${items.length} sample documents.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
