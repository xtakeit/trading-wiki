import { listMarkdownDocuments } from '@/lib/storage/md-store';
import type { RagSourceDocument } from '@/lib/rag/types';

export async function loadRagSourceDocuments(): Promise<RagSourceDocument[]> {
  return listMarkdownDocuments();
}
