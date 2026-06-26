import { NextResponse } from 'next/server';
import { z } from 'zod';
import { generateStockProfile } from '@/lib/ai/generate-stock-profile';

const requestSchema = z.object({
  stockName: z.string().min(1, '公司名称不能为空'),
  themes: z.array(z.string()),
  companyInfo: z.string(),
  announcements: z.string(),
  news: z.string(),
  viewpointSummary: z.string(),
  personalObservation: z.string(),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const input = requestSchema.parse(json);
    const result = await generateStockProfile(input);

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
