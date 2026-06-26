import { NextResponse } from 'next/server';
import { z } from 'zod';
import { generateThemeResearch } from '@/lib/ai/generate-theme-research';

const requestSchema = z.object({
  themeName: z.string().min(1, '主题名称不能为空'),
  rawMaterials: z.string(),
  personalObservation: z.string(),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const input = requestSchema.parse(json);
    const result = await generateThemeResearch(input);

    return NextResponse.json({
      ok: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          ok: false,
          error: error.flatten(),
        },
        { status: 400 },
      );
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
