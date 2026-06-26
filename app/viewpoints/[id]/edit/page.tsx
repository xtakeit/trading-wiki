import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHero } from '@/components/documents/page-hero';
import { AppShell } from '@/components/layout/app-shell';
import { DocumentEditor } from '@/components/documents/document-editor';
import { getDocumentById } from '@/lib/server/documents';
import {
  getViewpointConfidenceLabel,
  getViewpointStanceLabel,
  getViewpointTimeHorizonLabel,
} from '@/lib/utils/display';

interface ViewpointEditPageProps {
  params: Promise<{ id: string }>;
}

export default async function ViewpointEditPage({
  params,
}: ViewpointEditPageProps) {
  const { id } = await params;
  const document = await getDocumentById(decodeURIComponent(id));

  if (!document || document.frontmatter.type !== 'viewpoint') {
    notFound();
  }

  const fm = document.frontmatter;

  return (
    <AppShell currentPath="/viewpoints">
      <div className="page-stack-fluid">
        <PageHero
          title={`编辑：${document.title}`}
          description="修改 frontmatter 字段或直接编辑 Markdown 正文，保存后索引自动更新。"
          extra={
            <Link href={`/viewpoints/${encodeURIComponent(id)}`} className="app-nav-link">
              返回详情
            </Link>
          }
        />

        <DocumentEditor
          documentId={id}
          documentType="viewpoint"
          initialFrontmatter={fm}
          initialContent={document.content}
          frontmatterFields={[
            { key: 'author', label: '作者', value: fm.author ?? '' },
            { key: 'platform', label: '平台', value: fm.platform ?? '' },
            {
              key: 'stance',
              label: '立场',
              value: fm.stance
                ? getViewpointStanceLabel(fm.stance as 'bullish' | 'bearish' | 'neutral' | 'watch')
                : '',
            },
            {
              key: 'time_horizon',
              label: '时间周期',
              value: fm.time_horizon
                ? getViewpointTimeHorizonLabel(fm.time_horizon as 'intraday' | 'short' | 'mid' | 'long' | 'unknown')
                : '',
            },
            {
              key: 'confidence',
              label: '置信度',
              value: fm.confidence
                ? getViewpointConfidenceLabel(fm.confidence as 'low' | 'medium' | 'high')
                : '',
            },
          ]}
        />
      </div>
    </AppShell>
  );
}
