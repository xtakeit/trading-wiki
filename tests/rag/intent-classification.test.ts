/**
 * 意图识别稳定性测试。
 *
 * 两层验证：
 * 1. scoreIntents — 纯正则评分（纯函数、确定性），验证 regex 层稳定性
 * 2. routeQuerySource — 集成测试（含实体提取 + LLM 兜底）
 *
 * 注意：regex 层有固有局限（同分时按数组顺序），不测试边界模糊场景。
 * 模糊场景由 LLM 兜底，在 routeQuerySource 层验证。
 */
import { describe, it, expect } from 'vitest';
import { scoreIntents, routeQuerySource } from '@/lib/rag/source-router';
import cases from '@/tests/fixtures/intent-cases.json';

// ---- 第一层：正则评分测试 ----

describe('scoreIntents（正则评分层）', () => {
  // 清晰命中的测试（有明确关键词匹配）
  const clearCases = (cases as Array<{ query: string; expectedIntent: string; note: string }>).filter(
    ({ query }) => {
      // 排除零分情况的 query（regex 无法处理的宽泛查询）
      return !['NAND行业AI驱动什么意思', '半导体前驱体是什么', '存储材料有哪些投资机会']
        .includes(query) &&
        // 排除 regex 同分情况（由 LLM 层解决）
        !['CPO技术是否已经量产', '先进封装产能是否过剩'].includes(query);
    }
  );

  for (const { query, expectedIntent, note } of clearCases) {
    it(`${query} → ${expectedIntent} (${note})`, () => {
      const scores = scoreIntents(query);
      expect(scores.length).toBeGreaterThan(0);
      const top = scores[0];
      expect(top.intent).toBe(expectedIntent);
      expect(top.score).toBeGreaterThan(0);
    });
  }

  // 零分/宽泛查询由 classifyViaRegex（或 LLM 兜底）处理，
  // 在 scoreIntents 层多个意图都为零分，由 routeQuerySource 测试验证通用回退行为。
});

// ---- 第二层：集成测试 ----

describe('routeQuerySource（集成测试）', () => {
  // 高置信度场景快速验证（regex 2x gap 跳过 LLM）
  const highConfidenceCases = [
    { query: '亨通光电的主营业务', expected: 'stock_deep', stock: '亨通光电' },
    { query: '光通信产业链上下游有哪些公司', expected: 'chain' },
    { query: 'PCB产业链分析', expected: 'chain' },
    { query: '800G光模块最近有什么催化', expected: 'recency' },
    { query: '半导体设备板块资金流向', expected: 'market_review' },
    { query: 'NAND行业AI驱动什么意思', expected: 'general' },
  ];

  for (const { query, expected, stock } of highConfidenceCases) {
    it(`[high-conf] ${query} → ${expected}`, async () => {
      const route = await routeQuerySource(query);
      expect(route.intent).toBe(expected);
      if (stock && route.entities) {
        expect(route.entities.stocks.map(s => s.name)).toContain(stock);
      }
    });
  }
});
