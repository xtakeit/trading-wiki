import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import { RAG_FILES } from '@/lib/storage/paths';

interface RagChunkRaw {
  id: string;
  docId: string;
  docPath: string;
  docType: string;
  title: string;
  headingPath: string[];
  content: string;
  date?: string;
  author?: string;
  platform?: string;
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

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    const docId = url.searchParams.get('docId');

    if (!id && !docId) {
      return NextResponse.json({ ok: false, error: 'need id or docId' }, { status: 400 });
    }

    const chunks = await readJsonLines<RagChunkRaw>(RAG_FILES.chunks);

    if (id) {
      const idx = chunks.findIndex((c) => c.id === id);
      if (idx === -1) {
        return NextResponse.json({ ok: false, error: 'chunk not found' }, { status: 404 });
      }
      return NextResponse.json({
        ok: true,
        data: {
          chunk: chunks[idx],
          prevChunk: idx > 0 ? chunks[idx - 1] : null,
          nextChunk: idx < chunks.length - 1 ? chunks[idx + 1] : null,
        },
      });
    }

    // docId mode: return all chunks for a document
    const docChunks = chunks.filter((c) => c.docId === docId);
    return NextResponse.json({
      ok: true,
      data: { chunks: docChunks },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
