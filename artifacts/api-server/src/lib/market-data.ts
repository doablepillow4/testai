import { logger } from "./logger";
import { marketCache, TTL, getOrFetch } from "./cache";

const STOCK_SYMBOLS = ["NVDA", "TSLA", "AAPL", "MSFT", "AMZN", "META", "GOOGL", "SPY"];
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

export async function fetchStockPrice(symbol: string) {
  const cacheKey = `stock:price:${symbol}`;
  const cached = marketCache.get<Awaited<ReturnType<typeof _fetchStockPriceRaw>>>(cacheKey);
  if (cached) return cached;
  const result = await _fetchStockPriceRaw(symbol);
  marketCache.set(cacheKey, result, TTL.MARKET_PRICE);
  return result;
}

async function _fetchStockPriceRaw(symbol: string) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=30d`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Yahoo Finance error: ${res.status} for ${symbol}`);
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
  if (!result) throw new Error(`No data returned from Yahoo Finance for ${symbol}`);

  const meta = result.meta;
  const closes = result.indicators?.quote?.[0]?.close ?? [];
  const validCloses = closes.filter(
    (c): c is number => typeof c === "number" && Number.isFinite(c),
  );
  const sparkline = sanitizeSparkline(validCloses.slice(-15));

  const price = safeNum(meta.regularMarketPrice);
  if (price === 0) throw new Error(`Zero/missing price returned by Yahoo Finance for ${symbol}`);

  const prevClose = safeNum(meta.chartPreviousClose) || safeNum(meta.previousClose) || price;
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
  };
}

export async function fetchCryptoPrices() {
  return getOrFetch(marketCache, "crypto:prices:all", TTL.MARKET_PRICE, async () => {
    const ids = Object.values(CRYPTO_IDS)
      .map((c) => c.id)
      .join(",");
    const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&sparkline=true&price_change_percentage=24h&order=market_cap_desc`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });
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

    return Object.entries(CRYPTO_IDS).map(([sym, info]) => {
      const d = byId.get(info.id);
      if (!d || !d.current_price) {
        throw new Error(`Missing price data from CoinGecko for ${sym} (${info.id})`);
      }
      const price = safeNum(d.current_price);
      const changePercent = safeNum(d.price_change_percentage_24h);
      const rawSparkline = d.sparkline_in_7d?.price ?? [];
      const sparkline =
        rawSparkline.length >= 15
          ? sanitizeSparkline(rawSparkline.slice(-15))
          : [];
      return {
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
      };
    });
  });
}

export async function fetchStockHistory(symbol: string, days = 30) {
  return getOrFetch(marketCache, `stock:hist:${symbol}:${days}`, TTL.MARKET_HISTORY, () =>
    _fetchStockHistoryRaw(symbol, days),
  );
}

async function _fetchStockHistoryRaw(symbol: string, days = 30) {
  const range = days <= 7 ? "7d" : days <= 30 ? "1mo" : days <= 90 ? "3mo" : "6mo";
  const interval = days <= 7 ? "60m" : "1d";
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${interval}&range=${range}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Yahoo Finance history error: ${res.status} for ${symbol}`);
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
  if (!result) throw new Error(`No history data returned from Yahoo Finance for ${symbol}`);

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
}

export async function fetchCryptoHistory(coinId: string, days = 30) {
  return getOrFetch(marketCache, `crypto:hist:${coinId}:${days}`, TTL.MARKET_HISTORY, () =>
    _fetchCryptoHistoryRaw(coinId, days),
  );
}

async function _fetchCryptoHistoryRaw(coinId: string, days = 30) {
  const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}&interval=daily`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
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
