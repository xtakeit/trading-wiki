import {
  buildGenerateStockProfileSystemPrompt,
  buildGenerateStockProfileUserPrompt,
} from '@/lib/ai/prompts';
import { callDeepSeekStructuredOutput } from '@/lib/ai/model';
import type {
  GenerateStockProfileInput,
  StockProfileResult,
} from '@/lib/types/stock';
import { stockProfileGenerationSchema } from '@/lib/types/stock';

export async function generateStockProfile(
  input: GenerateStockProfileInput,
): Promise<StockProfileResult> {
  return callDeepSeekStructuredOutput(stockProfileGenerationSchema, {
    system: buildGenerateStockProfileSystemPrompt(),
    user: buildGenerateStockProfileUserPrompt(input),
  });
}
