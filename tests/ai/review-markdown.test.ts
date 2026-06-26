import { describe, expect, it } from 'vitest';
import { buildReviewMarkdown } from '@/lib/reviews/markdown';

describe('review markdown builder', () => {
  it('renders generated review content into markdown sections', () => {
    const markdown = buildReviewMarkdown({
      title: '2026-06-13 A股每日复盘',
      inputs: {
        marketSummary: '指数震荡修复。',
        sectorPerformance: '半导体设备走强。',
        newsCatalysts: '先进封装催化增强。',
        personalObservation: '高位分歧后有修复迹象。',
        selectedViewpoints: [
          {
            id: 'v1',
            title: '某关注人观点蒸馏',
            summary: '设备链存在持续跟踪价值。',
            author: '某关注人',
            date: '2026-06-13',
          },
        ],
        ragContext: [
          {
            id: 'r1',
            docId: 'daily-review-2026-06-12',
            docPath: 'data/daily-reviews/2026-06-12.md',
            docType: 'daily_review',
            title: '2026-06-12 A股每日复盘',
            headingPath: ['五、核心个股'],
            content: '长川科技作为设备链核心个股，资金承接较强。',
            date: '2026-06-12',
          },
        ],
      },
      result: {
        date: '2026-06-13',
        market_phase: '修复',
        sentiment_score: 62,
        main_themes: ['半导体设备'],
        capital_flow_path: '资金回流半导体设备。',
        core_stocks: ['长川科技'],
        extension_stocks: ['华工科技'],
        watchpoints: ['设备链能否继续放量'],
        risks: [{text: '高位回落风险', source: 'market'}],
        facts: [{text: '指数震荡修复', source: 'market'}],
        inferences: [{text: '资金有回流科技方向倾向', source: 'market'}],
        divergence: [{text: '部分关注人认为设备链估值偏高，不宜追高', source: 'market'}],
        conclusion: '短线关注设备链持续性。',
      },
    });

    expect(markdown).toContain('# 2026-06-13 A股每日复盘');
    expect(markdown).toContain('## 六、关注人观点共识与分歧');
    expect(markdown).toContain('## 七、历史资料对照');
    expect(markdown).toContain('长川科技作为设备链核心个股');
    expect(markdown).toContain('- 长川科技');
  });
});
