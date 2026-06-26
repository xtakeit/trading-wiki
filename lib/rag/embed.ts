/**
 * 语义嵌入。
 *
 * 默认：Xenova/bge-small-zh-v1.5（~33MB，首次下载后缓存）
 * 回退：多分辨率特征哈希（离线可用）
 *
 * 使用 @huggingface/transformers（动态 import 避免 webpack 编译依赖）
 */

export const EMBEDDING_DIMENSION = 512;

// 模型文件在 models/Xenova/bge-small-zh-v1.5/
const MODEL_DIR = process.cwd() + '/models/Xenova/bge-small-zh-v1.5';

// ---- BGE 模型嵌入（首选） ----

type Extractor = (text: string, opts: { pooling: string; normalize: boolean }) => Promise<{ data: Float32Array }>;

let cachedExtractor: Extractor | null = null;
let modelFailed = false;

async function getExtractor(): Promise<Extractor | null> {
  if (cachedExtractor) return cachedExtractor;
  if (modelFailed) return null;
  try {
    const { pipeline } = await import('@huggingface/transformers');
    const pipe = await pipeline('feature-extraction', MODEL_DIR) as Extractor;
    cachedExtractor = pipe;
    return pipe;
  } catch (err) {
    console.warn('[embed] BGE 模型加载失败，回退到本地哈希:', err);
    modelFailed = true;
    return null;
  }
}

async function modelEmbedText(input: string, type: 'query' | 'passage'): Promise<number[]> {
  const ext = await getExtractor();
  if (!ext) return localEmbedText(input);

  const text = type === 'query'
    ? `为这个句子生成表示以用于检索相关文章：${input}`
    : input;
  const result = await ext(text, { pooling: 'mean', normalize: true });
  return Array.from(result.data as Float32Array);
}

// ---- 本地哈希嵌入（回退） ----

function fnv1a(text: string, seed = 0): number {
  let hash = 2166136261 ^ seed;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function localEmbedText(input: string): number[] {
  const vector = new Array(EMBEDDING_DIMENSION).fill(0);
  const normalized = input.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!normalized) return vector;

  const segments = normalized.match(/[\p{Script=Han}]+|[a-z0-9]+/gu) ?? [];
  const features = new Set<string>();

  for (const seg of segments) {
    if (/^[\p{Script=Han}]+$/u.test(seg)) {
      features.add(seg);
      for (let i = 2; i <= 3; i++) {
        for (let j = 0; j <= seg.length - i; j++) features.add(seg.slice(j, j + i));
      }
    } else {
      features.add(seg);
    }
  }

  const HASH_COUNT = 4;
  for (const feature of features) {
    for (let h = 0; h < HASH_COUNT; h++) {
      const hash = fnv1a(feature, h * 7919 + 104729);
      const dim = hash % EMBEDDING_DIMENSION;
      const sign = (hash & 2) === 0 ? 1 : -1;
      const weight = feature.length <= 2 ? 1.8 : feature.length >= 4 ? 1.2 : 1.0;
      vector[dim] += sign * weight / HASH_COUNT;
    }
  }

  let mag = 0;
  for (const v of vector) mag += v * v;
  mag = Math.sqrt(mag);
  if (mag > 0) for (let i = 0; i < vector.length; i++) vector[i] /= mag;
  return vector;
}

// ---- 统一入口 ----

export async function embedText(
  input: string,
  type: 'query' | 'passage' = 'passage',
): Promise<number[]> {
  if (!input.trim()) return new Array(EMBEDDING_DIMENSION).fill(0);
  return modelEmbedText(input, type);
}

export function getEmbeddingDimension(): number {
  return EMBEDDING_DIMENSION;
}

export function cosineSimilarity(left: number[], right: number[]): number {
  if (!left.length || left.length !== right.length) return 0;
  let dot = 0, lm = 0, rm = 0;
  for (let i = 0; i < left.length; i++) {
    dot += left[i] * right[i];
    lm += left[i] * left[i];
    rm += right[i] * right[i];
  }
  if (!lm || !rm) return 0;
  return dot / Math.sqrt(lm * rm);
}

export function tokenizeForEmbedding(input: string): string[] {
  const normalized = input.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  const segments = normalized.match(/[\p{Script=Han}]+|[a-z0-9]+/gu) ?? [];
  const tokens: string[] = [];
  for (const segment of segments) {
    if (/^[\p{Script=Han}]+$/u.test(segment)) {
      tokens.push(segment);
      for (let i = 0; i < segment.length - 1; i++) tokens.push(segment.slice(i, i + 2));
    } else {
      tokens.push(segment);
    }
  }
  return tokens;
}
