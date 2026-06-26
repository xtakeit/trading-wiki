import { z } from 'zod';
import type { SourcedItem } from '@/lib/types/document';

export const viewpointPlatforms = ['雪球', '微博', '知识星球', '微信', 'B站', '其他'] as const;
export type ViewpointPlatform = (typeof viewpointPlatforms)[number];

export type ViewpointStance = 'bullish' | 'bearish' | 'neutral' | 'watch';
export type ViewpointTimeHorizon = 'intraday' | 'short' | 'mid' | 'long' | 'unknown';
export type ViewpointConfidence = 'low' | 'medium' | 'high';

export interface ViewpointExtractionResult {
  summary: string;
  stance: ViewpointStance;
  time_horizon: ViewpointTimeHorizon;
  mentioned_stocks: string[];
  mentioned_themes: string[];
  facts: SourcedItem[];
  opinions: SourcedItem[];
  reasoning: SourcedItem[];
  risks: SourcedItem[];
  /** 反证：哪些证据或逻辑可能推翻上述观点 */
  counter_evidence: SourcedItem[];
  confidence: ViewpointConfidence;
  /** AI 提取的可验证声明 */
  verifiable_claims: VerifiableClaim[];
}

export interface VerifiableClaim {
  claim: string;
  /** 验证依据/时机 */
  verify_by: string;
  /** 建议验证窗口: 1日/3日/5日/10日/20日/30日/90日/180日 */
  suggested_window: string;
}

const verifiableClaimSchema = z.object({
  claim: z.string(),
  verify_by: z.string(),
  suggested_window: z.string(),
});

const sourcedItemSchema = z.object({
  text: z.string(),
  source: z.enum(['original', 'opinion', 'inferred', 'market', 'rag', 'personal', 'unknown']),
  source_ref: z.string().optional(),
});

export const viewpointExtractionSchema = z.object({
  summary: z.string(),
  stance: z.string(),
  time_horizon: z.string(),
  mentioned_stocks: z.array(z.string()),
  mentioned_themes: z.array(z.string()),
  facts: z.array(sourcedItemSchema),
  opinions: z.array(sourcedItemSchema),
  reasoning: z.array(sourcedItemSchema),
  risks: z.array(sourcedItemSchema),
  counter_evidence: z.array(sourcedItemSchema),
  confidence: z.string(),
  verifiable_claims: z.array(verifiableClaimSchema),
}) as z.ZodType<ViewpointExtractionResult>;

export interface ExtractViewpointInput {
  rawText: string;
  author: string;
  platform: ViewpointPlatform;
  date: string;
  source?: string;
}
