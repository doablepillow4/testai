import { Router, type IRouter } from "express";
import { GetPolymarketMarketsQueryParams, GetPolymarketMarketsResponse } from "@workspace/api-zod";
import { logger } from "../lib/logger";

const router: IRouter = Router();

interface PolymarketEvent {
  id: string;
  title: string;
  category: string;
  markets: Array<{
    id: string;
    question: string;
    outcomePrices: string;
    volume: string;
    liquidity: string;
    endDate: string;
    active: boolean;
    closed: boolean;
  }>;
}

router.get("/polymarket/markets", async (req, res): Promise<void> => {
  const queryParsed = GetPolymarketMarketsQueryParams.safeParse(req.query);
  const limit = queryParsed.success ? queryParsed.data.limit : 20;

  try {
    const url = `https://gamma-api.polymarket.com/events?limit=${Math.min(50, limit)}&active=true&closed=false&order=volume&ascending=false`;
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) throw new Error(`Polymarket API error: ${response.status}`);

    const events = (await response.json()) as PolymarketEvent[];
    const markets = [];

    for (const event of events) {
      for (const market of event.markets ?? []) {
        if (!market.active || market.closed) continue;
        let yesPrice = 0.5;
        let noPrice = 0.5;
        try {
          const prices = JSON.parse(market.outcomePrices ?? "[]") as number[];
          yesPrice = prices[0] ?? 0.5;
          noPrice = prices[1] ?? 1 - yesPrice;
        } catch {}

        markets.push({
          id: market.id,
          question: market.question,
          category: event.category ?? "general",
          yesPrice: parseFloat(yesPrice.toString()),
          noPrice: parseFloat(noPrice.toString()),
          volume: parseFloat(market.volume ?? "0"),
          liquidity: parseFloat(market.liquidity ?? "0"),
          endDate: market.endDate ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          active: market.active,
        });

        if (markets.length >= limit) break;
      }
      if (markets.length >= limit) break;
    }

    res.json(GetPolymarketMarketsResponse.parse(markets));
  } catch (err) {
    logger.warn({ err }, "Failed to fetch Polymarket markets, using fallback");
    res.json(GetPolymarketMarketsResponse.parse(getFallbackMarkets(limit)));
  }
});

function getFallbackMarkets(limit: number) {
  const markets = [
    { id: "1", question: "Will the Fed cut rates in 2025?", category: "economics", yesPrice: 0.72, noPrice: 0.28, volume: 4200000, liquidity: 850000, endDate: "2025-12-31T00:00:00Z", active: true },
    { id: "2", question: "Will Bitcoin reach $100k before year end?", category: "crypto", yesPrice: 0.58, noPrice: 0.42, volume: 8100000, liquidity: 2100000, endDate: "2025-12-31T00:00:00Z", active: true },
    { id: "3", question: "Will NVIDIA remain the most valuable AI chip company?", category: "technology", yesPrice: 0.81, noPrice: 0.19, volume: 2900000, liquidity: 640000, endDate: "2025-06-30T00:00:00Z", active: true },
    { id: "4", question: "Will the US enter a recession in 2025?", category: "economics", yesPrice: 0.31, noPrice: 0.69, volume: 5600000, liquidity: 1300000, endDate: "2025-12-31T00:00:00Z", active: true },
    { id: "5", question: "Will Ethereum ETF inflows exceed Bitcoin ETF?", category: "crypto", yesPrice: 0.22, noPrice: 0.78, volume: 1800000, liquidity: 420000, endDate: "2025-09-30T00:00:00Z", active: true },
    { id: "6", question: "Will China invade Taiwan before 2026?", category: "geopolitics", yesPrice: 0.08, noPrice: 0.92, volume: 3200000, liquidity: 780000, endDate: "2025-12-31T00:00:00Z", active: true },
    { id: "7", question: "Will Apple release an AI-native iPhone?", category: "technology", yesPrice: 0.65, noPrice: 0.35, volume: 1500000, liquidity: 380000, endDate: "2025-09-30T00:00:00Z", active: true },
    { id: "8", question: "Will US inflation drop below 2%?", category: "economics", yesPrice: 0.44, noPrice: 0.56, volume: 2100000, liquidity: 520000, endDate: "2025-12-31T00:00:00Z", active: true },
    { id: "9", question: "Will Tesla release Full Self-Driving v5?", category: "technology", yesPrice: 0.39, noPrice: 0.61, volume: 980000, liquidity: 240000, endDate: "2025-12-31T00:00:00Z", active: true },
    { id: "10", question: "Will Russia-Ukraine conflict end in 2025?", category: "geopolitics", yesPrice: 0.28, noPrice: 0.72, volume: 6800000, liquidity: 1700000, endDate: "2025-12-31T00:00:00Z", active: true },
    { id: "11", question: "Will S&P 500 hit 6000?", category: "finance", yesPrice: 0.61, noPrice: 0.39, volume: 3400000, liquidity: 870000, endDate: "2025-12-31T00:00:00Z", active: true },
    { id: "12", question: "Will Solana flip Ethereum by market cap?", category: "crypto", yesPrice: 0.14, noPrice: 0.86, volume: 2200000, liquidity: 550000, endDate: "2025-12-31T00:00:00Z", active: true },
  ];
  return markets.slice(0, limit);
}

export default router;
