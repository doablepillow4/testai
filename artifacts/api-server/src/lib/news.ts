import { logger } from "./logger";

export interface NewsItem {
  id: string;
  title: string;
  description: string;
  url: string;
  source: string;
  publishedAt: string;
  sentiment: "bullish" | "bearish" | "neutral";
  category: string;
  isBreaking: boolean;
}

export interface NewsContext {
  sentiment: number;
  weight: number;
  headlines: string[];
  breakingAlert: boolean;
}

const FEED_SOURCES = [
  { name: "BBC World", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
  { name: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml" },
  { name: "Guardian", url: "https://www.theguardian.com/world/rss" },
  { name: "NPR World", url: "https://feeds.npr.org/1004/rss.xml" },
  { name: "New York Times", url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml" },
  { name: "Sky News", url: "https://feeds.skynews.com/feeds/rss/world.xml" },
];

const BEARISH_KW = [
  "war", "attack", "conflict", "crisis", "crash", "collapse", "sanction",
  "threat", "explosion", "missile", "airstrike", "troops", "invasion",
  "escalat", "recession", "default", "ban", "restrict", "shooting",
  "assassination", "coup",
];
const BULLISH_KW = [
  "ceasefire", "peace", "deal", "agreement", "recovery", "stimulus", "rally",
  "surge", "growth", "approval", "partnership", "trade deal", "signed",
  "breakthrough",
];

function scoreSentiment(text: string): {
  sentiment: "bullish" | "bearish" | "neutral";
  score: number;
} {
  const lower = text.toLowerCase();
  let score = 0;
  for (const kw of BEARISH_KW) if (lower.includes(kw)) score -= 1;
  for (const kw of BULLISH_KW) if (lower.includes(kw)) score += 1;
  if (score <= -1) return { sentiment: "bearish", score: Math.max(-1, score / 4) };
  if (score >= 1) return { sentiment: "bullish", score: Math.min(1, score / 4) };
  return { sentiment: "neutral", score: 0 };
}

function classifyCategory(text: string): string {
  const t = text.toLowerCase();
  if (
    /hantavirus|mpox|monkeypox|ebola|sars|mers|pandemic|epidemic|outbreak|novel virus|new strain|pathogen|contagion|quarantine|virus spread|health emergency|disease spread|WHO declares|CDC alert|infectious disease|bird flu|avian flu/.test(t)
  ) return "pandemic";
  if (/hospital|patient|health|medical|vaccine|vaccination|treatment|drug approval|clinical trial/.test(t)) return "health";
  if (/war|conflict|attack|military|troops|missile|bomb|nuclear|weapon|drone|soldier|airstrike/.test(t)) return "conflict";
  if (/election|president|prime minister|government|congress|parliament|vote|senator/.test(t)) return "politics";
  if (/oil|opec|energy|gas|pipeline|petroleum|barrel/.test(t)) return "energy";
  if (/trade|tariff|sanction|export|import|wto|supply chain/.test(t)) return "trade";
  if (/rate|inflation|gdp|economy|recession|central bank|fed|ecb|boe|monetary/.test(t)) return "macro";
  return "geopolitics";
}

function extractValue(block: string, tag: string): string {
  const cdataRe = new RegExp(
    `<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*<\\/${tag}>`,
    "i",
  );
  const plainRe = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = block.match(cdataRe) ?? block.match(plainRe);
  return m
    ? m[1]
        .replace(/<[^>]+>/g, "")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#[0-9]+;/g, "")
        .trim()
    : "";
}

function parseRSS(xml: string, sourceName: string): NewsItem[] {
  const items: NewsItem[] = [];
  const itemRe = /<item[^>]*>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRe.exec(xml)) !== null && items.length < 7) {
    const block = match[1];
    const title = extractValue(block, "title");
    const url = extractValue(block, "link") || extractValue(block, "guid");
    const pubDate =
      extractValue(block, "pubDate") ||
      extractValue(block, "dc:date") ||
      extractValue(block, "published");
    const desc = extractValue(block, "description").slice(0, 280);

    if (!title || title.length < 8) continue;

    let publishedAt: string;
    try {
      publishedAt = pubDate ? new Date(pubDate).toISOString() : new Date().toISOString();
    } catch {
      publishedAt = new Date().toISOString();
    }

    const isBreaking = Date.now() - new Date(publishedAt).getTime() < 2 * 60 * 60 * 1000;
    const { sentiment } = scoreSentiment(title + " " + desc);
    const category = classifyCategory(title + " " + desc);
    const idKey = Buffer.from(title.slice(0, 32))
      .toString("base64")
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(0, 16);

    items.push({
      id: `${sourceName.toLowerCase().replace(/\s/g, "-")}-${idKey}`,
      title,
      description: desc,
      url: url || "#",
      source: sourceName,
      publishedAt,
      sentiment,
      category,
      isBreaking,
    });
  }
  return items;
}

interface NewsCache {
  items: NewsItem[];
  expiry: number;
}

let _cache: NewsCache | null = null;
let _staleCache: NewsItem[] | null = null;
let _refreshing = false;

async function _fetchNewsRaw(): Promise<NewsItem[]> {
  const all: NewsItem[] = [];

  await Promise.all(
    FEED_SOURCES.map(async ({ name, url }) => {
      try {
        const res = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; Hivemind/1.0)",
            Accept: "application/rss+xml, application/xml, text/xml, */*",
          },
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        all.push(...parseRSS(text, name));
      } catch (err) {
        logger.warn({ source: name, err }, "News feed fetch failed");
      }
    }),
  );

  all.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());

  if (all.length === 0) {
    logger.warn("All news feeds failed");
    return [];
  }

  const uniqueItems: NewsItem[] = [];
  const seenTitles = new Set<string>();
  for (const item of all) {
    const normalizedTitle = item.title.toLowerCase().trim();
    if (!seenTitles.has(normalizedTitle)) {
      seenTitles.add(normalizedTitle);
      uniqueItems.push(item);
    }
  }

  return uniqueItems.slice(0, 30);
}

const NEWS_TTL_MS = 10 * 60 * 1000;

export async function fetchGeopoliticsNews(): Promise<NewsItem[]> {
  if (_cache && Date.now() < _cache.expiry) return _cache.items;

  if (_staleCache && !_refreshing) {
    _refreshing = true;
    _fetchNewsRaw()
      .then((items) => {
        if (items.length > 0) {
          _cache = { items, expiry: Date.now() + NEWS_TTL_MS };
          _staleCache = items;
        }
      })
      .catch((err) => {
        logger.warn({ err }, "Background news refresh failed");
        if (_staleCache) {
          _cache = { items: _staleCache, expiry: Date.now() + 60_000 };
        }
      })
      .finally(() => {
        _refreshing = false;
      });
    return _staleCache;
  }

  try {
    const items = await _fetchNewsRaw();
    if (items.length > 0) {
      _cache = { items, expiry: Date.now() + NEWS_TTL_MS };
      _staleCache = items;
      return items;
    }
    if (_staleCache) {
      _cache = { items: _staleCache, expiry: Date.now() + 60_000 };
      return _staleCache;
    }
    return [];
  } catch (err) {
    logger.error({ err }, "News fetch failed");
    if (_staleCache) {
      _cache = { items: _staleCache, expiry: Date.now() + 60_000 };
      return _staleCache;
    }
    return [];
  }
}

const SYMBOL_KEYWORDS: Record<string, string[]> = {
  BTC: ["bitcoin", "crypto", "cryptocurrency"],
  ETH: ["ethereum", "crypto"],
  XRP: ["ripple", "xrp"],
  ADA: ["cardano"],
  DOGE: ["dogecoin"],
  NVDA: ["nvidia", "semiconductor", "chip", "ai chip", "taiwan"],
  TSM: ["tsmc", "taiwan semiconductor"],
  AAPL: ["apple", "iphone"],
  MSFT: ["microsoft"],
  AMZN: ["amazon", "aws"],
  META: ["facebook", "meta"],
  GOOGL: ["google", "alphabet"],
  TSLA: ["tesla", "elon musk"],
  SPY: ["s&p", "market", "economy", "fed", "recession"],
  GLD: ["gold", "safe haven"],
  XOM: ["oil", "energy", "opec", "exxon"],
  AVAX: ["avalanche"],
  SOL: ["solana"],
};

export async function getNewsContextForSymbol(symbol: string): Promise<NewsContext> {
  const news = await fetchGeopoliticsNews();
  const kws = SYMBOL_KEYWORDS[symbol.toUpperCase()] ?? [symbol.toLowerCase()];

  let relevant = news.filter((n) => {
    const text = (n.title + " " + n.description).toLowerCase();
    return kws.some((kw) => text.includes(kw));
  });

  if (relevant.length === 0) {
    relevant = news
      .filter((n) => n.category === "macro" || n.category === "geopolitics")
      .slice(0, 4);
  }

  return buildNewsContext(relevant.slice(0, 5));
}

function buildNewsContext(items: NewsItem[]): NewsContext {
  const count = items.length;
  if (count === 0) return { sentiment: 0, weight: 0, headlines: [], breakingAlert: false };
  const avg = items.reduce((sum, n) => sum + scoreSentiment(n.title).score, 0) / count;
  return {
    sentiment: Number(avg.toFixed(3)),
    weight: Number(Math.min(1, count / 5).toFixed(2)),
    headlines: items.slice(0, 3).map((n) => n.title),
    breakingAlert: items.some((n) => n.isBreaking),
  };
}
