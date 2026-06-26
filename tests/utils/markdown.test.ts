import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../../lib/utils/markdown';

describe('renderMarkdown', () => {
  it('should render headings', () => {
    const result = renderMarkdown('# 标题一\n## 标题二\n### 标题三');
    expect(result).toContain('<h1 class="md-heading md-h1">标题一</h1>');
    expect(result).toContain('<h2 class="md-heading md-h2">标题二</h2>');
    expect(result).toContain('<h3 class="md-heading md-h3">标题三</h3>');
  });

  it('should render bold and italic', () => {
    const result = renderMarkdown('这是 **粗体** 和 *斜体*');
    expect(result).toContain('<strong>粗体</strong>');
    expect(result).toContain('<em>斜体</em>');
  });

  it('should render inline code', () => {
    const result = renderMarkdown('使用 `const x = 1` 声明变量');
    expect(result).toContain('<code class="md-inline-code">const x = 1</code>');
  });

  it('should render code blocks', () => {
    const result = renderMarkdown('```ts\nconst x = 1;\n```');
    expect(result).toContain('<pre class="md-code-block" data-lang="ts"><code>');
    expect(result).toContain('const x = 1;');
    expect(result).toContain('</code></pre>');
  });

  it('should render links', () => {
    const result = renderMarkdown('查看 [文档](https://example.com)');
    expect(result).toContain(
      '<a href="https://example.com" class="md-link" target="_blank" rel="noopener">文档</a>',
    );
  });

  it('should render unordered lists', () => {
    const result = renderMarkdown('- 项目一\n- 项目二\n- 项目三');
    expect(result).toContain('<ul class="md-list md-ul">');
    expect(result).toContain('<li>项目一</li>');
    expect(result).toContain('<li>项目二</li>');
    expect(result).toContain('<li>项目三</li>');
    expect(result).toContain('</ul>');
  });

  it('should render ordered lists', () => {
    const result = renderMarkdown('1. 第一步\n2. 第二步\n3. 第三步');
    expect(result).toContain('<ol class="md-list md-ol">');
    expect(result).toContain('<li>第一步</li>');
    expect(result).toContain('</ol>');
  });

  it('should render paragraphs', () => {
    const result = renderMarkdown('第一段文字。\n\n第二段文字。');
    expect(result).toContain('<p class="md-paragraph">第一段文字。</p>');
    expect(result).toContain('<p class="md-paragraph">第二段文字。</p>');
  });

  it('should escape HTML in text', () => {
    const result = renderMarkdown('<script>alert("xss")</script>');
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
  });

  it('should render horizontal rules', () => {
    const result = renderMarkdown('---');
    expect(result).toContain('<hr class="md-hr" />');
  });

  it('should render a complete document', () => {
    const md = `# 测试文档

## 章节一

这是**重要**内容，包含 *强调* 和 \`代码\`。

- 列表项 1
- 列表项 2

## 章节二

1. 第一
2. 第二

更多信息请查看[链接](https://example.com)。
`;
    const result = renderMarkdown(md);
    // 应该包含多种元素
    expect(result).toContain('<h1');
    expect(result).toContain('<h2');
    expect(result).toContain('<strong>重要</strong>');
    expect(result).toContain('<ul');
    expect(result).toContain('<ol');
    expect(result).toContain('<a href="https://example.com"');
  });

  it('should handle empty input', () => {
    const result = renderMarkdown('');
    expect(result).toBe('');
  });

  it('should handle code blocks with no language', () => {
    const result = renderMarkdown('```\nplain code\n```');
    expect(result).toContain('<pre class="md-code-block"><code>');
    expect(result).toContain('plain code');
  });
});
