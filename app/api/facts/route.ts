import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createFactSchema, updateFactSchema } from '@/lib/types/fact';
import { readFacts, createFact, updateFact, deleteFact } from '@/lib/storage/fact-store';

export async function GET() {
  try {
    const facts = await readFacts();
    // 按更新时间降序
    facts.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return NextResponse.json({ ok: true, data: facts });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const input = createFactSchema.parse(json);
    const fact = await createFact(input);
    return NextResponse.json({ ok: true, data: fact }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: error.flatten() },
        { status: 400 },
      );
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const json = await request.json();
    const input = updateFactSchema.parse(json);
    const fact = await updateFact(input);

    if (!fact) {
      return NextResponse.json(
        { ok: false, error: '断言不存在' },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true, data: fact });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: error.flatten() },
        { status: 400 },
      );
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = z
      .object({ id: z.string().min(1) })
      .parse(await request.json());

    const deleted = await deleteFact(id);
    if (!deleted) {
      return NextResponse.json(
        { ok: false, error: '断言不存在' },
        { status: 404 },
      );
    }

    return NextResponse.json({ ok: true, data: { id } });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: error.flatten() },
        { status: 400 },
      );
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
