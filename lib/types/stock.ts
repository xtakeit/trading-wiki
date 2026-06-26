import { z } from 'zod';
import type { SourcedItem } from '@/lib/types/document';
import type { VerifiableClaim } from '@/lib/types/viewpoint';

export interface StockProfileResult {
  stock_name: string;
  main_business: string;
  industry_chain_position: string;
  core_upside_logic: string;
  historical_performance: string;
  viewpoint_summary: string;
  catalysts: SourcedItem[];
  valuation_anchor: string;
  risks: SourcedItem[];
  personal_judgment: string;
  follow_up_items: string[];
  /** AI 提取的可验证声明 */
  verifiable_claims: VerifiableClaim[];
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

export const stockProfileGenerationSchema = z.object({
  stock_name: z.string(),
  main_business: z.string(),
  industry_chain_position: z.string(),
  core_upside_logic: z.string(),
  historical_performance: z.string(),
  viewpoint_summary: z.string(),
  catalysts: z.array(sourcedItemSchema),
  valuation_anchor: z.string(),
  risks: z.array(sourcedItemSchema),
  personal_judgment: z.string(),
  follow_up_items: z.array(z.string()),
  verifiable_claims: z.array(verifiableClaimSchema),
});

export interface StockViewpointContext {
  id: string;
  title: string;
  summary: string;
  author?: string;
  date?: string;
}

export interface GenerateStockProfileInput {
  stockName: string;
  themes: string[];
  companyInfo: string;
  announcements: string;
  news: string;
  viewpointSummary: string;
  personalObservation: string;
  selectedViewpoints?: StockViewpointContext[];
}
