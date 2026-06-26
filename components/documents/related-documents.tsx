import Link from 'next/link';
import type { DocumentIndexItem } from '@/lib/types/document';
import { getDocumentTypeBadgeClass, getDocumentTypeLabel, getDocumentHref } from '@/lib/utils/display';

interface GroupedRelated {
  label: string;
  items: DocumentIndexItem[];
}

interface RelatedDocumentsProps {
  groups: GroupedRelated[];
}

/**
 * 在详情页底部展示关联文档，按类型分组。
 * 匹配逻辑在服务端完成，此组件只负责渲染。
 */
export function RelatedDocuments({ groups }: RelatedDocumentsProps) {
  const nonEmpty = groups.filter((g) => g.items.length > 0);
  if (!nonEmpty.length) return null;

  return (
    <section className="glass-card">
      <div className="form-section-title" style={{ marginBottom: 16 }}>
        关联文档
      </div>
      <div style={{ display: 'grid', gap: 16 }}>
        {nonEmpty.map((group) => (
          <div key={group.label}>
            <div className="rag-group-header">{group.label}</div>
            <div className="document-list">
              {group.items.map((item) => (
                <Link
                  key={item.id}
                  href={getDocumentHref(item.type, item.id)}
                  className="document-row"
                >
                  <div className="document-row-head">
                    <span className="document-row-title" style={{ fontSize: 16 }}>
                      {item.title}
                    </span>
                    <span className={`type-badge ${getDocumentTypeBadgeClass(item.type)}`}>
                      {getDocumentTypeLabel(item.type)}
                    </span>
                  </div>
                  <div className="document-row-summary">
                    {item.summary.slice(0, 200)}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

