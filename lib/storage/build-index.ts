import type { DocumentIndexItem } from '@/lib/types/document';
import { listMarkdownDocuments } from '@/lib/storage/md-store';
import { documentToIndexItem, writeDocumentIndex } from '@/lib/storage/index-store';

function compareByDate(a: DocumentIndexItem, b: DocumentIndexItem): number {
  const left = a.date ?? '';
  const right = b.date ?? '';

  return right.localeCompare(left) || a.title.localeCompare(b.title, 'zh-Hans-CN');
}

export async function buildLocalDocumentIndex(): Promise<DocumentIndexItem[]> {
  const documents = await listMarkdownDocuments();
  const items = documents.map(documentToIndexItem).sort(compareByDate);
  await writeDocumentIndex(items);
  return items;
}
