import { NextResponse } from 'next/server';
import { z } from 'zod';
import { extractViewpoint } from '@/lib/ai/extract-viewpoint';
import { viewpointPlatforms } from '@/lib/types/viewpoint';

const requestSchema = z.object({
  rawText: z.string().min(1, '原始发言不能为空'),
  author: z.string().min(1, '作者不能为空'),
  platform: z.enum(viewpointPlatforms),
  date: z.string().min(1, '日期不能为空'),
  source: z.string().trim().optional(),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const input = requestSchema.parse(json);
    const result = await extractViewpoint(input);

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
