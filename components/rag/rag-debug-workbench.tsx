'use client';

import { useState, useEffect, useCallback } from 'react';
import type { DocumentType } from '@/lib/types/document';
import type { RagSearchHit } from '@/lib/rag/types';
import type { RetrievalTrace } from '@/lib/rag/trace';
import { getDocumentTypeLabel, DOC_TYPE_OPTIONS } from '@/lib/utils/display';

// ---- Types ----

interface RagSearchResponse {
  ok: boolean; data?: RagSearchHit[]; error?: unknown;
}

interface TracesResponse {
  ok: boolean; data?: RetrievalTrace[]; error?: unknown;
}

interface IndexStats {
  docCount: number; chunkCount: number; embeddingCount: number;
  missingEmbeddingCount: number; embeddingModel: string; embeddingDim: number;
  lastBuiltAt?: string; staleDocCount: number; abnormalChunkCount: number;
  abnormalChunks?: Array<{ id: string; reason: string; detail: string }>;
}

interface ChunkDetailData {
  chunk: { id: string; docId: string; docPath: string; docType: string; title: string; headingPath: string[]; content: string; date?: string; author?: string; stocks?: string[]; themes?: string[]; tags?: string[] };
  prevChunk: unknown | null; nextChunk: unknown | null;
}

interface ContextPreviewData {
  query: string; rewrittenQuery?: string; intent?: string;
  contextChunks: Array<{ rank: number; chunkId: string; title: string; contextLine: string }>;
  contextText: string;
  stats: { totalChars: number; estimatedTokens: number; chunkCount: number };
}

// ---- Index Health Card ----

function IndexHealthCard() {
  const [stats, setStats] = useState<IndexStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetch('/api/rag/stats')
      .then((r) => r.json())
      .then((d) => { if (d.ok) setStats(d.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-muted" style={{ fontSize: 12, padding: 8 }}>加载索引状态...</div>;
  if (!stats) return null;

  const issues = stats.abnormalChunkCount + stats.staleDocCount + stats.missingEmbeddingCount;

  return (
    <div className="glass-card" style={{ padding: 10, marginBottom: 12, fontSize: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <strong>索引健康</strong>
        {issues > 0
          ? <span style={{ color: '#e8a87c' }}>⚠ {issues} 个问题</span>
          : <span style={{ color: '#8cd8b0' }}>✅ 正常</span>}
      </div>
      <div className="text-muted" style={{ fontSize: 11, lineHeight: 1.6 }}>
        文档 {stats.docCount} · Chunk {stats.chunkCount} · {stats.embeddingModel.split('/')[1]}
      </div>
      {issues > 0 && (
        <button className="ghost-button" onClick={() => setExpanded((v) => !v)} type="button" style={{ fontSize: 11, marginTop: 4 }}>
          {expanded ? '收起详情' : '查看详情'}
        </button>
      )}
      {expanded && (
        <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          <div>缺失 embedding: {stats.missingEmbeddingCount}</div>
          <div>过期文档: {stats.staleDocCount}</div>
          <div>异常 chunk: {stats.abnormalChunkCount}</div>
          <div>维度: {stats.embeddingDim}</div>
          {stats.lastBuiltAt && <div>构建: {new Date(stats.lastBuiltAt).toLocaleString()}</div>}
          {stats.abnormalChunks && stats.abnormalChunks.length > 0 && (
            <details style={{ marginTop: 4 }}>
              <summary style={{ cursor: 'pointer' }}>异常列表</summary>
              {stats.abnormalChunks.slice(0, 10).map((a) => (
                <div key={a.id} style={{ fontSize: 10, wordBreak: 'break-all', marginTop: 2 }}>
                  [{a.reason}] {a.id.slice(0, 40)} — {a.detail}
                </div>
              ))}
            </details>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Chunk Detail Drawer ----

function ChunkDetailDrawer({ chunkId, onClose }: { chunkId: string; onClose: () => void }) {
  const [data, setData] = useState<ChunkDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`/api/rag/chunks?id=${encodeURIComponent(chunkId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setData(d.data);
        else setError(d.error || '加载失败');
      })
      .catch(() => setError('请求失败'))
      .finally(() => setLoading(false));
  }, [chunkId]);

  return (
    <div style={{ marginTop: 8, padding: 10, background: 'rgba(212, 177, 106, 0.05)', borderRadius: 8, border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <strong style={{ fontSize: 13 }}>Chunk 详情</strong>
        <button className="ghost-button" onClick={onClose} type="button" style={{ fontSize: 11 }}>关闭</button>
      </div>
      {loading ? <div className="text-muted" style={{ fontSize: 12 }}>加载中...</div> : error ? <div style={{ fontSize: 12, color: '#e8a87c' }}>{error}</div> : data ? (
        <div style={{ fontSize: 12, lineHeight: 1.6 }}>
          <div style={{ marginBottom: 6 }}>
            <strong>{data.chunk.title}</strong>
            <span className="text-muted" style={{ marginLeft: 6 }}>
              [{data.chunk.docType}] · {data.chunk.date ?? ''}
            </span>
          </div>
          {data.chunk.headingPath.length > 0 && (
            <div className="text-muted" style={{ fontSize: 11, marginBottom: 4 }}>
              路径: {data.chunk.headingPath.join(' > ')}
            </div>
          )}
          <div className="text-muted" style={{ fontSize: 11, marginBottom: 4 }}>
            ID: {data.chunk.id} · 路径: {data.chunk.docPath}
          </div>
          {data.chunk.stocks && data.chunk.stocks.length > 0 && (
            <div style={{ marginBottom: 2 }}>股票: {data.chunk.stocks.join(', ')}</div>
          )}
          {data.chunk.themes && data.chunk.themes.length > 0 && (
            <div style={{ marginBottom: 2 }}>主题: {data.chunk.themes.join(', ')}</div>
          )}
          {data.chunk.tags && data.chunk.tags.length > 0 && (
            <div className="text-muted" style={{ marginBottom: 2 }}>标签: {data.chunk.tags.join(', ')}</div>
          )}
          <div style={{ marginTop: 6, padding: 6, background: 'rgba(0,0,0,0.15)', borderRadius: 4, fontSize: 11, whiteSpace: 'pre-wrap', maxHeight: 300, overflowY: 'auto' }}>
            {data.chunk.content}
          </div>
          {data.prevChunk ? (
            <div className="text-muted" style={{ marginTop: 6, borderTop: '1px solid var(--border)', paddingTop: 4, fontSize: 10 }}>
              上一个 chunk: {(data.prevChunk as Record<string, string>).title ?? ''}
            </div>
          ) : null}
          {data.nextChunk ? (
            <div className="text-muted" style={{ marginTop: 2, fontSize: 10 }}>
              下一个 chunk: {(data.nextChunk as Record<string, string>).title ?? ''}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// ---- Context Preview ----

function ContextPreviewPanel({ query, results }: { query: string; results: RagSearchHit[] }) {
  const [preview, setPreview] = useState<ContextPreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadPreview = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/rag/preview-context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, topK: 8 }),
      });
      const payload = await res.json();
      if (payload.ok) setPreview(payload.data);
      else setError(typeof payload.error === 'string' ? payload.error : '加载失败');
    } catch { setError('请求失败'); }
    finally { setLoading(false); }
  }, [query]);

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
        <strong style={{ fontSize: 13 }}>Prompt 上下文预览</strong>
        <button className="ghost-button" onClick={loadPreview} disabled={loading || !query.trim()} type="button" style={{ fontSize: 11 }}>
          {loading ? '组装中...' : '预览上下文'}
        </button>
      </div>
      {error ? <div style={{ fontSize: 12, color: '#e8a87c' }}>{error}</div> : null}
      {preview ? (
        <div style={{ fontSize: 12 }}>
          <div className="text-muted" style={{ marginBottom: 4 }}>
            {preview.intent ? `意图: ${preview.intent}` : ''}
            {preview.rewrittenQuery ? ` | 改写: ${preview.rewrittenQuery}` : ''}
            {' | '}{preview.stats.chunkCount} 条 · ~{preview.stats.estimatedTokens} tokens · {preview.stats.totalChars} 字符
          </div>
          <div style={{ maxHeight: 400, overflowY: 'auto', padding: 8, background: 'rgba(143, 164, 194, 0.06)', borderRadius: 6, fontSize: 11, whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
            {preview.contextText}
          </div>
        </div>
      ) : (
        <div className="text-muted" style={{ fontSize: 12 }}>
          执行检索后点击「预览上下文」查看最终注入模型的资料。
        </div>
      )}
    </div>
  );
}

// ---- Search Tab ----

function SearchTab() {
  const [query, setQuery] = useState('');
  const [docTypes, setDocTypes] = useState<DocumentType[]>([]);
  const [results, setResults] = useState<RagSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedChunkId, setSelectedChunkId] = useState<string | null>(null);

  function toggleDocType(type: DocumentType) {
    setDocTypes((current) =>
      current.includes(type) ? current.filter((item) => item !== type) : [...current, type],
    );
  }

  async function handleSearch() {
    if (!query.trim()) { setError('请输入检索词。'); return; }
    setLoading(true); setError(''); setSelectedChunkId(null); setResults([]);
    try {
      const response = await fetch('/api/rag/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, topK: 8, docTypes: docTypes.length ? docTypes : undefined }),
      });
      const payload = (await response.json()) as RagSearchResponse;
      if (!response.ok || !payload.ok || !payload.data) {
        throw new Error(typeof payload.error === 'string' ? payload.error : '检索失败');
      }
      setResults(payload.data);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : '检索失败');
    } finally { setLoading(false); }
  }

  return (
    <div className="section-grid" style={{ gridTemplateColumns: '320px 1fr' }}>
      {/* Left column */}
      <div>
        <IndexHealthCard />

        <section className="glass-card form-card" style={{ padding: 12 }}>
          <div className="form-section-title">检索参数</div>
          <label className="form-field">
            <span>Query</span>
            <textarea rows={4} value={query} onChange={(e) => setQuery(e.target.value)} style={{ fontSize: 13 }} />
          </label>
          <div className="form-field">
            <span>文档类型过滤</span>
            <div className="checkbox-list" style={{ maxHeight: 200, overflowY: 'auto' }}>
              {DOC_TYPE_OPTIONS.map((item) => (
                <label key={item.value} className="checkbox-item" style={{ fontSize: 12 }}>
                  <input type="checkbox" checked={docTypes.includes(item.value)} onChange={() => toggleDocType(item.value)} />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>
          </div>
          {error ? <div className="status-message status-error">{error}</div> : null}
          <div className="form-actions">
            <button className="primary-button" disabled={loading} onClick={handleSearch} type="button">
              {loading ? '检索中...' : '执行检索'}
            </button>
          </div>
        </section>
      </div>

      {/* Right column */}
      <div>
        <section className="glass-card form-card" style={{ padding: 12 }}>
          <div className="form-section-title">
            检索结果
            {results.length > 0 && <span className="text-muted" style={{ fontWeight: 400, marginLeft: 6 }}>（{results.length} 条）</span>}
          </div>
          {results.length > 0 ? (
            <div>
              <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-secondary)', padding: '4px 8px', borderBottom: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '30px 60px 60px 60px 60px 1fr', gap: 4 }}>
                <span>#</span><span>总分</span><span>向量</span><span>关键词</span><span>元数据</span><span>标题</span>
              </div>
              {results.map((item, i) => (
                <div
                  key={item.chunk.id}
                  onClick={() => setSelectedChunkId(selectedChunkId === item.chunk.id ? null : item.chunk.id)}
                  style={{
                    cursor: 'pointer',
                    padding: '6px 8px',
                    borderBottom: '1px solid var(--border)',
                    background: selectedChunkId === item.chunk.id ? 'rgba(212, 177, 106, 0.08)' : undefined,
                    fontSize: 12,
                    display: 'grid',
                    gridTemplateColumns: '30px 60px 60px 60px 60px 1fr',
                    gap: 4,
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{i + 1}</span>
                  <span style={{ fontWeight: 600 }}>{(item.finalScore * 100).toFixed(1)}</span>
                  <span className="text-muted">{(item.vectorScore * 100).toFixed(1)}</span>
                  <span className="text-muted">{(item.keywordScore * 100).toFixed(1)}</span>
                  <span className="text-muted">{(item.metadataScore * 100).toFixed(1)}</span>
                  <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span style={{ fontWeight: 500 }}>{item.chunk.title}</span>
                    <span className="text-muted" style={{ marginLeft: 4, fontSize: 10 }}>[{getDocumentTypeLabel(item.chunk.docType)}]</span>
                  </div>
                </div>
              ))}

              {/* Chunk Detail */}
              {selectedChunkId && (
                <ChunkDetailDrawer
                  chunkId={selectedChunkId}
                  onClose={() => setSelectedChunkId(null)}
                />
              )}

              {/* Context Preview */}
              <ContextPreviewPanel query={query} results={results} />
            </div>
          ) : (
            <div className="text-muted" style={{ padding: 12 }}>输入检索词后可在这里查看命中的 chunks。</div>
          )}
        </section>
      </div>
    </div>
  );
}

// ---- Traces Tab ----

function TracesTab() {
  const [traces, setTraces] = useState<RetrievalTrace[]>([]);
  const [selectedTrace, setSelectedTrace] = useState<RetrievalTrace | null>(null);
  const [loading, setLoading] = useState(true);

  const loadTraces = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/rag/traces?limit=30');
      const payload = (await res.json()) as TracesResponse;
      if (payload.ok && payload.data) setTraces(payload.data);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadTraces(); }, [loadTraces]);

  return (
    <div className="section-grid" style={{ gridTemplateColumns: '350px 1fr' }}>
      <section className="glass-card form-card" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
        <div className="form-section-title">
          历史 Trace
          <button className="ghost-button" onClick={loadTraces} type="button" style={{ fontSize: 11, marginLeft: 8 }}>刷新</button>
        </div>
        {loading ? <div className="text-muted" style={{ padding: 12 }}>加载中...</div> : traces.length === 0 ? (
          <div className="text-muted" style={{ padding: 12 }}>暂无 trace 数据，先使用知识库问答提问。</div>
        ) : (
          <div className="checkbox-list">
            {traces.map((t) => (
              <div
                key={t.id}
                className="checkbox-item"
                style={{ cursor: 'pointer', background: selectedTrace?.id === t.id ? 'rgba(212, 177, 106, 0.1)' : undefined }}
                onClick={() => setSelectedTrace(t)}
              >
                <div>
                  <strong style={{ fontSize: 13 }}>{t.query.slice(0, 60)}</strong>
                  <div className="text-muted" style={{ fontSize: 11 }}>
                    {t.intent ? `意图: ${t.intent}` : ''}
                    {t.rewrittenQuery ? ` | 改写: ${t.rewrittenQuery.slice(0, 40)}` : ''}
                  </div>
                  <div className="text-muted" style={{ fontSize: 10 }}>
                    {t.timestamp ? new Date(t.timestamp).toLocaleString() : ''}
                    {' | '}{t.totalCandidates} 候选
                    {t.rerankUsed ? ' | rerank' : ''}
                    {t.mmrUsed ? ' | MMR' : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="glass-card form-card" style={{ maxHeight: '80vh', overflowY: 'auto' }}>
        <div className="form-section-title">Trace 详情</div>
        {selectedTrace ? (
          <div>
            <div style={{ marginBottom: 12, padding: '8px 12px', background: 'rgba(143, 164, 194, 0.06)', borderRadius: 8, fontSize: 13 }}>
              <div><strong>原始问题:</strong> {selectedTrace.query}</div>
              {selectedTrace.rewrittenQuery ? <div><strong>改写检索:</strong> {selectedTrace.rewrittenQuery}</div> : null}
              <div style={{ display: 'flex', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
                {selectedTrace.intent ? <span className="meta-pill">意图: {selectedTrace.intent}</span> : null}
                {selectedTrace.routeMethod ? <span className="tag">路由: {selectedTrace.routeMethod}</span> : null}
              {selectedTrace.intentScores && selectedTrace.intentScores.length > 0 ? (
                <details style={{ marginTop: 4, fontSize: 11 }}>
                  <summary style={{ cursor: 'pointer', color: 'var(--text-secondary)' }}>
                    意图评分明细
                  </summary>
                  <div style={{ marginTop: 4, display: 'grid', gap: 2 }}>
                    {selectedTrace.intentScores.map((s: {intent:string;score:number;matched:string[]}) => (
                      <div key={s.intent} style={{ display: 'flex', gap: 8, padding: '2px 4px', background: 'rgba(143, 164, 194, 0.04)', borderRadius: 4 }}>
                        <span style={{ width: 90 }}>{s.intent}</span>
                        <span style={{ width: 40, textAlign: 'right', fontWeight: s.score > 0 ? 700 : 400 }}>
                          {s.score.toFixed(2)}
                        </span>
                        <span className="text-muted" style={{ fontSize: 10 }}>
                          {s.matched?.join(', ') || ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </details>
              ) : null}
                {selectedTrace.weights ? (
                  <span className="tag">权重: v={selectedTrace.weights.vector} kw={selectedTrace.weights.keyword} md={selectedTrace.weights.metadata} fr={selectedTrace.weights.freshness}</span>
                ) : null}
              </div>
              {selectedTrace.totalCandidates ? (
                <div className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>
                  {selectedTrace.totalCandidates} 候选 · rerank: {selectedTrace.rerankUsed ? '✅' : '❌'} · MMR: {selectedTrace.mmrUsed ? '✅' : '❌'}
                </div>
              ) : null}
            </div>

            <div className="form-section-title" style={{ fontSize: 12, marginTop: 8 }}>Top K 结果</div>
            <div className="checkbox-list">
              {selectedTrace.topK?.map((c, i) => (
                <div key={c.chunkId} className="checkbox-item">
                  <span style={{ fontWeight: 700, fontSize: 11, color: 'var(--accent)', minWidth: 24 }}>#{i + 1}</span>
                  <div style={{ flex: 1 }}>
                    <strong style={{ fontSize: 13 }}>{c.title}</strong>
                    <div className="text-muted" style={{ fontSize: 11 }}>
                      {getDocumentTypeLabel(c.docType as DocumentType)}
                      {c.headingPath.length ? ` · ${c.headingPath.join(' > ')}` : ''}
                    </div>
                    <div className="text-muted" style={{ fontSize: 10, fontFamily: 'monospace' }}>
                      总分 {(c.finalScore * 100).toFixed(1)} = 向量 {(c.vectorScore * 100).toFixed(1)} + 关键词 {(c.keywordScore * 100).toFixed(1)} + 元数据 {(c.metadataScore * 100).toFixed(1)} + 时效 {(c.freshnessScore * 100).toFixed(1)} × boost {c.sourceBoost.toFixed(1)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-muted">从左侧选择一条 trace 查看详情。</div>
        )}
      </section>
    </div>
  );
}

// ---- Answer Trace Tab ----

interface AnswerTraceData {
  query: string; rewrittenQuery?: string; intent?: string;
  answer: string; stats: { totalChunks: number; citedChunks: number; uncitedChunks: number; estimatedUnsupported: number };
  contextChunks: Array<{ rank: number; chunkId: string; title: string; heading: string }>;
  citations: Array<{ rank: number; chunkId: string; title: string; heading: string }>;
  unusedChunks: Array<{ rank: number; chunkId: string; title: string; heading: string }>;
  unsupportedClaims: string[];
}

function AnswerTraceTab() {
  const [query, setQuery] = useState('');
  const [data, setData] = useState<AnswerTraceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleGenerate() {
    if (!query.trim()) { setError('请输入问题'); return; }
    setLoading(true); setError(''); setData(null);
    try {
      const res = await fetch('/api/rag/debug-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, topK: 5 }),
      });
      const payload = await res.json();
      if (payload.ok) setData(payload.data);
      else setError(typeof payload.error === 'string' ? payload.error : '生成失败');
    } catch { setError('请求失败'); }
    finally { setLoading(false); }
  }

  return (
    <div className="section-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
      {/* Left: Input + Evidence Map */}
      <div>
        <section className="glass-card form-card" style={{ padding: 12 }}>
          <div className="form-section-title">答案调试</div>
          <label className="form-field">
            <span>问题</span>
            <textarea rows={3} value={query} onChange={(e) => setQuery(e.target.value)} style={{ fontSize: 13 }}
              placeholder="输入问题，生成带引用追溯的答案" />
          </label>
          {error ? <div className="status-message status-error">{error}</div> : null}
          <div className="form-actions">
            <button className="primary-button" disabled={loading || !query.trim()} onClick={handleGenerate} type="button">
              {loading ? '生成中...' : '生成答案并追溯'}
            </button>
          </div>
        </section>

        {data ? (
          <section className="glass-card form-card" style={{ padding: 12, marginTop: 12 }}>
            <div className="form-section-title">证据映射</div>
            <div style={{ marginBottom: 8, display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 12 }}>
              <span className="meta-pill">资料 {data.stats.totalChunks} 条</span>
              <span className="meta-pill">引用 {data.stats.citedChunks} 条</span>
              <span className="meta-pill">未引用 {data.stats.uncitedChunks} 条</span>
              {data.stats.estimatedUnsupported > 0 && (
                <span style={{ color: '#e8a87c' }}>⚠ 未验证结论 ~{data.stats.estimatedUnsupported} 处</span>
              )}
            </div>

            {data.citations.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <strong style={{ fontSize: 12 }}>已使用的资料</strong>
                {data.citations.map((c) => (
                  <div key={c.chunkId} style={{ fontSize: 11, padding: '4px 0', display: 'flex', gap: 6 }}>
                    <span style={{ color: 'var(--accent)', fontWeight: 700 }}>[{c.rank}]</span>
                    <span>{c.title}</span>
                    <span className="text-muted">{c.heading ? `· ${c.heading.slice(0, 30)}` : ''}</span>
                  </div>
                ))}
              </div>
            )}

            {data.unusedChunks.length > 0 && (
              <details>
                <summary style={{ cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)' }}>
                  未引用的资料（{data.unusedChunks.length} 条）
                </summary>
                {data.unusedChunks.map((c) => (
                  <div key={c.chunkId} className="text-muted" style={{ fontSize: 10, padding: '2px 0' }}>
                    [{c.rank}] {c.title} · {c.heading}
                  </div>
                ))}
              </details>
            )}

            {data.unsupportedClaims.length > 0 && (
              <div style={{ marginTop: 8, padding: 8, background: 'rgba(232, 168, 124, 0.08)', borderRadius: 6 }}>
                <strong style={{ fontSize: 12, color: '#e8a87c' }}>未找到资料支撑的陈述</strong>
                {data.unsupportedClaims.map((claim, i) => (
                  <div key={i} style={{ fontSize: 11, padding: '2px 0', color: 'var(--text-secondary)' }}>
                    ⚠ {claim.slice(0, 80)}
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : null}
      </div>

      {/* Right: Answer */}
      <div>
        <section className="glass-card form-card" style={{ padding: 12 }}>
          <div className="form-section-title">生成答案</div>
          {data ? (
            <div style={{ fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
              {data.answer.split(/(\[citation:\d+\])/g).map((part, i) => {
                const citeMatch = part.match(/\[citation:(\d+)\]/);
                if (citeMatch) {
                  return <span key={i} style={{ color: 'var(--accent)', fontWeight: 700, cursor: 'pointer' }} title={`资料 ${citeMatch[1]}`}>{part}</span>;
                }
                return <span key={i}>{part}</span>;
              })}
            </div>
          ) : (
            <div className="text-muted">点击「生成答案并追溯」查看带引用标注的回答。</div>
          )}
        </section>
      </div>
    </div>
  );
}

// ---- Eval Trend Tab ----

interface EvalEntry {
  timestamp: string; config: string; validTotal: number;
  hitRate5: number; hitRate10: number; mrr: number;
  byCategory?: Record<string, { count: number; hitRate5: number; hitRate10: number; mrr: number }>;
}

function EvalTrendTab() {
  const [entries, setEntries] = useState<EvalEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/rag/eval-history')
      .then(r => r.json())
      .then(d => { if (d.ok) setEntries(d.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Chart dimensions
  const W = 600, H = 200, PAD = 30;
  const data = entries.filter(e => e.hitRate5 > 0).slice(-15);
  const maxRate = Math.max(...data.map(d => Math.max(d.hitRate5, d.hitRate10, d.mrr)), 1);

  function chartLine(points: { x: number; y: number }[], color: string, dash = '') {
    if (points.length < 2) return null;
    const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    return <path key={color} d={d} stroke={color} strokeWidth={2} fill="none" strokeDasharray={dash} />;
  }

  const recent = data.length > 0 ? data[data.length - 1] : null;

  return (
    <section className="glass-card form-card" style={{ padding: 16 }}>
      <div className="form-section-title">评测趋势</div>
      {loading ? <div className="text-muted">加载中...</div> : data.length === 0 ? (
        <div className="text-muted">暂无评测数据，运行 <code>npm run eval</code> 生成。</div>
      ) : (
        <div>
          {/* Summary */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
            <div style={{ padding: '8px 12px', background: 'rgba(143, 164, 194, 0.06)', borderRadius: 6 }}>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>最新 HitRate@5</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{(recent!.hitRate5 * 100).toFixed(1)}%</div>
            </div>
            <div style={{ padding: '8px 12px', background: 'rgba(143, 164, 194, 0.06)', borderRadius: 6 }}>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>最新 MRR</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{(recent!.mrr * 1000 / 10).toFixed(3)}</div>
            </div>
            <div style={{ padding: '8px 12px', background: 'rgba(143, 164, 194, 0.06)', borderRadius: 6 }}>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>评测次数</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{entries.length}</div>
            </div>
          </div>

          {/* SVG Chart */}
          <svg viewBox={`0 0 \${W} \${H}`} style={{ width: '100%', maxWidth: W, height: H, fontSize: 10 }}>
            {/* Y axis */}
            <line x1={PAD} y1={0} x2={PAD} y2={H - 10} stroke="var(--border)" />
            {[0, 0.25, 0.5, 0.75, 1].map(v => (
              <g key={v}>
                <text x={PAD - 4} y={H - 10 - v * (H - 20)} textAnchor="end" fill="var(--text-secondary)">{(v * 100).toFixed(0)}</text>
                <line x1={PAD} y1={H - 10 - v * (H - 20)} x2={W} y2={H - 10 - v * (H - 20)} stroke="var(--border)" strokeDasharray="2,4" />
              </g>
            ))}
            {/* HitRate5 line */}
            {data.length > 1 && (() => {
              const points = data.map((d, i) => ({ x: PAD + (i / (data.length - 1)) * (W - PAD - 10), y: H - 10 - (d.hitRate5 / maxRate) * (H - 20) }));
              return <path d={points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')} stroke="#8cd8b0" strokeWidth={2} fill="none" />;
            })()}
            {/* Dots */}
            {data.map((d, i) => {
              const x = PAD + (i / (data.length - 1)) * (W - PAD - 10);
              const y = H - 10 - (d.hitRate5 / maxRate) * (H - 20);
              return <circle key={i} cx={x} cy={y} r={3} fill="#8cd8b0" />;
            })}
            {/* X labels */}
            {data.filter((_, i) => i === 0 || i === data.length - 1).map((d, i) => {
              const idx = i === 0 ? 0 : data.length - 1;
              const x = PAD + (idx / (data.length - 1)) * (W - PAD - 10);
              return <text key={i} x={x} y={H - 2} textAnchor="middle" fill="var(--text-secondary)">{d.timestamp.slice(5, 10)}</text>;
            })}
          </svg>

          {/* Category breakdown */}
          {recent && recent.byCategory && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>各类别最新表现</div>
              <div style={{ display: 'grid', gap: 6 }}>
                {Object.entries(recent.byCategory).sort((a, b) => b[1].count - a[1].count).map(([cat, s]) => (
                  <div key={cat} style={{ fontSize: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ width: 100 }}>{cat}</span>
                    <div style={{ flex: 1, height: 6, background: 'rgba(143, 164, 194, 0.1)', borderRadius: 3 }}>
                      <div style={{ width: `\${s.hitRate5 * 100}%`, height: '100%', background: s.hitRate5 > 0.6 ? '#8cd8b0' : s.hitRate5 > 0.3 ? '#d4b16a' : '#e8a87c', borderRadius: 3 }} />
                    </div>
                    <span style={{ width: 40, textAlign: 'right' }}>{(s.hitRate5 * 100).toFixed(0)}%</span>
                    <span className="text-muted" style={{ fontSize: 10 }}>({s.count}条)</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ---- Main ----

export function RagDebugWorkbench() {
  const [tab, setTab] = useState<'search' | 'traces' | 'answer' | 'eval'>('search');


  return (
    <div>
      <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '1px solid var(--border)' }}>
        <button
          className={tab === 'search' ? 'app-nav-link app-nav-link-active' : 'app-nav-link'}
          onClick={() => setTab('search')} type="button"
          style={{ borderRadius: '8px 8px 0 0', padding: '8px 16px' }}
        >单次检索</button>
        <button
          className={tab === 'traces' ? 'app-nav-link app-nav-link-active' : 'app-nav-link'}
          onClick={() => setTab('traces')} type="button"
          style={{ borderRadius: '8px 8px 0 0', padding: '8px 16px' }}
        >检索 Trace</button>
        <button
          className={tab === 'answer' ? 'app-nav-link app-nav-link-active' : 'app-nav-link'}
          onClick={() => setTab('answer')} type="button"
          style={{ borderRadius: '8px 8px 0 0', padding: '8px 16px' }}
        >答案追溯</button>
        <button
          className={tab === 'eval' ? 'app-nav-link app-nav-link-active' : 'app-nav-link'}
          onClick={() => setTab('eval')} type="button"
          style={{ borderRadius: '8px 8px 0 0', padding: '8px 16px' }}
        >评测趋势</button>
      </div>

      <div style={{ display: tab === 'search' ? 'block' : 'none' }}><SearchTab /></div>
      {tab === 'traces' && <TracesTab />}
      {tab === 'answer' && <AnswerTraceTab />}
      {tab === 'eval' && <EvalTrendTab />}
    </div>
  );
}
