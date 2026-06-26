import {
  buildGenerateReviewSystemPrompt,
  buildGenerateReviewUserPrompt,
} from '@/lib/ai/prompts';
import { callDeepSeekStructuredOutput } from '@/lib/ai/model';
import { retrieveRelevantChunks } from '@/lib/rag/retrieve';
import type {
  DailyReviewGenerationResult,
  GenerateReviewInput,
} from '@/lib/types/review';
import { dailyReviewGenerationSchema } from '@/lib/types/review';

function buildRagQuery(input: GenerateReviewInput): string {
  return [
    input.date,
    input.marketSummary,
    input.sectorPerformance,
    input.newsCatalysts,
    input.personalObservation,
    ...input.selectedViewpoints.map((item) => `${item.title} ${item.summary}`),
  ]
    .map((item) => item.trim())
    .filter(Boolean)
    .join('\n');
}

export async function generateReview(
  input: GenerateReviewInput,
): Promise<DailyReviewGenerationResult> {
  const ragContext =
    input.ragContext && input.ragContext.length > 0
      ? input.ragContext
      : (
          await retrieveRelevantChunks({
            query: input.ragQuery?.trim() || buildRagQuery(input),
            topK: 4,
          })
        ).map((item) => ({
          id: item.chunk.id,
          docId: item.chunk.docId,
          docPath: item.chunk.docPath,
          docType: item.chunk.docType,
          title: item.chunk.title,
          headingPath: item.chunk.headingPath,
          content: item.chunk.content,
          date: item.chunk.date,
          author: item.chunk.author,
          platform: item.chunk.platform,
          score: item.finalScore,
        }));

  return callDeepSeekStructuredOutput(dailyReviewGenerationSchema, {
    system: buildGenerateReviewSystemPrompt(),
    user: buildGenerateReviewUserPrompt({
      ...input,
      ragContext,
    }),
  });
}
