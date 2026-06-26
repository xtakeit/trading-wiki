import { rebuildRagIndex } from '@/lib/rag/rebuild';

async function main() {
  await rebuildRagIndex();
  const meta = await import('@/lib/storage/paths').then((m) =>
    import('node:fs/promises').then((fs) =>
      fs.readFile(m.RAG_FILES.meta, 'utf8').then((c) => JSON.parse(c)),
    ),
  );
  console.log(
    `RAG index built successfully. documents=${meta.documentCount} chunks=${meta.chunkCount}`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
