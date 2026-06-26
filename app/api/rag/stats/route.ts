import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { RAG_FILES, DATA_DIR } from '@/lib/storage/paths';
import { readFileSync } from 'node:fs';

interface RagChunkRaw {
  id: string;
  docId: string;
  docPath: string;
  docType: string;
  title: string;
  headingPath: string[];
  content: string;
  date?: string;
  stocks?: string[];
  themes?: string[];
  tags?: string[];
}

async function readJsonLines<T>(filePath: string): Promise<T[]> {
  try {
    const source = await readFile(filePath, 'utf8');
    return source
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as T);
  } catch {
    return [];
  }
}

export async function GET() {
  try {
    // 基础统计
    let meta: { generatedAt?: string; chunkCount?: number; embeddingDimension?: number } = {};
    try {
      meta = JSON.parse(await readFile(RAG_FILES.meta, 'utf8'));
    } catch { /* ignore */ }

    const chunks = await readJsonLines<RagChunkRaw>(RAG_FILES.chunks);
    const embeddings = await readJsonLines<{ id: string }>(RAG_FILES.embeddings);
    const embedIds = new Set(embeddings.map((e) => e.id));

    // 异常分析
    const abnormal: Array<{ id: string; reason: string; detail: string }> = [];

    for (const chunk of chunks) {
      if (chunk.content.length < 50) {
        abnormal.push({ id: chunk.id, reason: 'chunk_too_short', detail: `${chunk.content.length} chars` });
      }
      if (chunk.content.length > 2000) {
        abnormal.push({ id: chunk.id, reason: 'chunk_too_long', detail: `${chunk.content.length} chars` });
      }
      if (!chunk.docType) {
        abnormal.push({ id: chunk.id, reason: 'missing_docType', detail: 'docType is empty' });
      }
      if (!chunk.title || chunk.title.trim().length === 0) {
        abnormal.push({ id: chunk.id, reason: 'missing_title', detail: 'title is empty' });
      }
      if (!embedIds.has(chunk.id)) {
        abnormal.push({ id: chunk.id, reason: 'missing_embedding', detail: `no embedding for ${chunk.id}` });
      }
    }

    // 过期文档：docPath 指向的文件已不存在
    const staleDocIds: string[] = [];
    for (const chunk of chunks) {
      const fullPath = path.join(process.cwd(), chunk.docPath);
      try {
        readFileSync(fullPath, 'utf8');
      } catch {
        if (!staleDocIds.includes(chunk.docId)) {
          staleDocIds.push(chunk.docId);
        }
      }
    }

    return NextResponse.json({
      ok: true,
      data: {
        docCount: new Set(chunks.map((c) => c.docId)).size,
        chunkCount: chunks.length,
        embeddingCount: embeddings.length,
        missingEmbeddingCount: chunks.filter((c) => !embedIds.has(c.id)).length,
        embeddingModel: 'Xenova/bge-small-zh-v1.5',
        embeddingDim: meta.embeddingDimension ?? 512,
        lastBuiltAt: meta.generatedAt,
        staleDocCount: staleDocIds.length,
        staleDocIds,
        abnormalChunkCount: abnormal.length,
        abnormalChunks: abnormal.slice(0, 50),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
