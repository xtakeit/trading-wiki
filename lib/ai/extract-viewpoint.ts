import {
  buildExtractViewpointSystemPrompt,
  buildExtractViewpointUserPrompt,
} from '@/lib/ai/prompts';
import { callDeepSeekStructuredOutput } from '@/lib/ai/model';
import type {
  ExtractViewpointInput,
  ViewpointExtractionResult,
} from '@/lib/types/viewpoint';
import { viewpointExtractionSchema } from '@/lib/types/viewpoint';

export async function extractViewpoint(
  input: ExtractViewpointInput,
): Promise<ViewpointExtractionResult> {
  return callDeepSeekStructuredOutput<ViewpointExtractionResult>(
    viewpointExtractionSchema,
    {
      system: buildExtractViewpointSystemPrompt(),
      user: buildExtractViewpointUserPrompt(input),
    },
  );
}
