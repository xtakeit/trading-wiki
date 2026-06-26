import type { StockProfileResult, StockViewpointContext } from '@/lib/types/stock';

function renderSection(title: string, items: string[]): string {
  if (!items.length) return `## ${title}\n资料不足`;
  return `## ${title}\n${items.map((item) => `- ${item}`).join('\n')}`;
}

export function buildStockProfileMarkdown(params: {
  title: string;
  stockName: string;
  themes: string[];
  companyInfo: string;
  announcements: string;
  news: string;
  viewpointSummary: string;
  personalObservation: string;
  selectedViewpoints?: StockViewpointContext[];
  result: StockProfileResult;
  /** 追加的新资料 */
  appendedMaterials?: string;
}): string {
  const { title, companyInfo, announcements, news, viewpointSummary, personalObservation, selectedViewpoints, result, appendedMaterials } = params;
  const generatedAt = new Date().toISOString();

  const viewpointRefs = selectedViewpoints?.length
    ? selectedViewpoints.map((v) => `- ${v.title}（${v.author ?? '未知'} · ${v.date ?? '未知'}）：${v.summary}`).join('\n')
    : null;

  return [
    `# ${title}`,
    '',
    `> 生成时间: ${generatedAt}`,
    '',
    '---',
    '',
    '## 引用素材',
    '',
    '### 公司资料',
    companyInfo.trim() || '资料不足',
    '',
    '### 公告信息',
    announcements.trim() || '资料不足',
    '',
    '### 新闻信息',
    news.trim() || '资料不足',
    '',
    '### 关注人观点汇总',
    viewpointSummary.trim() || '资料不足',
    '',
    appendedMaterials
      ? `#### 追加资料（增量更新）\n\n${appendedMaterials.trim()}\n`
      : '',
    '## 个人观察',
    personalObservation.trim() || '资料不足',
    '',
    '---',
    '',
    '## 一、公司主营',
    result.main_business || '资料不足',
    '',
    '## 二、产业链位置',
    result.industry_chain_position || '资料不足',
    '',
    '## 三、核心上涨逻辑',
    result.core_upside_logic || '资料不足',
    '',
    '## 四、历史行情记录',
    result.historical_performance || '资料不足',
    '',
    '## 五、关注人观点',
    result.viewpoint_summary || viewpointSummary.trim() || '资料不足',
    '',
    viewpointRefs ? `### 关联观点蒸馏\n${viewpointRefs}\n` : '',
    renderSection('六、催化事件', result.catalysts.map(function(i) { return i.text; })),
    '',
    '## 七、估值锚',
    result.valuation_anchor || '资料不足',
    '',
    renderSection('八、风险点', result.risks.map(function(i) { return i.text; })),
    '',
    '## 九、个人判断',
    result.personal_judgment || personalObservation.trim() || '资料不足',
    '',
    renderSection('十、后续验证', result.follow_up_items),
  ].join('\n');
}

/** 从 Markdown 正文解析原始输入（用于编辑时回填表单） */
export function parseStockMarkdown(content: string): {
  personalObservation: string;
  linkedViewpointTitles: string[];
} {
  const s = (re: RegExp) => {
    const m = content.match(re);
    return (m?.[1] || '').trim();
  };
  const vpMatch = content.match(/### 关联观点蒸馏\n+([\s\S]*?)(?=\n### |\n## |$)/);
  const vpText = vpMatch?.[1] || '';
  const linkedViewpointTitles = vpText
    .split('\n')
    .filter((line) => line.startsWith('- '))
    .map((line) => {
      const titleMatch = line.match(/^- (.+?)（/);
      return titleMatch?.[1]?.trim() || '';
    })
    .filter(Boolean);

  return {
    personalObservation: s(/## 个人观察\n+([\s\S]*?)(?=\n---|\n## |$)/),
    linkedViewpointTitles,
  };
}
