import type { SourcedItem } from '@/lib/types/document';
import type { ValueChainLayer, EvidenceItem } from '@/lib/types/theme';

/** 按行分割文本，去空白、去空行 */
export function parseLines(value: string): string[] {
  return value
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 将字符串数组合并为每行一个 */
export function stringifyLines(lines: string[]): string {
  return (lines ?? []).join('\n');
}

/** 解析 sourced item 格式的行（格式: "text [source]" 或纯文本） */
export function parseSourcedLines(value: string): SourcedItem[] {
  return value
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(.+?)\s+\[(.+?)\]$/);
      if (match) {
        return { text: match[1].trim(), source: match[2].trim() as SourcedItem['source'] };
      }
      return { text: line.replace(/^-\s*/, '').trim(), source: 'unknown' as const };
    });
}

/** 将 sourced item 数组转换为每行一个的显示格式 */
export function stringifySourcedLines(items: SourcedItem[]): string {
  return (items ?? [])
    .map((item) => {
      const src = item.source && item.source !== 'unknown' ? ` [${item.source}]` : '';
      return `${item.text}${src}`;
    })
    .join('\n');
}

// ===== 新类型的序列化/反序列化工具 =====

/** 将 ValueChainLayer[] 序列化为每层一段的文本 */
export function stringifyValueChainLayers(layers: ValueChainLayer[]): string {
  return (layers ?? []).map((layer) => {
    const lines = [`## ${layer.layer_name}`];
    if (layer.description) lines.push(layer.description);
    if (layer.companies.length) lines.push(`公司: ${layer.companies.join(', ')}`);
    if (layer.bottlenecks.length) {
      lines.push('卡点:');
      layer.bottlenecks.forEach((b) => lines.push(`- ${b.text}${b.source !== 'unknown' ? ` [${b.source}]` : ''}`));
    }
    return lines.join('\n');
  }).join('\n\n');
}

/** 将纯文本解析为 ValueChainLayer[] */
export function parseValueChainLayers(value: string): ValueChainLayer[] {
  const blocks = value.split(/^## /m).filter(Boolean);
  return blocks.map((block) => {
    const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
    const layer_name = lines[0] || '';
    const descriptionLine = lines.find((l) => !l.startsWith('公司:') && !l.startsWith('卡点:') && !l.startsWith('-'));
    const description = descriptionLine && descriptionLine !== layer_name ? descriptionLine : '';
    const companiesMatch = lines.find((l) => l.startsWith('公司:'));
    const companies = companiesMatch
      ? companiesMatch.replace('公司:', '').split(',').map((s) => s.trim()).filter(Boolean)
      : [];
    const bottleneckLines = lines.filter((l) => l.startsWith('- '));
    const bottlenecks = bottleneckLines.map((l) => parseSourcedLines(l.replace(/^- /, ''))).flat();
    return { layer_name, description, companies, bottlenecks };
  });
}

/** 将 EvidenceItem[] 序列化为每行一条 */
export function stringifyEvidenceTable(items: EvidenceItem[]): string {
  return (items ?? []).map((item) => {
    let line = `${item.claim} [${item.grade}]`;
    if (item.support) line += ` | ${item.support}`;
    if (item.needs_check) line += ` | 需核: ${item.needs_check}`;
    return line;
  }).join('\n');
}

/** 将纯文本解析为 EvidenceItem[] */
export function parseEvidenceTable(value: string): EvidenceItem[] {
  return value.split('\n').map((l) => l.trim()).filter(Boolean).map((line) => {
    const gradeMatch = line.match(/\[(strong|medium|weak)\]/);
    const parts = line.replace(/\[(strong|medium|weak)\]/, '').split('|').map((s) => s.trim());
    return {
      claim: parts[0] || line,
      grade: (gradeMatch?.[1] as EvidenceItem['grade']) ?? 'medium',
      support: parts[1] || '',
      needs_check: parts[2]?.replace(/^需核:\s*/, '') || '',
    };
  });
}

/** 将 Scorecard 序列化为文本 */
export function stringifyScorecard(scorecard: { positive_factors?: Array<{ factor: string; detail: string; weight?: number }>; penalty_factors?: Array<{ factor: string; detail: string; weight?: number }> } | undefined): string {
  if (!scorecard) return '';
  const lines: string[] = [];
  if (scorecard.positive_factors?.length) {
    lines.push('--- 正面因素 ---');
    scorecard.positive_factors.forEach((f) => lines.push(`${f.factor} | ${f.detail}${f.weight ? ` | ${f.weight}` : ''}`));
  }
  if (scorecard.penalty_factors?.length) {
    lines.push('--- 负面因素 ---');
    scorecard.penalty_factors.forEach((f) => lines.push(`${f.factor} | ${f.detail}${f.weight ? ` | ${f.weight}` : ''}`));
  }
  return lines.join('\n');
}

/** 将纯文本解析为 Scorecard */
export function parseScorecard(value: string): { positive_factors: Array<{ factor: string; detail: string; weight?: number }>; penalty_factors: Array<{ factor: string; detail: string; weight?: number }> } {
  const result = { positive_factors: [] as Array<{ factor: string; detail: string; weight?: number }>, penalty_factors: [] as Array<{ factor: string; detail: string; weight?: number }> };
  let current = result.positive_factors;
  value.split('\n').forEach((l) => {
    const line = l.trim();
    if (!line) return;
    if (line === '--- 正面因素 ---') { current = result.positive_factors; return; }
    if (line === '--- 负面因素 ---') { current = result.penalty_factors; return; }
    const parts = line.split('|').map((s) => s.trim());
    current.push({
      factor: parts[0] || '',
      detail: parts[1] || '',
      weight: parts[2] ? Number(parts[2]) : undefined,
    });
  });
  return result;
}
