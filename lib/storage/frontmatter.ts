import matter from 'gray-matter';
import type { DocumentFrontmatter } from '@/lib/types/document';

export interface ParsedMarkdown<
  TFrontmatter extends DocumentFrontmatter = DocumentFrontmatter,
> {
  frontmatter: TFrontmatter;
  content: string;
}

function normalizeFrontmatterValue(key: string, value: unknown): unknown {
  if (value instanceof Date) {
    if (key === 'date') {
      return value.toISOString().slice(0, 10);
    }

    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeFrontmatterValue(key, item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        normalizeFrontmatterValue(entryKey, entryValue),
      ]),
    );
  }

  return value;
}

export function parseFrontmatter<TFrontmatter extends DocumentFrontmatter>(
  source: string,
): ParsedMarkdown<TFrontmatter> {
  const parsed = matter(source);
  const normalizedData = Object.fromEntries(
    Object.entries(parsed.data).map(([key, value]) => [
      key,
      normalizeFrontmatterValue(key, value),
    ]),
  );

  return {
    frontmatter: normalizedData as unknown as TFrontmatter,
    content: parsed.content.trim(),
  };
}

export function stringifyFrontmatter<TFrontmatter extends DocumentFrontmatter>(
  frontmatter: TFrontmatter,
  content: string,
): string {
  // 过滤掉 undefined 值（YAML 不支持 undefined，只支持 null）
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(frontmatter as Record<string, unknown>)) {
    if (value !== undefined) {
      clean[key] = value;
    }
  }
  return `${matter.stringify(content.trim(), clean).trim()}\n`;
}
