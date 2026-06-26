import { buildLocalDocumentIndex } from '@/lib/storage/build-index';
import { ensureProjectDirectories } from '@/lib/storage/paths';

async function main() {
  await ensureProjectDirectories();
  const items = await buildLocalDocumentIndex();
  console.log(`Indexed ${items.length} markdown documents.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
