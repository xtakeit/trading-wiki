/**
 * 本地实体词典。
 *
 * 从 data/index.json 自动构建股票/主题映射，用于 query 实体提取。
 * 运行时构建一次，缓存到进程退出。
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export interface StockEntry {
  name: string;
  codes: string[];
  aliases: string[];
  themes: string[];
}

let dictionary: { stocks: Map<string, StockEntry>; themes: Set<string> } | null = null;

/** 从文档标题提取股票名（如"亨通光电个股档案"→"亨通光电"） */
function extractStockNameFromTitle(title: string): string | null {
  const match = title.match(/^(.+?)(?:个股档案|产业链研究)$/);
  if (match) return match[1].trim();
  return null;
}

async function buildDictionary() {
  const indexFile = path.join(process.cwd(), 'data/index.json');
  let items: Array<{ type: string; title: string; stocks?: string[]; themes?: string[]; stock_code?: string; mentioned_stocks?: string[] }> = [];
  try {
    items = JSON.parse(await readFile(indexFile, 'utf8'));
  } catch {
    return { stocks: new Map<string, StockEntry>(), themes: new Set<string>() };
  }

  const stocks = new Map<string, StockEntry>();
  const themes = new Set<string>();

  for (const item of items) {
    // 收集主题
    for (const theme of item.themes ?? []) {
      if (theme) themes.add(theme);
    }

    // 从 stock_profile 提取股票
    if (item.type === 'stock_profile') {
      const name = extractStockNameFromTitle(item.title);
      if (name) {
        const codes: string[] = [];
        if (item.stock_code) codes.push(item.stock_code);
        // 从标题或内容提取股票代码
        const codeMatch = item.title.match(/(\d{6})/);
        if (codeMatch) codes.push(codeMatch[1]);

        const entry: StockEntry = {
          name,
          codes,
          aliases: [name, ...(item.stocks ?? [])],
          themes: item.themes ?? [],
        };
        stocks.set(name, entry);
        // 别名也建立映射
        for (const alias of entry.aliases) {
          if (alias && alias !== name && !stocks.has(alias)) {
            stocks.set(alias, entry);
          }
        }
        // 股票代码映射
        for (const code of codes) {
          if (!stocks.has(code)) stocks.set(code, entry);
        }
      }
    }

    // 从 viewpoint 提取股票名
    if (item.type === 'viewpoint') {
      const mentioned = item.mentioned_stocks ?? item.stocks ?? [];
      for (const stockName of mentioned) {
        if (!stockName || stockName.length < 2) continue;
        // 跳过纯代码
        if (/^\d{6}$/.test(stockName)) continue;
        if (!stocks.has(stockName)) {
          stocks.set(stockName, {
            name: stockName.replace(/[（(].*[）)]/, '').trim(), // "亨通光电(600487)" → "亨通光电"
            codes: [],
            aliases: [stockName],
            themes: item.themes ?? [],
          });
        }
      }
    }
  }

  return { stocks, themes };
}

/** 获取实体词典（运行时缓存） */
export async function getDictionary(): Promise<{ stocks: Map<string, StockEntry>; themes: Set<string> }> {
  if (dictionary) return dictionary;
  dictionary = await buildDictionary();
  return dictionary;
}

// ---- Theme → Stocks 映射 ----

let themeStocksCache: Map<string, string[]> | null = null;

/** 构建 theme → 相关股票名的映射 */
async function buildThemeStocks(): Promise<Map<string, string[]>> {
  const map = new Map<string, Set<string>>();
  const indexFile = path.join(process.cwd(), 'data/index.json');
  try {
    const items: Array<{ type: string; title: string; stocks?: string[]; themes?: string[]; mentioned_stocks?: string[] }> = JSON.parse(await readFile(indexFile, 'utf8'));
    for (const item of items) {
      const allStocks = new Set<string>();
      for (const s of [...(item.stocks ?? []), ...(item.mentioned_stocks ?? [])]) {
        // 去掉股票代码后缀如"(600487)"，跳过纯数字代码
        const name = s.replace(/[（(].*[）)]/g, '').trim();
        if (name && name.length >= 2 && !/^\d{6}$/.test(name)) {
          allStocks.add(name);
        }
      }
      if (allStocks.size === 0) continue;
      for (const theme of item.themes ?? []) {
        if (!map.has(theme)) map.set(theme, new Set());
        for (const s of allStocks) map.get(theme)!.add(s);
      }
    }
    const result = new Map<string, string[]>();
    for (const [theme, stocks] of map) {
      result.set(theme, [...stocks].slice(0, 8));
    }
    return result;
  } catch {
    return new Map();
  }
}

/** 根据主题获取相关公司名列表 */
export async function getRelatedStocks(themes: string[]): Promise<string[]> {
  if (!themeStocksCache) themeStocksCache = await buildThemeStocks();
  const result = new Set<string>();
  for (const theme of themes) {
    const stocks = themeStocksCache.get(theme);
    if (stocks) for (const s of stocks) result.add(s);
  }
  return [...result].slice(0, 10);
}

// ---- Stock → Themes 映射（对称映射） ----

let stockThemesCache: Map<string, string[]> | null = null;

async function buildStockThemes(): Promise<Map<string, string[]>> {
  const map = new Map<string, Set<string>>();
  const indexFile = path.join(process.cwd(), 'data/index.json');
  try {
    const items: Array<{ type: string; title: string; stocks?: string[]; themes?: string[]; mentioned_stocks?: string[] }> = JSON.parse(await readFile(indexFile, 'utf8'));
    for (const item of items) {
      const allStocks = new Set<string>();
      for (const s of [...(item.stocks ?? []), ...(item.mentioned_stocks ?? [])]) {
        const name = s.replace(/[（(].*[）)]/g, '').trim();
        if (name && name.length >= 2 && !/^\d{6}$/.test(name)) allStocks.add(name);
      }
      for (const stock of allStocks) {
        for (const theme of item.themes ?? []) {
          if (!map.has(stock)) map.set(stock, new Set());
          map.get(stock)!.add(theme);
        }
      }
    }
    const result = new Map<string, string[]>();
    for (const [stock, themes] of map) result.set(stock, [...themes].slice(0, 8));
    return result;
  } catch { return new Map(); }
}

/** 根据公司名获取相关主题列表 */
export async function getRelatedThemes(stockNames: string[]): Promise<string[]> {
  if (!stockThemesCache) stockThemesCache = await buildStockThemes();
  const result = new Set<string>();
  for (const name of stockNames) {
    const themes = stockThemesCache.get(name);
    if (themes) for (const t of themes) result.add(t);
  }
  return [...result].slice(0, 8);
}

/** 从 query 中提取实体 */
export interface ExtractedEntities {
  stocks: Array<{ name: string; codes: string[]; themes: string[] }>;
  themes: string[];
}

export async function extractEntities(query: string): Promise<ExtractedEntities> {
  const dict = await getDictionary();
  const foundStocks: ExtractedEntities['stocks'] = [];
  const foundThemes = new Set<string>();
  const seen = new Set<string>();

  // 按别名长度降序匹配（长匹配优先）
  const allAliases = [...dict.stocks.keys()].sort((a, b) => b.length - a.length);

  for (const alias of allAliases) {
    if (seen.has(alias)) continue;
    if (query.includes(alias)) {
      const entry = dict.stocks.get(alias)!;
      if (!seen.has(entry.name)) {
        seen.add(entry.name);
        foundStocks.push({ name: entry.name, codes: entry.codes, themes: entry.themes });
        for (const t of entry.themes) foundThemes.add(t);
      }
    }
  }

  // 主题匹配（不在股票主题中已覆盖的）
  for (const theme of dict.themes) {
    if (theme.length < 2) continue;
    if (query.includes(theme)) {
      foundThemes.add(theme);
    }
  }

  return {
    stocks: foundStocks,
    themes: [...foundThemes],
  };
}
