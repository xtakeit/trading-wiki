import { z } from 'zod';
import type { SourcedItem } from '@/lib/types/document';
import type { VerifiableClaim } from '@/lib/types/viewpoint';

// ===== 新增子类型 =====

/** 多层价值链的一层 */
export interface ValueChainLayer {
  layer_name: string;
  description: string;
  companies: string[];
  bottlenecks: SourcedItem[];
}

/** 证据表条目 */
export interface EvidenceItem {
  claim: string;
  grade: 'strong' | 'medium' | 'weak';
  support: string;
  needs_check: string;
  source_ref?: string;
}

/** 评分卡 */
export interface Scorecard {
  positive_factors: Array<{ factor: string; detail: string; weight?: number }>;
  penalty_factors: Array<{ factor: string; detail: string; weight?: number }>;
  summary?: string;
}

export interface ThemeResearchResult {
  title: string;
  industry_chain_position: string;
  capital_flow: string;
  physical_flow: string;
  profit_flow: string;
  upstream: string[];
  midstream: string[];
  downstream: string[];
  bottlenecks: SourcedItem[];
  core_companies: string[];
  catalysts: SourcedItem[];
  risks: SourcedItem[];
  personal_judgment: string;
  /** AI 提取的可验证声明 */
  verifiable_claims: VerifiableClaim[];
  // ===== 新增可选字段 =====
  /** 多层价值链映射 */
  value_chain_layers?: ValueChainLayer[];
  /** 证据强度表 */
  evidence_table?: EvidenceItem[];
  /** 证伪条件 */
  failure_conditions?: string[];
  /** 下一步研究行动 */
  next_steps?: string[];
  /** 量化评分卡 */
  scorecard?: Scorecard;
}

const sourcedItemSchema = z.object({
  text: z.string(),
  source: z.enum(['original', 'opinion', 'inferred', 'market', 'rag', 'personal', 'unknown']),
  source_ref: z.string().optional(),
});

const verifiableClaimSchema = z.object({
  claim: z.string(),
  verify_by: z.string(),
  suggested_window: z.string(),
});

const valueChainLayerSchema = z.object({
  layer_name: z.string(),
  description: z.string(),
  companies: z.array(z.string()),
  bottlenecks: z.array(sourcedItemSchema),
});

const evidenceItemSchema = z.object({
  claim: z.string(),
  grade: z.enum(['strong', 'medium', 'weak']),
  support: z.string(),
  needs_check: z.string(),
  source_ref: z.string().optional(),
});

const scoreFactorSchema = z.object({
  factor: z.string(),
  detail: z.string(),
  weight: z.number().optional(),
});

const scorecardSchema = z.object({
  positive_factors: z.array(scoreFactorSchema),
  penalty_factors: z.array(scoreFactorSchema),
  summary: z.string().optional(),
});

export const themeResearchGenerationSchema = z.object({
  title: z.string(),
  industry_chain_position: z.string(),
  capital_flow: z.string(),
  physical_flow: z.string(),
  profit_flow: z.string(),
  upstream: z.array(z.string()),
  midstream: z.array(z.string()),
  downstream: z.array(z.string()),
  bottlenecks: z.array(sourcedItemSchema),
  core_companies: z.array(z.string()),
  catalysts: z.array(sourcedItemSchema),
  risks: z.array(sourcedItemSchema),
  personal_judgment: z.string(),
  verifiable_claims: z.array(verifiableClaimSchema),
  // ===== 新增可选字段 =====
  value_chain_layers: z.array(valueChainLayerSchema).optional(),
  evidence_table: z.array(evidenceItemSchema).optional(),
  failure_conditions: z.array(z.string()).optional(),
  next_steps: z.array(z.string()).optional(),
  scorecard: scorecardSchema.optional(),
});

export interface GenerateThemeResearchInput {
  themeName: string;
  rawMaterials: string;
  personalObservation: string;
}
