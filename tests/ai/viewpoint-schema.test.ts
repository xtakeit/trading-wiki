import { describe, expect, it } from 'vitest';
import { viewpointExtractionSchema } from '@/lib/types/viewpoint';
import { normalizeAiOutput } from '@/lib/ai/normalize';

describe('viewpoint extraction schema', () => {
  it('normalizes localized enum-like values after normalizeAiOutput', () => {
    const raw = {
      summary: '整体偏中性，继续观察。',
      stance: '中性',
      time_horizon: '',
      mentioned_stocks: ['600000'],
      mentioned_themes: ['银行'],
      facts: [{ text: '成交额维持平稳', source: 'original' }],
      opinions: [{ text: '继续跟踪政策催化', source: 'original' }],
      reasoning: [{ text: '资金没有明显增量', source: 'original' }],
      risks: [{ text: '宏观预期变化', source: 'original' }],
      counter_evidence: [{ text: '如果政策信号转向宽松，银行股可能超预期上涨', source: 'original' }],
      confidence: 65,
      verifiable_claims: [],
    };
    const normalized = normalizeAiOutput(raw);
    const result = viewpointExtractionSchema.parse(normalized);

    expect(result.stance).toBe('neutral');
    expect(result.time_horizon).toBe('unknown');
    expect(result.confidence).toBe('medium');
  });

  it('normalizes chinese confidence labels after normalizeAiOutput', () => {
    const raw = {
      summary: '偏多但确定性一般。',
      stance: '看多',
      time_horizon: '短期',
      mentioned_stocks: [],
      mentioned_themes: ['机器人'],
      facts: [],
      opinions: [{ text: '板块情绪回暖', source: 'original' }],
      reasoning: [{ text: '题材有扩散迹象', source: 'original' }],
      risks: [],
      counter_evidence: [],
      confidence: '高',
      verifiable_claims: [],
    };
    const normalized = normalizeAiOutput(raw);
    const result = viewpointExtractionSchema.parse(normalized);

    expect(result.stance).toBe('bullish');
    expect(result.time_horizon).toBe('short');
    expect(result.confidence).toBe('high');
  });
});
