import { logger } from "./logger";
import { marketCache, TTL, getOrFetch } from "./cache";
import { fetchWithRetry, DEFAULT_BROWSER_HEADERS } from "./fetch-utils";

const STOCK_SYMBOLS = ["NVDA", "TSLA", "AAPL", "MSFT", "AMZN", "META", "GOOGL", "SPY"];

const YAHOO_HEADERS = {
  ...DEFAULT_BROWSER_HEADERS,
  Accept: "application/json, text/plain, */*",
  Referer: "https://finance.yahoo.com/",
  Origin: "https://finance.yahoo.com",
};

const COINGECKO_HEADERS = {
  ...DEFAULT_BROWSER_HEADERS,
  Accept: "application/json",
};

const CRYPTO_IDS: Record<string, { id: string; symbol: string; name: string }> = {
  BTC: { id: "bitcoin", symbol: "BTC", name: "Bitcoin" },
  ETH: { id: "ethereum", symbol: "ETH", name: "Ethereum" },
  SOL: { id: "solana", symbol: "SOL", name: "Solana" },
  BNB: { id: "binancecoin", symbol: "BNB", name: "BNB" },
  ADA: { id: "cardano", symbol: "ADA", name: "Cardano" },
  XRP: { id: "ripple", symbol: "XRP", name: "XRP" },
  DOGE: { id: "dogecoin", symbol: "DOGE", name: "Dogecoin" },
  AVAX: { id: "avalanche-2", symbol: "AVAX", name: "Avalanche" },
  DOT: { id: "polkadot", symbol: "DOT", name: "Polkadot" },
  LINK: { id: "chainlink", symbol: "LINK", name: "Chainlink" },
  MATIC: { id: "polygon-ecosystem-token", symbol: "MATIC", name: "Polygon" },
  LTC: { id: "litecoin", symbol: "LTC", name: "Litecoin" },
};

// FIX: Yahoo Finance query1 is frequently blocked on server environments (Replit, etc).
// Try query2 as a fallback subdomain — same API, different routing.
const YAHOO_URLS = [
  "https://query1.finance.yahoo.com",
  "https://query2.finance.yahoo.com",
];

export function safeNum(value: unknown, fallback = 0): number {
  const n = typeof value === "string" ? parseFloat(value) : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function sanitizeSparkline(values: (number | null | undefined)[]): number[] {
  const clean = values.map((v) => (Number.isFinite(v as number) ? (v as number) : null));
  const filled: number[] = [];
  let last = 0;
  for (const v of clean) {
    if (v !== null) {
      last = v;
      filled.push(v);
    } else filled.push(last);
  }
  return filled;
}

export async function fetchStockPrice(symbol: string, live = false) {
  if (live) {
    return _fetchStockPriceRaw(symbol);
  }
  return getOrFetch(marketCache, `stock:price:${symbol}`, TTL.MARKET_PRICE, () =>
    _fetchStockPriceRaw(symbol),
  );
}

async function _fetchStockPriceRaw(symbol: string) {
  let lastError: Error | null = null;

  // FIX: Try query1 then query2 — server environments often get 403 on query1
  for (const baseUrl of YAHOO_URLS) {
    try {
      const url = `${baseUrl}/v8/finance/chart/${symbol}?interval=1d&range=30d`;
      const res = await fetchWithRetry(url, { headers: YAHOO_HEADERS }, 2, 12000);

      if (!res.ok) {
        lastError = new Error(`Yahoo Finance error: ${res.status} for ${symbol} (${baseUrl})`);
        logger.warn({ symbol, status: res.status, baseUrl }, "Yahoo Finance non-ok, trying next");
        continue;
      }

      const json = (await res.json()) as {
        chart: {
          result: Array<{
            meta: {
              regularMarketPrice?: number | null;
              previousClose?: number | null;
              chartPreviousClose?: number | null;
              regularMarketOpen?: number | null;
              regularMarketVolume?: number | null;
              marketCap?: number | null;
              longName?: string | null;
            };
            indicators: {
              quote: Array<{ close: (number | null)[] }>;
            };
          }>;
          error: unknown;
        };
      };

      const result = json.chart?.result?.[0];
      if (!result) {
        lastError = new Error(`No data returned from Yahoo Finance for ${symbol}`);
        continue;
      }

      const meta = result.meta;
      const closes = result.indicators?.quote?.[0]?.close ?? [];
      const validCloses = closes.filter(
        (c): c is number => typeof c === "number" && Number.isFinite(c),
      );
      const sparkline = sanitizeSparkline(validCloses.slice(-15));

      // FIX: meta.regularMarketPrice is sometimes null even when the series has data.
      // Fall back to the last valid close price from the indicators if needed.
      const price = safeNum(meta.regularMarketPrice) || validCloses[validCloses.length - 1] || 0;
      if (price === 0) {
        lastError = new Error(`Zero/missing price returned by Yahoo Finance for ${symbol}`);
        continue;
      }

      // FIX: Be more exhaustive with previous close fallbacks to ensure change % is accurate.
      const prevClose =
        safeNum(meta.chartPreviousClose) ||
        safeNum(meta.previousClose) ||
        validCloses[validCloses.length - 2] ||
        price;
      const rawChange = price - prevClose;
      const rawChangePercent = prevClose !== 0 ? (rawChange / prevClose) * 100 : 0;

      return {
        symbol,
        name: meta.longName && meta.longName.trim() ? meta.longName : symbol,
        price,
        change: safeNum(rawChange),
        changePercent: safeNum(rawChangePercent),
        volume: safeNum(meta.regularMarketVolume),
        marketCap: safeNum(meta.marketCap),
        type: "stock" as const,
        sparkline: sparkline.length > 0 ? sparkline : [],
        updatedAt: new Date().toISOString(),
        // FIX: isLive lets the frontend distinguish real vs. fallback data
        isLive: true,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      logger.warn({ symbol, baseUrl, err: lastError.message }, "Yahoo Finance fetch failed, trying next");
    }
  }

  throw lastError ?? new Error(`All Yahoo Finance endpoints failed for ${symbol}`);
}

// FIX: Extracted shared CoinGecko fetch logic — previously duplicated verbatim
// between the cached path and _fetchCryptoPricesRaw, risking silent divergence.
async function _fetchCoinGeckoMarkets() {
  const ids = Object.values(CRYPTO_IDS)
    .map((c) => c.id)
    .join(",");
  const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&sparkline=true&price_change_percentage=24h&order=market_cap_desc`;
  const res = await fetchWithRetry(url, { headers: COINGECKO_HEADERS }, 3, 12000);
  if (!res.ok) throw new Error(`CoinGecko error: ${res.status}`);

  const data = (await res.json()) as Array<{
    id: string;
    name: string;
    current_price: number;
    price_change_24h: number;
    price_change_percentage_24h: number;
    total_volume: number;
    market_cap: number;
    sparkline_in_7d?: { price: number[] };
  }>;

  const byId = new Map(data.map((d) => [d.id, d]));

  return Object.entries(CRYPTO_IDS).flatMap(([sym, info]) => {
    const d = byId.get(info.id);
    if (!d || !d.current_price) {
      logger.warn({ sym, id: info.id }, "CoinGecko missing price for entry — skipping");
      return [];
    }
    const price = safeNum(d.current_price);
    const changePercent = safeNum(d.price_change_percentage_24h);
    const rawSparkline = d.sparkline_in_7d?.price ?? [];
    const sparkline =
      rawSparkline.length >= 15 ? sanitizeSparkline(rawSparkline.slice(-15)) : [];
    return [
      {
        symbol: sym,
        name: info.name,
        price,
        change: safeNum(d.price_change_24h),
        changePercent,
        volume: safeNum(d.total_volume),
        marketCap: safeNum(d.market_cap),
        type: "crypto" as const,
        sparkline,
        updatedAt: new Date().toISOString(),
        isLive: true,
      },
    ];
  });
}

export async function fetchCryptoPrices(live = false) {
  if (live) {
    return _fetchCoinGeckoMarkets();
  }
  // FIX: Both cached and live paths now call the same underlying function
  return getOrFetch(marketCache, "crypto:prices:all", TTL.MARKET_PRICE, _fetchCoinGeckoMarkets);
}

export async function fetchStockHistory(symbol: string, days = 30) {
  return getOrFetch(marketCache, `stock:hist:${symbol}:${days}`, TTL.MARKET_HISTORY, () =>
    _fetchStockHistoryRaw(symbol, days),
  );
}

async function _fetchStockHistoryRaw(symbol: string, days = 30) {
  const range = days <= 7 ? "7d" : days <= 30 ? "1mo" : days <= 90 ? "3mo" : "6mo";
  const interval = days <= 7 ? "60m" : "1d";
  let lastError: Error | null = null;

  // FIX: Also try both Yahoo subdomains for history
  for (const baseUrl of YAHOO_URLS) {
    try {
      const url = `${baseUrl}/v8/finance/chart/${symbol}?interval=${interval}&range=${range}`;
      const res = await fetchWithRetry(url, { headers: YAHOO_HEADERS }, 2, 15000);

      if (!res.ok) {
        lastError = new Error(`Yahoo Finance history error: ${res.status} for ${symbol}`);
        continue;
      }

      const json = (await res.json()) as {
        chart: {
          result: Array<{
            timestamp: number[];
            indicators: {
              quote: Array<{
                open: (number | null)[];
                high: (number | null)[];
                low: (number | null)[];
                close: (number | null)[];
                volume: (number | null)[];
              }>;
            };
          }>;
        };
      };

      const result = json.chart?.result?.[0];
      if (!result) {
        lastError = new Error(`No history data returned from Yahoo Finance for ${symbol}`);
        continue;
      }

      const timestamps = result.timestamp ?? [];
      const quote = result.indicators?.quote?.[0] ?? {};
      return timestamps
        .map((ts, i) => ({
          timestamp: new Date(ts * 1000).toISOString(),
          open: quote.open?.[i] ?? null,
          high: quote.high?.[i] ?? null,
          low: quote.low?.[i] ?? null,
          close: quote.close?.[i] ?? null,
          volume: quote.volume?.[i] ?? null,
        }))
        .filter((p) => p.close !== null && Number.isFinite(p.close));
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError ?? new Error(`All Yahoo Finance history endpoints failed for ${symbol}`);
}

export async function fetchCryptoHistory(coinId: string, days = 30) {
  return getOrFetch(marketCache, `crypto:hist:${coinId}:${days}`, TTL.MARKET_HISTORY, () =>
    _fetchCryptoHistoryRaw(coinId, days),
  );
}

async function _fetchCryptoHistoryRaw(coinId: string, days = 30) {
  const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}&interval=daily`;
  const res = await fetchWithRetry(url, { headers: COINGECKO_HEADERS }, 3, 15000);
  if (!res.ok) throw new Error(`CoinGecko history error: ${res.status} for ${coinId}`);
  const json = (await res.json()) as { prices: [number, number][] };
  return json.prices
    .map(([ts, close]) => ({
      timestamp: new Date(ts).toISOString(),
      close: Number.isFinite(close) ? close : null,
      open: null,
      high: null,
      low: null,
      volume: null,
    }))
    .filter((p) => p.close !== null);
}

export const STOCK_SYMBOL_LIST = STOCK_SYMBOLS;
export const CRYPTO_ID_MAP = CRYPTO_IDS;

export async function fetchAnyTicker(symbol: string): Promise<{
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number;
  type: "stock" | "crypto";
  sparkline: number[];
  updatedAt: string;
  isLive: boolean;
} | null> {
  const upper = symbol.toUpperCase();

  if (upper in CRYPTO_IDS) {
    const prices = await fetchCryptoPrices();
    return prices.find((p) => p.symbol === upper) ?? null;
  }

  try {
    const result = await fetchStockPrice(upper);
    return result;
  } catch (err) {
    logger.warn({ symbol, err }, "fetchAnyTicker: stock price fetch failed");
    return null;
  }
}
