'use client';

import { useMemo, useState } from 'react';
import type { DocumentIndexItem } from '@/lib/types/document';
import { DocumentList } from './document-list';
import { getDocumentHref } from '@/lib/utils/display';

interface FilterConfig {
  /** 是否显示作者筛选 */
  showAuthor?: boolean;
  /** 是否显示平台筛选 */
  showPlatform?: boolean;
  /** 是否显示立场筛选 */
  showStance?: boolean;
  /** 立场选项（仅 viewpoint 类型需要） */
  stanceOptions?: Array<{ value: string; label: string }>;
  /** 列表页面的新建链接 */
  newItemHref?: string;
  /** 新建按钮文案 */
  newItemLabel?: string;
}

interface FilterableDocumentListProps {
  items: DocumentIndexItem[];
  emptyTitle: string;
  emptyDescription: string;
  filterConfig?: FilterConfig;
}

export function FilterableDocumentList({
  items,
  emptyTitle,
  emptyDescription,
  filterConfig,
}: FilterableDocumentListProps) {
  const [searchText, setSearchText] = useState('');
  const [filterAuthor, setFilterAuthor] = useState('');
  const [filterPlatform, setFilterPlatform] = useState('');
  const [filterStance, setFilterStance] = useState('');
  const [filterTheme, setFilterTheme] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  const filtered = useMemo(() => {
    let result = items;

    // 全文搜索（标题 + 摘要）
    if (searchText.trim()) {
      const q = searchText.trim().toLowerCase();
      result = result.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.summary.toLowerCase().includes(q),
      );
    }

    // 作者筛选
    if (filterAuthor.trim()) {
      const q = filterAuthor.trim().toLowerCase();
      result = result.filter((item) =>
        item.author?.toLowerCase().includes(q),
      );
    }

    // 平台筛选
    if (filterPlatform.trim()) {
      const q = filterPlatform.trim().toLowerCase();
      result = result.filter((item) =>
        item.platform?.toLowerCase().includes(q),
      );
    }

    // 立场筛选
    if (filterStance) {
      result = result.filter((item) => item.stance === filterStance);
    }

    // 主题筛选
    if (filterTheme.trim()) {
      const q = filterTheme.trim().toLowerCase();
      result = result.filter((item) =>
        item.themes.some((t) => t.toLowerCase().includes(q)),
      );
    }

    // 标签筛选
    if (filterTag.trim()) {
      const q = filterTag.trim().toLowerCase();
      result = result.filter((item) =>
        item.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }

    // 日期范围筛选
    if (filterDateFrom) {
      result = result.filter(
        (item) => item.date && item.date >= filterDateFrom,
      );
    }
    if (filterDateTo) {
      result = result.filter(
        (item) => item.date && item.date <= filterDateTo,
      );
    }

    return result;
  }, [
    items,
    searchText,
    filterAuthor,
    filterPlatform,
    filterStance,
    filterTheme,
    filterTag,
    filterDateFrom,
    filterDateTo,
  ]);

  const hasFilters =
    searchText ||
    filterAuthor ||
    filterPlatform ||
    filterStance ||
    filterTheme ||
    filterTag ||
    filterDateFrom ||
    filterDateTo;

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      {/* 筛选栏 */}
      <div className="glass-card form-card">
        <div className="form-section-title">
          筛选{hasFilters ? `（${filtered.length} 条结果）` : ''}
        </div>

        <div className="inline-grid">
          <label className="form-field">
            <span>搜索标题/摘要</span>
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="输入关键词筛选..."
            />
          </label>

          {filterConfig?.showAuthor ? (
            <label className="form-field">
              <span>作者</span>
              <input
                value={filterAuthor}
                onChange={(e) => setFilterAuthor(e.target.value)}
                placeholder="按作者筛选"
              />
            </label>
          ) : null}

          {filterConfig?.showPlatform ? (
            <label className="form-field">
              <span>平台</span>
              <input
                value={filterPlatform}
                onChange={(e) => setFilterPlatform(e.target.value)}
                placeholder="如 雪球、微博"
              />
            </label>
          ) : null}

          {filterConfig?.showStance ? (
            <label className="form-field">
              <span>立场</span>
              <select
                value={filterStance}
                onChange={(e) => setFilterStance(e.target.value)}
              >
                <option value="">全部</option>
                {(filterConfig.stanceOptions ?? []).map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="form-field">
            <span>主题</span>
            <input
              value={filterTheme}
              onChange={(e) => setFilterTheme(e.target.value)}
              placeholder="如 AI算力"
            />
          </label>

          <label className="form-field">
            <span>标签</span>
            <input
              value={filterTag}
              onChange={(e) => setFilterTag(e.target.value)}
              placeholder="按标签筛选"
            />
          </label>
        </div>

        <div className="inline-grid">
          <label className="form-field">
            <span>起始日期</span>
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
            />
          </label>
          <label className="form-field">
            <span>结束日期</span>
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
            />
          </label>
        </div>

        {hasFilters ? (
          <div className="form-actions">
            <button
              className="primary-button"
              onClick={() => {
                setSearchText('');
                setFilterAuthor('');
                setFilterPlatform('');
                setFilterStance('');
                setFilterTheme('');
                setFilterTag('');
                setFilterDateFrom('');
                setFilterDateTo('');
              }}
              type="button"
            >
              清除筛选
            </button>
          </div>
        ) : null}
      </div>

      {/* 文档列表 */}
      <DocumentList
        items={filtered}
        emptyTitle={hasFilters ? '没有匹配的文档' : emptyTitle}
        emptyDescription={
          hasFilters
            ? '尝试调整筛选条件或清除筛选。'
            : emptyDescription
        }
        getItemHref={(item) => getDocumentHref(item.type, item.id)}
      />
    </div>
  );
}
