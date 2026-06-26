import { NextResponse } from 'next/server';
import { readTraces, readTraceById } from '@/lib/rag/trace';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 200);

  try {
    if (id) {
      const trace = await readTraceById(id);
      if (!trace) {
        return NextResponse.json({ ok: false, error: 'trace not found' }, { status: 404 });
      }
      return NextResponse.json({ ok: true, data: trace });
    }

    const traces = await readTraces(limit);
    return NextResponse.json({ ok: true, data: traces });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
