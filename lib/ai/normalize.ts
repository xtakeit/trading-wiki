/**
 * JSON 归一化：在 Schema 校验之前，自动将字符串转为数组，修正 AI 输出格式。
 */

/** 需要归一化为字符串数组的字段 */
const STRING_ARRAY_FIELDS = new Set([
  'mentioned_stocks',
  'mentioned_themes',
  'main_themes',
  'core_stocks',
  'extension_stocks',
  'watchpoints',
  'upstream',
  'midstream',
  'downstream',
  'core_companies',
  'follow_up_items',
  'failure_conditions',
  'next_steps',
]);

/** 必须为字符串的字段（AI 有时会输出空数组） */
const MUST_BE_STRING = new Set([
  'summary',
  'industry_chain_position',
  'capital_flow',
  'physical_flow',
  'profit_flow',
  'personal_judgment',
  'conclusion',
  'market_phase',
  'sentiment_score',
  'main_business',
  'core_upside_logic',
  'historical_performance',
  'viewpoint_summary',
  'valuation_anchor',
  'stock_name',
  'themeName',
]);

/** 需要归一化为 SourcedItem[] 的字段 */
const SOURCED_ARRAY_FIELDS = new Set([
  'facts',
  'opinions',
  'reasoning',
  'risks',
  'counter_evidence',
  'inferences',
  'divergence',
  'bottlenecks',
  'catalysts',
]);

/** 将描述性 source 值映射为标准枚举 */
function normalizeSource(val: string): string {
  const v = val.toLowerCase();
  if (v.includes('原始') || v.includes('追加') || v.includes('资料') || v.includes('公告') || v.includes('新闻') || v.includes('original')) return 'original';
  if (v.includes('观点') || v.includes('opinion') || v.includes('关注人')) return 'opinion';
  if (v.includes('推断') || v.includes('推理') || v.includes('infer')) return 'inferred';
  if (v.includes('市场') || v.includes('market')) return 'market';
  if (v.includes('历史') || v.includes('rag') || v.includes('检索')) return 'rag';
  if (v.includes('个人') || v.includes('personal')) return 'personal';
  return 'unknown';
}

/** 将字符串转为 SourcedItem */
function toSourcedItem(val: unknown): { text: string; source: string; source_ref?: string } {
  if (typeof val === 'string') return { text: val, source: 'unknown' };
  if (typeof val === 'object' && val !== null) {
    const obj = val as Record<string, unknown>;
    return {
      text: typeof obj.text === 'string' ? obj.text : '',
      source: typeof obj.source === 'string' ? normalizeSource(obj.source) : 'unknown',
      source_ref: typeof obj.source_ref === 'string' ? obj.source_ref : undefined,
    };
  }
  return { text: '', source: 'unknown' };
}

/** 也处理 core_companies 是对象的情况：{ high: [...], mid: [...] } 或 [{ name: "..." }, ...] → 展开为字符串数组 */
function normalizeCoreCompanies(val: unknown): string[] {
  if (Array.isArray(val)) {
    // 如果元素是对象，提取 name/company/text 字段
    return val.map((item: unknown) => {
      if (typeof item === 'string') return item;
      if (typeof item === 'object' && item !== null) {
        const obj = item as Record<string, unknown>;
        return String(obj.name ?? obj.company ?? obj.text ?? obj.symbol ?? '');
      }
      return String(item);
    }).filter(Boolean);
  }
  if (typeof val === 'object' && val !== null) {
    const obj = val as Record<string, unknown>;
    const result: string[] = [];
    for (const v of Object.values(obj)) {
      if (Array.isArray(v)) {
        for (const item of v) {
          if (typeof item === 'string') result.push(item);
        }
      }
    }
    return result;
  }
  if (typeof val === 'string') return val.trim() ? [val.trim()] : [];
  return [];
}

function normalizeField(key: string, val: unknown): unknown {
  if (key === 'core_companies') return normalizeCoreCompanies(val);
  // 必须是字符串的字段（AI 有时输出空数组）
  if (MUST_BE_STRING.has(key)) {
    if (Array.isArray(val)) return '';
    if (typeof val === 'object' && val !== null) return '';
    return String(val ?? '');
  }
  if (SOURCED_ARRAY_FIELDS.has(key)) {
    if (Array.isArray(val)) return val.map(toSourcedItem);
    if (typeof val === 'string') return [toSourcedItem(val)];
    return [];
  }
  if (STRING_ARRAY_FIELDS.has(key)) {
    if (Array.isArray(val)) {
      // 如果元素是对象，尝试提取 text/name/company 等字段
      return val.map((item: unknown) => {
        if (typeof item === 'string') return item;
        if (typeof item === 'object' && item !== null) {
          const obj = item as Record<string, unknown>;
          return String(obj.text ?? obj.name ?? obj.company ?? obj.application_area ?? '');
        }
        return String(item);
      });
    }
    if (typeof val === 'string') return val.trim() ? [val.trim()] : [];
    return [];
  }
  return val;
}

/** stance 归一化 */
function normalizeStance(val: unknown): string {
  if (typeof val !== 'string') return 'watch';
  const v = val.trim().toLowerCase();
  const map: Record<string, string> = {
    bullish: 'bullish', bullishness: 'bullish', positive: 'bullish',
    bearish: 'bearish', bear: 'bearish', negative: 'bearish',
    neutral: 'neutral',
    watch: 'watch',
    '看多': 'bullish', '看空': 'bearish', '中性': 'neutral', '观望': 'watch',
    '偏多': 'bullish', '偏空': 'bearish', '偏中性': 'neutral',
    '多头': 'bullish', '空头': 'bearish',
  };
  return map[v] ?? map[val.trim()] ?? 'watch';
}

/** time_horizon 归一化 */
function normalizeHorizon(val: unknown): string {
  if (typeof val !== 'string') return 'unknown';
  const v = val.trim().toLowerCase();
  if (!v) return 'unknown';
  const map: Record<string, string> = {
    intraday: 'intraday', day: 'intraday',
    short: 'short', 'short-term': 'short',
    mid: 'mid', 'mid-term': 'mid', 'medium-term': 'mid',
    long: 'long', 'long-term': 'long',
    unknown: 'unknown', unknow: 'unknown',
    '日内': 'intraday', '短线': 'short', '短期': 'short',
    '中期': 'mid', '长期': 'long',
    '未知': 'unknown', '不确定': 'unknown', '暂不明确': 'unknown',
  };
  return map[v] ?? map[val.trim()] ?? 'unknown';
}

/** confidence 归一化 */
function normalizeConfidence(val: unknown): string {
  if (typeof val === 'number' && Number.isFinite(val)) {
    // 区分 0-1 和 0-100 两种尺度
    if (val <= 1) {
      if (val >= 0.7) return 'high';
      if (val >= 0.35) return 'medium';
      return 'low';
    }
    if (val >= 80) return 'high';
    if (val >= 40) return 'medium';
    return 'low';
  }
  if (typeof val === 'string') {
    const map: Record<string, string> = { low: 'low', medium: 'medium', high: 'high', '低': 'low', '中': 'medium', '高': 'high', '较低': 'low', '中等': 'medium', '较高': 'high' };
    return map[val.trim().toLowerCase()] ?? map[val.trim()] ?? 'low';
  }
  return 'low';
}

/** 字段名别名映射，兼容 AI 输出的非标准字段名 */
const FIELD_ALIASES: Record<string, string> = {
  evidence_strength: 'grade',
  to_verify: 'needs_check',
  negative_factors: 'penalty_factors',
};

/** 递归归一化 */
export function normalizeAiOutput(obj: unknown): unknown {
  if (typeof obj !== 'object' || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(normalizeAiOutput);

  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
    // 先处理字段名别名
    const normalizedKey = FIELD_ALIASES[key] ?? key;
    if (normalizedKey === 'stance') result[normalizedKey] = normalizeStance(val);
    else if (normalizedKey === 'time_horizon') result[normalizedKey] = normalizeHorizon(val);
    else if (normalizedKey === 'confidence') result[normalizedKey] = normalizeConfidence(val);
    else result[normalizedKey] = normalizeField(normalizedKey, normalizeAiOutput(val));
  }
  return result;
}
