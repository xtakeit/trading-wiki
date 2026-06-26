import { z } from 'zod';
import { evidenceLevels } from '@/lib/types/fact';

export const materialTypes = [
  'announcement',
  'news',
  'research',
  'company_info',
  'other',
] as const;
export type MaterialType = (typeof materialTypes)[number];

export const materialTypeLabels: Record<MaterialType, string> = {
  announcement: '公告',
  news: '新闻',
  research: '研报',
  company_info: '公司资料',
  other: '其他',
};

export interface MaterialRecord {
  materialType: MaterialType;
  stocks: string[];
  themes: string[];
  evidenceLevel: string;
  sourceUrl: string;
}

export const materialSchema = z.object({
  materialType: z.enum(materialTypes),
  stocks: z.array(z.string()).optional(),
  themes: z.array(z.string()).optional(),
  evidenceLevel: z.enum(evidenceLevels),
  sourceUrl: z.string().optional(),
});
