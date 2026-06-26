import { describe, expect, it } from 'vitest';
import { extractJsonObject } from '@/lib/ai/model';

describe('deepseek model helpers', () => {
  it('extracts fenced json content', () => {
    const result = extractJsonObject('```json\n{"ok":true}\n```');
    expect(result).toBe('{"ok":true}');
  });

  it('extracts plain json object content', () => {
    const result = extractJsonObject('前置说明 {"ok":true,"count":1} 后置说明');
    expect(result).toBe('{"ok":true,"count":1}');
  });
});
