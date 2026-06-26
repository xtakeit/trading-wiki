import { readFile } from 'node:fs/promises';
import { embedText, cosineSimilarity, tokenizeForEmbedding } from '@/lib/rag/embed';
import { rerankHits } from '@/lib/rag/rerank';
import { writeTrace } from '@/lib/rag/trace';
import { RAG_FILES } from '@/lib/storage/paths';
import type { RagChunk, RagEmbedding, RagSearchHit, RetrieveOptions } from '@/lib/rag/types';

function computeFreshnessScore(chunk: RagChunk): number {
  if (!chunk.date) {
    return 0.7;
  }

  const now = new Date();
  const docDate = new Date(chunk.date);
  const ageDays = Math.floor((now.getTime() - docDate.getTime()) / (1000 * 60 * 60 * 24));

  if (ageDays < 30) return 1.0;
  if (ageDays < 90) return 0.9;
  if (ageDays < 180) return 0.7;
  return 0.5;
}

function clampScore(value: number): number {
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function normalizeDateScore(chunk: RagChunk, options: RetrieveOptions): boolean {
  if (!options.dateFrom && !options.dateTo) return true;
  if (!chunk.date) return false;
  if (options.dateFrom && chunk.date < options.dateFrom) return false;
  if (options.dateTo && chunk.date > options.dateTo) return false;
  return true;
}

function buildMetadataTokens(chunk: RagChunk): Set<string> {
  return new Set(
    tokenizeForEmbedding(
      [
        chunk.title,
        chunk.author,
        chunk.platform,
        ...(chunk.headingPath ?? []),
        ...(chunk.themes ?? []),
        ...(chunk.stocks ?? []),
        ...(chunk.tags ?? []),
      ]
        .filter(Boolean)
        .join(' '),
    ),
  );
}

function computeKeywordScore(queryTokens: string[], chunk: RagChunk): number {
  if (!queryTokens.length) return 0;
  const titleText = chunk.title;
  const headingText = chunk.headingPath.join(' ');
  const contentText = chunk.content.slice(0, 800);
  const titleTokens = new Set(tokenizeForEmbedding(titleText));
  const headingTokens = new Set(tokenizeForEmbedding(headingText));
  const contentTokens = new Set(tokenizeForEmbedding(contentText));
  let score = 0;

  for (const token of queryTokens) {
    // 精确匹配 token
    if (titleTokens.has(token)) { score += 1; continue; }
    // 中文子串匹配（"京东方" 匹配 "京东方与康宁签订备忘录" 这类长标题）
    if (/[一-鿿]/.test(token) && titleText.includes(token)) { score += 1; continue; }
    if (headingTokens.has(token)) { score += 0.85; continue; }
    if (/[一-鿿]/.test(token) && headingText.includes(token)) { score += 0.85; continue; }
    if (contentTokens.has(token)) { score += 0.6; continue; }
    if (/[一-鿿]/.test(token) && contentText.includes(token)) { score += 0.6; }
  }

  return clampScore(score / queryTokens.length);
}

function computeMetadataScore(
  queryTokens: string[],
  chunk: RagChunk,
  options: RetrieveOptions,
): number {
  const metadataScores: number[] = [];

  if (options.docTypes?.length) {
    metadataScores.push(options.docTypes.includes(chunk.docType) ? 1 : 0);
  }
  if (options.themes?.length) {
    metadataScores.push(options.themes.some((theme) => chunk.themes?.some((ct) => ct.includes(theme) || theme.includes(ct))) ? 1 : 0);
  }
  if (options.stocks?.length) {
    metadataScores.push(options.stocks.some((stock) => chunk.stocks?.some((cs) => cs.includes(stock) || stock.includes(cs))) ? 1 : 0);
  }
  if (options.tags?.length) {
    metadataScores.push(options.tags.some((tag) => chunk.tags?.some((ct) => ct.includes(tag))) ? 1 : 0);
  }

  if (!metadataScores.length) {
    if (!queryTokens.length) return 0;
    const metadataTokens = buildMetadataTokens(chunk);
    const hits = queryTokens.reduce((count, token) => count + (metadataTokens.has(token) ? 1 : 0), 0);
    return clampScore(hits / queryTokens.length);
  }

  return clampScore(metadataScores.reduce((sum, score) => sum + score, 0) / metadataScores.length);
}

async function readJsonLines<T>(filePath: string): Promise<T[]> {
  try {
    const source = await readFile(filePath, 'utf8');
    return source
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as T);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

/**
 * MMR (Maximal Marginal Relevance) dedup.
 * Balances relevance and diversity among top candidates.
 */
function applyMMR(
  candidates: RagSearchHit[],
  embeddingMap: Map<string, number[]>,
  lambda: number,
  topK: number,
): RagSearchHit[] {
  if (candidates.length <= topK) return candidates;

  const selected: RagSearchHit[] = [candidates[0]];
  const remaining = candidates.slice(1);

  while (selected.length < topK && remaining.length > 0) {
    let bestIdx = 0;
    let bestMmr = -Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const relevance = remaining[i].finalScore;
      const vec = embeddingMap.get(remaining[i].chunk.id);
      let maxSim = 0;

      if (vec) {
        for (const sel of selected) {
          const selVec = embeddingMap.get(sel.chunk.id);
          if (selVec) {
            maxSim = Math.max(maxSim, (cosineSimilarity(vec, selVec) + 1) / 2);
          }
        }
      }

      const mmr = lambda * relevance - (1 - lambda) * maxSim;
      if (mmr > bestMmr) {
        bestMmr = mmr;
        bestIdx = i;
      }
    }

    selected.push(remaining[bestIdx]);
    remaining.splice(bestIdx, 1);
  }

  return selected;
}

export async function rankRagChunks(
  chunks: RagChunk[],
  embeddings: RagEmbedding[],
  options: RetrieveOptions,
): Promise<RagSearchHit[]> {
  const query = options.query.trim();
  if (!query) return [];

  const tStart = performance.now();
  const queryTokens = tokenizeForEmbedding(query);
  const queryVector = await embedText(query, 'query');
  const embeddingMap = new Map(embeddings.map((item) => [item.id, item.vector]));
  const tEmbed = performance.now();

  // Use dynamic weights if provided, else defaults
  const w = options.weights ?? { vector: 0.6, keyword: 0.15, metadata: 0.1, freshness: 0.15 };
  const totalWeight = w.vector + w.keyword + w.metadata + w.freshness;

  // Filter stats tracking
  let afterDocTypes = 0, afterStocks = 0, afterThemes = 0, afterTags = 0, afterDateRange = 0;

  const filtered = chunks.filter((chunk) => {
    const passDocTypes = !options.docTypes?.length || options.docTypes.includes(chunk.docType);
    const passStocks = !options.stocks?.length || options.stocks.some((stock) => chunk.stocks?.some((cs) => cs.includes(stock) || stock.includes(cs)));
    const passThemes = !options.themes?.length || options.themes.some((theme) => chunk.themes?.some((ct) => ct.includes(theme) || theme.includes(ct)));
    const passTags = !options.tags?.length || options.tags.some((tag) => chunk.tags?.some((ct) => ct.includes(tag)));
    const passDate = !options.dateFrom && !options.dateTo || normalizeDateScore(chunk, options);
    if (passDocTypes) afterDocTypes++;
    if (passStocks) afterStocks++;
    if (passThemes) afterThemes++;
    if (passTags) afterTags++;
    if (passDate) afterDateRange++;
    return passDocTypes && passStocks && passThemes && passTags && passDate;
  });
  const tFilter = performance.now();

  const scored = filtered
    .map((chunk) => {
      const chunkVector = embeddingMap.get(chunk.id) ?? [];
      const vectorScore = clampScore((cosineSimilarity(queryVector, chunkVector) + 1) / 2);
      const keywordScore = computeKeywordScore(queryTokens, chunk);
      const metadataScore = computeMetadataScore(queryTokens, chunk, options);
      const freshnessScore = computeFreshnessScore(chunk);

      const sourceBoost = options.sourceBoosts?.[chunk.docType] ?? 1.0;

      const finalScore =
        ((vectorScore * w.vector + keywordScore * w.keyword + metadataScore * w.metadata + freshnessScore * w.freshness) / totalWeight)
        * sourceBoost;

      return { chunk, vectorScore, keywordScore, metadataScore, freshnessScore, finalScore };
    })
    .filter((item) => item.finalScore > 0)
    .sort((left, right) => right.finalScore - left.finalScore);
  const tScore = performance.now();

  // Rerank + diversify pipeline
  const topK = options.topK ?? 8;
  let result: RagSearchHit[];
  const rerankUsed = scored.length > topK;
  const mmrLambda = options.mmrLambda;
  const mmrUsed = mmrLambda !== undefined && mmrLambda < 1;
  const rerankChanges: Array<{ chunkId: string; title: string; beforeRank: number; afterRank: number; score: number }> = [];
  let tRerankStart = 0, tRerankEnd = 0, tEnd = 0;

  if (scored.length > topK) {
    const candidates = scored.slice(0, 30);
    const beforeRerank = candidates.map((c, i) => ({ id: c.chunk.id, title: c.chunk.title, rank: i + 1 }));
    tRerankStart = performance.now();

    const reranked = await rerankHits(query, candidates);
    tRerankEnd = performance.now();

    for (let i = 0; i < Math.min(reranked.length, 10); i++) {
      const before = beforeRerank.find((b) => b.id === reranked[i].chunk.id);
      if (before && before.rank !== i + 1) {
        rerankChanges.push({ chunkId: reranked[i].chunk.id, title: reranked[i].chunk.title, beforeRank: before.rank, afterRank: i + 1, score: reranked[i].finalScore });
      }
    }

    // 2. MMR diversity (if enabled)
    if (mmrUsed && reranked.length > topK) {
      result = applyMMR(reranked, embeddingMap, mmrLambda!, topK);
    } else {
      result = reranked.slice(0, topK);
    }
    const tEnd = performance.now();
  } else {
    result = scored;
    tEnd = performance.now();
  }

  // Write retrieval trace (fire-and-forget)
  if (options.traceId) {
    writeTrace({
      id: options.traceId,
      timestamp: new Date().toISOString(),
      query: options.originalQuery ?? options.query,
      rewrittenQuery: options.rewrittenQuery,
      intent: options.intent,
      routeMethod: options.routeMethod,
      intentScores: options.intentScores,
      weights: w,
      sourceBoosts: options.sourceBoosts as Record<string, number> | undefined,
      totalCandidates: scored.length,
      latencyMs: {
        filter: Math.round(tFilter - tEmbed),
        vectorScore: Math.round(tScore - tFilter),
        keywordScore: 0,
        rerank: tRerankEnd > 0 ? Math.round(tRerankEnd - tRerankStart) : undefined,
        mmr: tRerankEnd > 0 ? Math.round(tEnd - tRerankEnd) : undefined,
        total: Math.round(tEnd - tStart),
      },
      filterStats: {
        total: chunks.length,
        afterDocTypes,
        afterStocks,
        afterThemes,
        afterTags,
        afterDateRange,
        afterScoreFilter: scored.length,
      },
      rerankChanges: rerankChanges.length > 0 ? rerankChanges : undefined,
      topK: result.map((h) => ({
        chunkId: h.chunk.id,
        docId: h.chunk.docId,
        title: h.chunk.title,
        docType: h.chunk.docType,
        headingPath: h.chunk.headingPath,
        finalScore: h.finalScore,
        vectorScore: h.vectorScore,
        keywordScore: h.keywordScore,
        metadataScore: h.metadataScore,
        freshnessScore: h.freshnessScore,
        sourceBoost: options.sourceBoosts?.[h.chunk.docType] ?? 1.0,
        selected: true,
      })),
      rerankUsed,
      mmrUsed,
    });
  }

  return result;
}

export async function retrieveRelevantChunks(
  options: RetrieveOptions,
): Promise<RagSearchHit[]> {
  const [chunks, embeddings] = await Promise.all([
    readJsonLines<RagChunk>(RAG_FILES.chunks),
    readJsonLines<RagEmbedding>(RAG_FILES.embeddings),
  ]);

  const topK = options.topK ?? 8;

  // 主查询
  const mainHits = await rankRagChunks(chunks, embeddings, options);

  // Multi-Query 扩展：多条查询分别检索，合并取最大分
  const expanded = options.expandedQueries ?? [];
  if (expanded.length === 0) return mainHits;

  const expandedHits = await Promise.all(
    expanded.map((eq) =>
      rankRagChunks(chunks, embeddings, { ...options, query: eq }),
    ),
  );

  // 合并去重：每个 chunk 取最大分
  const merged = new Map<string, RagSearchHit>();
  for (const hit of mainHits) {
    merged.set(hit.chunk.id, hit);
  }
  for (const hits of expandedHits) {
    for (const hit of hits) {
      const existing = merged.get(hit.chunk.id);
      if (!existing || hit.finalScore > existing.finalScore) {
        merged.set(hit.chunk.id, hit);
      }
    }
  }

  return Array.from(merged.values())
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, topK);
}
