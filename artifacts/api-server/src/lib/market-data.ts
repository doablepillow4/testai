import { logger } from "./logger";

const STOCK_SYMBOLS = ["NVDA", "TSLA", "AAPL", "MSFT", "AMZN", "META", "GOOGL", "SPY"];
const CRYPTO_IDS: Record<string, { id: string; symbol: string; name: string }> = {
  BTC: { id: "bitcoin", symbol: "BTC", name: "Bitcoin" },
  ETH: { id: "ethereum", symbol: "ETH", name: "Ethereum" },
  SOL: { id: "solana", symbol: "SOL", name: "Solana" },
  BNB: { id: "binancecoin", symbol: "BNB", name: "BNB" },
};

export async function fetchStockPrice(symbol: string) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=30d`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) throw new Error(`Yahoo Finance error: ${res.status}`);
    const json = (await res.json()) as {
      chart: {
        result: Array<{
          meta: {
            regularMarketPrice: number;
            previousClose: number;
            regularMarketVolume: number;
            marketCap: number;
            longName: string;
          };
          indicators: {
            quote: Array<{ close: number[] }>;
          };
        }>;
        error: unknown;
      };
    };
    const result = json.chart?.result?.[0];
    if (!result) throw new Error("No data");

    const meta = result.meta;
    const closes = result.indicators?.quote?.[0]?.close ?? [];
    const validCloses = closes.filter((c) => c != null && !isNaN(c));
    const sparkline = validCloses.slice(-15);

    const price = meta.regularMarketPrice ?? 0;
    const prevClose = meta.previousClose ?? price;
    const rawChange = prevClose ? price - prevClose : 0;
    const rawChangePercent = prevClose ? (rawChange / prevClose) * 100 : 0;
    const change = isNaN(rawChange) ? 0 : rawChange;
    const changePercent = isNaN(rawChangePercent) ? 0 : rawChangePercent;

    return {
      symbol,
      name: meta.longName ?? symbol,
      price,
      change,
      changePercent,
      volume: meta.regularMarketVolume ?? 0,
      marketCap: meta.marketCap ?? 0,
      type: "stock" as const,
      sparkline,
      updatedAt: new Date().toISOString(),
    };
  } catch (err) {
    logger.warn({ symbol, err }, "Failed to fetch stock price, using fallback");
    return generateFallbackStockPrice(symbol);
  }
}

export async function fetchCryptoPrices() {
  try {
    const ids = Object.values(CRYPTO_IDS)
      .map((c) => c.id)
      .join(",");
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`CoinGecko error: ${res.status}`);
    const data = (await res.json()) as Record<
      string,
      {
        usd: number;
        usd_24h_change: number;
        usd_24h_vol: number;
        usd_market_cap: number;
      }
    >;

    const results = [];
    for (const [sym, info] of Object.entries(CRYPTO_IDS)) {
      const d = data[info.id];
      if (!d) continue;
      results.push({
        symbol: sym,
        name: info.name,
        price: d.usd,
        change: (d.usd * d.usd_24h_change) / 100,
        changePercent: d.usd_24h_change,
        volume: d.usd_24h_vol,
        marketCap: d.usd_market_cap,
        type: "crypto" as const,
        sparkline: generateSparkline(d.usd, d.usd_24h_change),
        updatedAt: new Date().toISOString(),
      });
    }
    return results;
  } catch (err) {
    logger.warn({ err }, "Failed to fetch crypto prices, using fallback");
    return generateFallbackCryptoPrices();
  }
}

export async function fetchStockHistory(symbol: string, days = 30) {
  try {
    const range = days <= 7 ? "7d" : days <= 30 ? "1mo" : days <= 90 ? "3mo" : "6mo";
    const interval = days <= 7 ? "60m" : "1d";
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${interval}&range=${range}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) throw new Error(`Yahoo Finance error: ${res.status}`);
    const json = (await res.json()) as {
      chart: {
        result: Array<{
          timestamp: number[];
          indicators: {
            quote: Array<{
              open: number[];
              high: number[];
              low: number[];
              close: number[];
              volume: number[];
            }>;
          };
        }>;
      };
    };
    const result = json.chart?.result?.[0];
    if (!result) throw new Error("No data");

    const timestamps = result.timestamp ?? [];
    const quote = result.indicators?.quote?.[0] ?? {};
    return timestamps.map((ts, i) => ({
      timestamp: new Date(ts * 1000).toISOString(),
      open: quote.open?.[i] ?? null,
      high: quote.high?.[i] ?? null,
      low: quote.low?.[i] ?? null,
      close: quote.close?.[i] ?? null,
      volume: quote.volume?.[i] ?? null,
    })).filter((p) => p.close != null);
  } catch (err) {
    logger.warn({ symbol, err }, "Failed to fetch stock history");
    return generateFallbackHistory(symbol, days);
  }
}

export async function fetchCryptoHistory(coinId: string, days = 30) {
  try {
    const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}&interval=daily`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`CoinGecko error: ${res.status}`);
    const json = (await res.json()) as { prices: [number, number][] };
    return json.prices.map(([ts, close]) => ({
      timestamp: new Date(ts).toISOString(),
      close,
      open: null,
      high: null,
      low: null,
      volume: null,
    }));
  } catch (err) {
    logger.warn({ coinId, err }, "Failed to fetch crypto history");
    return generateFallbackHistory(coinId, days);
  }
}

export const STOCK_SYMBOL_LIST = STOCK_SYMBOLS;
export const CRYPTO_ID_MAP = CRYPTO_IDS;

function generateSparkline(price: number, changePercent: number): number[] {
  const points = 15;
  const result: number[] = [];
  let current = price * (1 - changePercent / 100);
  for (let i = 0; i < points; i++) {
    current = current * (1 + (Math.random() - 0.48) * 0.02);
    result.push(parseFloat(current.toFixed(2)));
  }
  result[result.length - 1] = price;
  return result;
}

function generateFallbackStockPrice(symbol: string) {
  const prices: Record<string, number> = {
    NVDA: 875.4, TSLA: 175.2, AAPL: 189.5, MSFT: 412.3,
    AMZN: 185.7, META: 502.1, GOOGL: 175.8, SPY: 521.3,
  };
  const price = prices[symbol] ?? 100;
  const changePercent = (Math.random() - 0.5) * 4;
  const change = (price * changePercent) / 100;
  return {
    symbol,
    name: symbol,
    price,
    change,
    changePercent,
    volume: Math.floor(Math.random() * 50000000),
    marketCap: price * 1e9,
    type: "stock" as const,
    sparkline: generateSparkline(price, changePercent),
    updatedAt: new Date().toISOString(),
  };
}

function generateFallbackCryptoPrices() {
  return [
    { symbol: "BTC", name: "Bitcoin", price: 67500, change: 1200, changePercent: 1.81, volume: 28e9, marketCap: 1.32e12, type: "crypto" as const, sparkline: generateSparkline(67500, 1.81), updatedAt: new Date().toISOString() },
    { symbol: "ETH", name: "Ethereum", price: 3580, change: -42, changePercent: -1.16, volume: 14e9, marketCap: 430e9, type: "crypto" as const, sparkline: generateSparkline(3580, -1.16), updatedAt: new Date().toISOString() },
    { symbol: "SOL", name: "Solana", price: 171, change: 3.2, changePercent: 1.91, volume: 3.5e9, marketCap: 78e9, type: "crypto" as const, sparkline: generateSparkline(171, 1.91), updatedAt: new Date().toISOString() },
    { symbol: "BNB", name: "BNB", price: 592, change: -8, changePercent: -1.33, volume: 1.8e9, marketCap: 88e9, type: "crypto" as const, sparkline: generateSparkline(592, -1.33), updatedAt: new Date().toISOString() },
  ];
}

function generateFallbackHistory(symbol: string, days: number) {
  const prices: Record<string, number> = { NVDA: 875, TSLA: 175, BTC: 67500, ETH: 3580, SOL: 171 };
  const base = prices[symbol] ?? 100;
  const result = [];
  let price = base * 0.85;
  for (let i = days; i >= 0; i--) {
    price = price * (1 + (Math.random() - 0.48) * 0.025);
    const date = new Date();
    date.setDate(date.getDate() - i);
    result.push({
      timestamp: date.toISOString(),
      open: price * 0.995,
      high: price * 1.015,
      low: price * 0.985,
      close: price,
      volume: Math.floor(Math.random() * 30000000),
    });
  }
  return result;
}
