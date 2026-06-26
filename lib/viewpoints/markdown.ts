import type { ViewpointExtractionResult } from '@/lib/types/viewpoint';

function renderSection(title: string, items: string[]): string {
  if (!items.length) {
    return `## ${title}\n资料不足`;
  }

  return `## ${title}\n${items.map((item) => `- ${item}`).join('\n')}`;
}

export function buildViewpointMarkdown(params: {
  title: string;
  rawText: string;
  extraction: ViewpointExtractionResult;
}): string {
  const { extraction, rawText, title } = params;

  return [
    `# ${title}`,
    '',
    '## 原始发言',
    rawText.trim(),
    '',
    '## AI 摘要',
    extraction.summary || '资料不足',
    '',
    renderSection('涉及方向', extraction.mentioned_themes),
    '',
    renderSection('核心观点', extraction.opinions.map(function(i) { return i.text; })),
    '',
    renderSection('事实依据', extraction.facts.map(function(i) { return i.text; })),
    '',
    renderSection('推理链条', extraction.reasoning.map(function(i) { return i.text; })),
    '',
    renderSection('风险点', extraction.risks.map(function(i) { return i.text; })),
    '',
    renderSection('反证与警惕', extraction.counter_evidence.map(function(i) { return i.text; })),
    '',
    '## 后续验证',
    '请结合后续公告、行业数据和市场表现继续人工验证。',
  ].join('\n');
}
