import {
  buildGenerateThemeResearchSystemPrompt,
  buildGenerateThemeResearchUserPrompt,
} from '@/lib/ai/prompts';
import { callDeepSeekStructuredOutput } from '@/lib/ai/model';
import type {
  GenerateThemeResearchInput,
  ThemeResearchResult,
} from '@/lib/types/theme';
import { themeResearchGenerationSchema } from '@/lib/types/theme';

export async function generateThemeResearch(
  input: GenerateThemeResearchInput,
): Promise<ThemeResearchResult> {
  return callDeepSeekStructuredOutput(themeResearchGenerationSchema, {
    system: buildGenerateThemeResearchSystemPrompt(),
    user: buildGenerateThemeResearchUserPrompt(input),
  });
}
