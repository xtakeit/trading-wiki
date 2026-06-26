import { z } from 'zod';

/** 验证状态 */
export const factStates = ['pending', 'confirmed', 'falsified', 'insufficient', 'expired', 'superseded'] as const;
export type FactState = (typeof factStates)[number];

export const factStateLabels: Record<FactState, string> = {
  pending: '待验证',
  confirmed: '已确认',
  falsified: '已证伪',
  insufficient: '证据不足',
  expired: '已过期',
  superseded: '已被替代',
};

/** 证据强度等级 */
export const evidenceLevels = ['A', 'B', 'C', 'D'] as const;
export type EvidenceLevel = (typeof evidenceLevels)[number];

export const evidenceLevelLabels: Record<EvidenceLevel, string> = {
  A: 'A级·公告/财报/监管文件',
  B: 'B级·券商研报/公司IR/可靠调研',
  C: 'C级·专家会议/媒体报道/纪要',
  D: 'D级·群聊/传闻/未确认',
};

export interface VerifiableFact {
  id: string;
  /** 断言内容，如"长川科技预计Q3量产新一代测试设备" */
  claim: string;
  /** 来源文档 ID */
  sourceDocId: string;
  /** 来源文档类型 */
  sourceDocType: string;
  /** 来源文档标题 */
  sourceTitle: string;
  /** 相关股票 */
  stocks: string[];
  /** 相关主题 */
  themes: string[];
  /** 验证状态 */
  state: FactState;
  /** 多窗口验证：每个窗口的结果 */
  windows: FactWindow[];
  /** 证据强度等级 */
  evidenceLevel: EvidenceLevel;
  /** 备注 */
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface FactWindow {
  /** 窗口名称，如"1日""3日""5日""10日""20日" */
  label: string;
  /** 到期日 */
  dueDate: string;
  /** 验证结果 */
  result?: FactState | null;
  /** 验证备注 */
  note?: string;
}

export const createFactSchema = z.object({
  claim: z.string().min(1, '断言内容不能为空'),
  sourceDocId: z.string().optional(),
  sourceDocType: z.string().optional(),
  sourceTitle: z.string().optional(),
  stocks: z.array(z.string()).optional(),
  themes: z.array(z.string()).optional(),
  evidenceLevel: z.enum(evidenceLevels).optional(),
  windows: z
    .array(
      z.object({
        label: z.string(),
        dueDate: z.string(),
        result: z.enum(factStates).nullable().optional(),
        note: z.string().optional(),
      }),
    )
    .optional(),
  notes: z.string().optional(),
});

export const updateFactSchema = z.object({
  id: z.string().min(1),
  claim: z.string().optional(),
  state: z.enum(factStates).optional(),
  stocks: z.array(z.string()).optional(),
  themes: z.array(z.string()).optional(),
  evidenceLevel: z.enum(evidenceLevels).optional(),
  windows: z
    .array(
      z.object({
        label: z.string(),
        dueDate: z.string(),
        result: z.enum(factStates).nullable().optional(),
        note: z.string().optional(),
      }),
    )
    .optional(),
  notes: z.string().optional(),
});
