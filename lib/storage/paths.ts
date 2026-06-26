import path from 'node:path';
import { mkdir } from 'node:fs/promises';

export const ROOT_DIR = process.cwd();
export const DATA_DIR = path.join(ROOT_DIR, 'data');
export const RAG_DIR = path.join(ROOT_DIR, 'rag');

export const DATA_DIRECTORIES = {
  dailyReviews: path.join(DATA_DIR, 'daily-reviews'),
  viewpoints: path.join(DATA_DIR, 'viewpoints'),
  themes: path.join(DATA_DIR, 'themes'),
  stocks: path.join(DATA_DIR, 'stocks'),
  notes: path.join(DATA_DIR, 'notes'),
  rawPosts: path.join(DATA_DIR, 'raw', 'posts'),
  rawNews: path.join(DATA_DIR, 'raw', 'news'),
  rawMarket: path.join(DATA_DIR, 'raw', 'market'),
  rawXueqiu: path.join(DATA_DIR, 'raw', 'xueqiu'),
  qa: path.join(DATA_DIR, 'qa'),
  materials: path.join(DATA_DIR, 'materials'),
} as const;

export const INDEX_FILE = path.join(DATA_DIR, 'index.json');
export const RAG_FILES = {
  chunks: path.join(RAG_DIR, 'chunks.jsonl'),
  embeddings: path.join(RAG_DIR, 'embeddings.jsonl'),
  meta: path.join(RAG_DIR, 'index-meta.json'),
} as const;

export async function ensureProjectDirectories(): Promise<void> {
  await Promise.all([
    mkdir(DATA_DIR, { recursive: true }),
    mkdir(RAG_DIR, { recursive: true }),
    ...Object.values(DATA_DIRECTORIES).map((directory) =>
      mkdir(directory, { recursive: true }),
    ),
  ]);
}
