import Link from 'next/link';
import { FileText } from 'lucide-react';
import type { ComponentProps } from 'react';
import type { DocumentIndexItem } from '@/lib/types/document';
import { getDocumentTypeLabel, getDocumentTypeBadgeClass, getViewpointStanceLabel } from '@/lib/utils/display';

export interface DocumentListProps {
  items: DocumentIndexItem[];
  emptyTitle?: string;
  emptyDescription?: string;
  getItemHref?: (item: DocumentIndexItem) => ComponentProps<typeof Link>['href'] | undefined;
}

const stanceColors: Record<string, { bg: string; text: string }> = {
  bullish: { bg: 'rgba(224,144,144,0.1)', text: '#e09090' },
  bearish: { bg: 'rgba(140,216,176,0.1)', text: '#8cd8b0' },
  neutral: { bg: 'rgba(176,196,216,0.1)', text: '#b0c4d8' },
  watch: { bg: 'rgba(212,177,106,0.1)', text: '#d4b16a' },
};

function StanceBadge({ stance }: { stance: string }) {
  const c = stanceColors[stance] ?? stanceColors.watch;
  return (
    <span style={{
      display: 'inline-block', borderRadius: 5, padding: '2px 7px', fontSize: 10,
      fontWeight: 600, background: c.bg, color: c.text, border: `1px solid ${c.text}22`,
    }}>
      {getViewpointStanceLabel(stance as 'bullish' | 'bearish' | 'neutral' | 'watch')}
    </span>
  );
}

export function DocumentList({
  items,
  emptyTitle = '还没有文档',
  emptyDescription = '先运行示例数据脚本，或开始创建第一篇本地 Markdown 文档。',
  getItemHref,
}: DocumentListProps) {
  if (!items.length) {
    return (
      <div className="glass-card empty-state">
        <FileText size={36} style={{ opacity: 0.2 }} />
        <strong>{emptyTitle}</strong>
        <span className="text-muted">{emptyDescription}</span>
      </div>
    );
  }

  return (
    <div className="document-list">
      {items.map((item) => {
        const href = getItemHref?.(item);
        const content = (
          <>
            <div className="document-row-head">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span className={`type-badge ${getDocumentTypeBadgeClass(item.type)}`}>
                  {getDocumentTypeLabel(item.type)}
                </span>
                {item.stance ? <StanceBadge stance={item.stance} /> : null}
                {item.author ? (
                  <span className="meta-pill">{item.author}</span>
                ) : null}
                {item.date ? (
                  <span className="meta-pill">{item.date}</span>
                ) : null}
              </div>
            </div>
            <div className="document-row-title" style={{ fontSize: 15, marginTop: 2 }}>
              {item.title}
            </div>
            {item.summary ? (
              <div className="document-row-summary">
                {item.summary.slice(0, 180).replace(/\n/g, ' ')}{item.summary.length > 180 ? '...' : ''}
              </div>
            ) : null}
            {item.themes.length > 0 ? (
              <div className="tag-list">
                {item.themes.slice(0, 6).map((theme) => (
                  <span className="tag" key={`${item.id}-th-${theme}`}>{theme}</span>
                ))}
                {item.themes.length > 6 ? (
                  <span className="meta-pill">+{item.themes.length - 6}</span>
                ) : null}
              </div>
            ) : null}
          </>
        );

        if (href) {
          return (
            <Link key={item.id} href={href} className="document-row">
              {content}
            </Link>
          );
        }
        return (
          <article key={item.id} className="document-row">
            {content}
          </article>
        );
      })}
    </div>
  );
}
