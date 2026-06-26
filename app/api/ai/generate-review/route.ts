import { NextResponse } from 'next/server';
import { z } from 'zod';
import { generateReview } from '@/lib/ai/generate-review';
import { documentTypes } from '@/lib/types/document';

const ragContextItemSchema = z.object({
  id: z.string(),
  docId: z.string(),
  docPath: z.string(),
  docType: z.enum(documentTypes),
  title: z.string(),
  headingPath: z.array(z.string()),
  content: z.string(),
  date: z.string().optional(),
  author: z.string().optional(),
  platform: z.string().optional(),
  score: z.number().optional(),
});

const requestSchema = z.object({
  date: z.string().min(1, '日期不能为空'),
  marketSummary: z.string(),
  sectorPerformance: z.string(),
  newsCatalysts: z.string(),
  personalObservation: z.string(),
  ragQuery: z.string().optional(),
  ragContext: z.array(ragContextItemSchema).optional(),
  selectedViewpoints: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      summary: z.string(),
      author: z.string().optional(),
      date: z.string().optional(),
    }),
  ),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();
    const input = requestSchema.parse(json);
    const result = await generateReview(input);

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
