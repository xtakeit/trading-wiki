import type {
  DailyReviewGenerationResult,
  ReviewContextItem,
  ReviewRagContextItem,
} from '@/lib/types/review';

function renderListSection(title: string, items: string[]): string {
  if (!items.length) {
    return `## ${title}\n资料不足`;
  }

  return `## ${title}\n${items.map((item) => `- ${item}`).join('\n')}`;
}

export function buildReviewMarkdown(params: {
  title: string;
  inputs: {
    marketSummary: string;
    sectorPerformance: string;
    newsCatalysts: string;
    personalObservation: string;
    selectedViewpoints: ReviewContextItem[];
    ragContext?: ReviewRagContextItem[];
  };
  result: DailyReviewGenerationResult;
}): string {
  const { inputs, result, title } = params;
  const viewpointSummary = inputs.selectedViewpoints.length
    ? inputs.selectedViewpoints
        .map(
          (item) =>
            `- ${item.title}${item.author ? ` / ${item.author}` : ''}: ${item.summary}`,
        )
        .join('\n')
    : '资料不足';
  const ragSummary = inputs.ragContext?.length
    ? inputs.ragContext
        .map((item) => {
          const heading = item.headingPath.length ? item.headingPath.join(' > ') : '正文';
          return `- ${item.title} / ${heading}: ${item.content.slice(0, 120)}`;
        })
        .join('\n')
    : '资料不足';

  return [
    `# ${title}`,
    '',
    '## 一、市场环境',
    inputs.marketSummary.trim() || '资料不足',
    '',
    '## 二、情绪周期',
    `市场阶段: ${result.market_phase}`,
    `情绪分数: ${result.sentiment_score}`,
    '',
    '## 三、资金流向',
    result.capital_flow_path || '资料不足',
    '',
    renderListSection('四、主线板块', result.main_themes),
    '',
    renderListSection('五、核心个股', result.core_stocks),
    '',
    '## 六、关注人观点共识与分歧',
    viewpointSummary,
    '',
    renderListSection('观点分歧详情', result.divergence.map(function(i) { return i.text; })),
    '',
    '## 七、历史资料对照',
    ragSummary,
    '',
    renderListSection('八、明日观察点', result.watchpoints),
    '',
    renderListSection('九、风险传导', result.risks.map(function(i) { return i.text; })),
    '',
    '## 十、个人备注',
    inputs.personalObservation.trim() || '资料不足',
    '',
    renderListSection('补充事实', result.facts.map(function(i) { return i.text; })),
    '',
    renderListSection('补充推理', result.inferences.map(function(i) { return i.text; })),
    '',
    '## 结论',
    result.conclusion || '资料不足',
    '',
    '## 原始输入参考',
    `板块表现: ${inputs.sectorPerformance.trim() || '资料不足'}`,
    `新闻催化: ${inputs.newsCatalysts.trim() || '资料不足'}`,
  ].join('\n');
}
