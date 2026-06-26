import { z } from 'zod';
import type { SourcedItem } from '@/lib/types/document';
import type { DocumentFrontmatter } from '@/lib/types/document';
import type { DocumentType } from '@/lib/types/document';

export interface DailyReviewGenerationResult {
  date: string;
  market_phase: '启动' | '发酵' | '高潮' | '分歧' | '退潮' | '修复' | '未知';
  sentiment_score: number;
  main_themes: string[];
  capital_flow_path: string;
  core_stocks: string[];
  extension_stocks: string[];
  watchpoints: string[];
  risks: SourcedItem[];
  facts: SourcedItem[];
  inferences: SourcedItem[];
  divergence: SourcedItem[];
  conclusion: string;
}

const sourcedItemSchema = z.object({
  text: z.string(),
  source: z.enum(['original', 'opinion', 'inferred', 'market', 'rag', 'personal', 'unknown']),
  source_ref: z.string().optional(),
});

export const dailyReviewGenerationSchema = z.object({
  date: z.string(),
  market_phase: z.enum(['启动', '发酵', '高潮', '分歧', '退潮', '修复', '未知']),
  sentiment_score: z.number().min(0).max(100),
  main_themes: z.array(z.string()),
  capital_flow_path: z.string(),
  core_stocks: z.array(z.string()),
  extension_stocks: z.array(z.string()),
  watchpoints: z.array(z.string()),
  risks: z.array(sourcedItemSchema),
  facts: z.array(sourcedItemSchema),
  inferences: z.array(sourcedItemSchema),
  conclusion: z.string(),
  divergence: z.array(sourcedItemSchema),
});

export interface ReviewFrontmatter extends DocumentFrontmatter {
  type: 'daily_review';
  market_phase?: string;
  themes?: string[];
  core_stocks?: string[];
}

export interface ReviewContextItem {
  id: string;
  title: string;
  summary: string;
  author?: string;
  date?: string;
}

export interface ReviewRagContextItem {
  id: string;
  docId: string;
  docPath: string;
  docType: DocumentType;
  title: string;
  headingPath: string[];
  content: string;
  date?: string;
  author?: string;
  platform?: string;
  score?: number;
}

export interface GenerateReviewInput {
  date: string;
  marketSummary: string;
  sectorPerformance: string;
  newsCatalysts: string;
  personalObservation: string;
  selectedViewpoints: ReviewContextItem[];
  ragQuery?: string;
  ragContext?: ReviewRagContextItem[];
}
