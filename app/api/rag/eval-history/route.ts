import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'data/rag-eval/results.jsonl');
    const source = await readFile(filePath, 'utf8');
    const entries = source
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line));

    return NextResponse.json({ ok: true, data: entries });
  } catch {
    return NextResponse.json({ ok: true, data: [] });
  }
}
