import type { ThemeResearchResult, ValueChainLayer, EvidenceItem } from '@/lib/types/theme';

function renderSection(title: string, items: string[]): string {
  if (!items.length) return `## ${title}\n资料不足`;
  return `## ${title}\n${items.map((item) => `- ${item}`).join('\n')}`;
}

/** 渲染多层价值链 */
function renderValueChainLayers(layers: ValueChainLayer[]): string {
  if (!layers?.length) return '';
  const parts = layers.map(
    (layer) =>
      `### ${layer.layer_name}\n${layer.description}\n核心公司: ${layer.companies.join(', ') || '无'}\n${
        layer.bottlenecks?.length
          ? `卡点:\n${layer.bottlenecks.map((b) => `- ${b.text}${b.source !== 'unknown' ? ` [${b.source}]` : ''}`).join('\n')}`
          : '卡点: 无'
      }`,
  );
  return `## 价值链全图\n\n${parts.join('\n\n')}`;
}

/** 渲染证据表 */
function renderEvidenceTable(items: EvidenceItem[]): string {
  if (!items?.length) return '';
  const rows = items.map(
    (item) =>
      `| ${item.claim} | ${item.grade === 'strong' ? '强' : item.grade === 'medium' ? '中' : '弱'} | ${item.support} | ${item.needs_check} |${item.source_ref ? ` ${item.source_ref} |` : ' |'}`,
  );
  return `## 证据表\n\n| 声明 | 强度 | 支持依据 | 待核查 | 来源 |\n|------|------|---------|--------|------|\n${rows.join('\n')}`;
}

/** 渲染评分卡 */
function renderScorecard(scorecard: NonNullable<ThemeResearchResult['scorecard']>): string {
  const parts: string[] = ['## 评分卡\n'];
  if (scorecard.positive_factors?.length) {
    parts.push('### 正面因素');
    scorecard.positive_factors.forEach((f) => {
      parts.push(`- ${f.factor}: ${f.detail}${f.weight ? `（权重: ${f.weight}）` : ''}`);
    });
  }
  if (scorecard.penalty_factors?.length) {
    parts.push('### 负面因素');
    scorecard.penalty_factors.forEach((f) => {
      parts.push(`- ${f.factor}: ${f.detail}${f.weight ? `（权重: ${f.weight}）` : ''}`);
    });
  }
  if (scorecard.summary) {
    parts.push(`\n**综合判断**: ${scorecard.summary}`);
  }
  return parts.join('\n');
}

export function buildThemeResearchMarkdown(params: {
  title: string;
  themeName: string;
  rawMaterials: string;
  personalObservation: string;
  result: ThemeResearchResult;
  appendedMaterials?: string;
}): string {
  const { rawMaterials, personalObservation, result, title } = params;
  const generatedAt = new Date().toISOString();

  const sections: string[] = [
    `# ${title}`,
    '',
    `> 生成时间: ${generatedAt}`,
    '',
    '---',
    '',
    '## 引用素材',
    '',
    rawMaterials.trim() || '资料不足',
    '',
    '## 个人观察',
    '',
    personalObservation.trim() || '资料不足',
    '',
    '---',
    '',
    '## 一、产业链位置',
    result.industry_chain_position || '资料不足',
    '',
    '## 二、资金流',
    result.capital_flow || '资料不足',
    '',
    '## 三、实物流',
    result.physical_flow || '资料不足',
    '',
    '## 四、利润流',
    result.profit_flow || '资料不足',
    '',
    renderSection('五、上游', result.upstream),
    '',
    renderSection('六、中游', result.midstream),
    '',
    renderSection('七、下游', result.downstream),
    '',
    renderSection('八、当前卡点', result.bottlenecks.map(function(i) { return i.text; })),
    '',
    renderSection('九、核心公司', result.core_companies),
    '',
    renderSection('十、催化日历', result.catalysts.map(function(i) { return i.text; })),
    '',
    renderSection('十一、风险传导', result.risks.map(function(i) { return i.text; })),
  ];

  // 新增可选节段（仅当对应字段存在时输出）
  if (result.value_chain_layers?.length) {
    sections.push('', renderValueChainLayers(result.value_chain_layers));
  }
  if (result.evidence_table?.length) {
    sections.push('', renderEvidenceTable(result.evidence_table));
  }
  if (result.failure_conditions?.length) {
    sections.push('', renderSection('十四、证伪条件', result.failure_conditions));
  }
  if (result.next_steps?.length) {
    sections.push('', renderSection('十五、下一步研究', result.next_steps));
  }
  if (result.scorecard) {
    sections.push('', renderScorecard(result.scorecard));
  }

  // 个人判断
  sections.push('', `## ${result.scorecard ? '十七' : '十二'}、个人判断`);
  sections.push(result.personal_judgment || personalObservation.trim() || '资料不足');

  return sections.join('\n');
}

/** 从 Markdown 正文解析原始输入（用于编辑时回填表单） */
export function parseThemeMarkdown(content: string): {
  personalObservation: string;
} {
  const obsMatch = content.match(/## 个人观察\n+([\s\S]*?)(?=\n---|\n## |$)/);
  return {
    personalObservation: (obsMatch?.[1] || '').trim(),
  };
}
