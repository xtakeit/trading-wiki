import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHero } from '@/components/documents/page-hero';
import { AppShell } from '@/components/layout/app-shell';
import { DocumentEditor } from '@/components/documents/document-editor';
import { getDocumentById } from '@/lib/server/documents';

interface NoteEditPageProps {
  params: Promise<{ id: string }>;
}

export default async function NoteEditPage({
  params,
}: NoteEditPageProps) {
  const { id } = await params;
  const document = await getDocumentById(decodeURIComponent(id));

  if (!document || document.frontmatter.type !== 'note') {
    notFound();
  }

  return (
    <AppShell currentPath="/notes">
      <div className="page-stack-fluid">
        <PageHero
          title={`编辑：${document.title}`}
          description="修改 frontmatter 字段或直接编辑 Markdown 正文。"
          extra={
            <Link href={`/notes/${encodeURIComponent(id)}`} className="app-nav-link">
              返回详情
            </Link>
          }
        />

        <DocumentEditor
          documentId={id}
          documentType="note"
          initialFrontmatter={document.frontmatter}
          initialContent={document.content}
        />
      </div>
    </AppShell>
  );
}
