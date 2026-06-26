import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { VerifiableFact, FactWindow } from '@/lib/types/fact';
import { DATA_DIR } from '@/lib/storage/paths';

const FACTS_FILE = path.join(DATA_DIR, 'facts', 'predictions.jsonl');

async function ensureFactsFile(): Promise<void> {
  await mkdir(path.dirname(FACTS_FILE), { recursive: true });
}

/** 读取所有断言 */
export async function readFacts(): Promise<VerifiableFact[]> {
  await ensureFactsFile();
  try {
    const content = await readFile(FACTS_FILE, 'utf8');
    return content
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line) as VerifiableFact);
  } catch {
    return [];
  }
}

/** 写入所有断言（全量覆盖） */
async function writeFacts(facts: VerifiableFact[]): Promise<void> {
  await ensureFactsFile();
  const content = facts.map((f) => JSON.stringify(f)).join('\n') + '\n';
  await writeFile(FACTS_FILE, content, 'utf8');
}

/** 创建断言 */
export async function createFact(input: {
  claim: string;
  sourceDocId?: string;
  sourceDocType?: string;
  sourceTitle?: string;
  stocks?: string[];
  themes?: string[];
  evidenceLevel?: string;
  windows?: FactWindow[];
  notes?: string;
}): Promise<VerifiableFact> {
  const facts = await readFacts();
  const now = new Date().toISOString();

  const fact: VerifiableFact = {
    id: randomUUID(),
    claim: input.claim,
    sourceDocId: input.sourceDocId ?? '',
    sourceDocType: input.sourceDocType ?? '',
    sourceTitle: input.sourceTitle ?? '',
    stocks: input.stocks ?? [],
    themes: input.themes ?? [],
    evidenceLevel: (input.evidenceLevel as VerifiableFact['evidenceLevel']) ?? 'D',
    state: 'pending',
    windows: input.windows ?? defaultWindows(now),
    notes: input.notes ?? '',
    createdAt: now,
    updatedAt: now,
  };

  facts.push(fact);
  await writeFacts(facts);
  return fact;
}

/** 更新断言 */
export async function updateFact(input: {
  id: string;
  claim?: string;
  state?: string;
  stocks?: string[];
  themes?: string[];
  evidenceLevel?: string;
  windows?: FactWindow[];
  notes?: string;
}): Promise<VerifiableFact | null> {
  const facts = await readFacts();
  const index = facts.findIndex((f) => f.id === input.id);
  if (index === -1) return null;

  const existing = facts[index];
  const updated: VerifiableFact = {
    ...existing,
    claim: input.claim ?? existing.claim,
    state: (input.state as VerifiableFact['state']) ?? existing.state,
    stocks: input.stocks ?? existing.stocks,
    themes: input.themes ?? existing.themes,
    evidenceLevel: (input.evidenceLevel as VerifiableFact['evidenceLevel']) ?? existing.evidenceLevel,
    windows: input.windows ?? existing.windows,
    notes: input.notes ?? existing.notes,
    updatedAt: new Date().toISOString(),
  };

  // 自动推断 state：如果所有窗口都有结果，取多数
  if (input.windows && input.windows.length > 0) {
    const results = input.windows
      .filter((w) => w.result && w.result !== 'pending')
      .map((w) => w.result!);
    if (results.length === input.windows.length) {
      const confirmed = results.filter((r) => r === 'confirmed').length;
      const falsified = results.filter((r) => r === 'falsified').length;
      if (confirmed > falsified) {
        updated.state = 'confirmed';
      } else if (falsified > confirmed) {
        updated.state = 'falsified';
      } else {
        updated.state = 'insufficient';
      }
    }
  }

  facts[index] = updated;
  await writeFacts(facts);
  return updated;
}

/** 删除断言 */
export async function deleteFact(id: string): Promise<boolean> {
  const facts = await readFacts();
  const filtered = facts.filter((f) => f.id !== id);
  if (filtered.length === facts.length) return false;
  await writeFacts(filtered);
  return true;
}

function defaultWindows(now: string): FactWindow[] {
  const base = new Date(now);
  const windows = [
    { label: '1日', days: 1 },
    { label: '3日', days: 3 },
    { label: '5日', days: 5 },
    { label: '10日', days: 10 },
    { label: '20日', days: 20 },
    { label: '30日', days: 30 },
    { label: '90日', days: 90 },
    { label: '180日', days: 180 },
  ];

  return windows.map((w) => {
    const due = new Date(base);
    due.setDate(due.getDate() + w.days);
    return {
      label: w.label,
      dueDate: due.toISOString().slice(0, 10),
      result: null,
      note: '',
    };
  });
}
