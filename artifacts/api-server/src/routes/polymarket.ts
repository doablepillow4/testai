import { Router, type IRouter } from "express";
import { GetPolymarketMarketsQueryParams, GetPolymarketMarketsResponse } from "@workspace/api-zod";
import { getOddsShift } from "../lib/polymarket-cache";
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

type MarketItem = {
  id: string;
  question: string;
  category: string;
  yesPrice: number;
  noPrice: number;
  volume: number;
  liquidity: number;
  endDate: string;
  active: boolean;
  oddsShift: number | null;
};

let _cache: { data: MarketItem[]; expiresAt: number } | null = null;
const CACHE_TTL = 2 * 60 * 1000;

function eventsToMarkets(events: PolymarketEvent[]): MarketItem[] {
  const markets: MarketItem[] = [];
  for (const event of events) {
    for (const market of event.markets ?? []) {
      if (!market.active || market.closed) continue;
      let yesPrice = 0.5;
      let noPrice = 0.5;
      try {
        const prices = JSON.parse(market.outcomePrices ?? "[]") as number[];
        if (prices.length >= 2) {
          yesPrice = prices[0];
          noPrice = prices[1];
        } else if (prices.length === 1) {
          yesPrice = prices[0];
          noPrice = 1 - yesPrice;
        }
      } catch {
        // intentional: keep 0.5/0.5 for unparseable prices
      }
      markets.push({
        id: market.id,
        question: market.question,
        category: event.category ?? "general",
        yesPrice: parseFloat(yesPrice.toString()),
        noPrice: parseFloat(noPrice.toString()),
        volume: parseFloat(market.volume ?? "0"),
        liquidity: parseFloat(market.liquidity ?? "0"),
        endDate:
          market.endDate ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        active: market.active,
        oddsShift: getOddsShift(market.id, parseFloat(yesPrice.toString())),
      });
    }
  }
  return markets;
}

async function fetchTag(tag: string, limit: number): Promise<PolymarketEvent[]> {
  const url = `https://gamma-api.polymarket.com/events?limit=${limit}&active=true&closed=false&tag_slug=${tag}&order=volume&ascending=false`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Polymarket ${tag} error: ${res.status}`);
  return (await res.json()) as PolymarketEvent[];
}

export async function fetchPolymarketData(limit: number = 30) {
  if (_cache && Date.now() < _cache.expiresAt) {
    return _cache.data.slice(0, limit);
  }

  const slicePerTag = Math.ceil(limit / 3);

  const [byPolitics, byGeo, byEcon] = await Promise.allSettled([
    fetchTag("politics", 60),
    fetchTag("geopolitics", 40),
    fetchTag("economics", 30),
  ]);

  const seenIds = new Set<string>();
  const merged: MarketItem[] = [];

  function addFrom(result: PromiseSettledResult<PolymarketEvent[]>, cap: number) {
    if (result.status !== "fulfilled") {
      if (result.reason) logger.warn({ err: result.reason }, "Polymarket tag fetch failed");
      return;
    }
    const slice = eventsToMarkets(result.value);
    let added = 0;
    for (const m of slice) {
      if (seenIds.has(m.id)) continue;
      seenIds.add(m.id);
      merged.push(m);
      if (++added >= cap) break;
    }
  }

  addFrom(byGeo, slicePerTag);
  addFrom(byEcon, slicePerTag);
  addFrom(byPolitics, limit - merged.length);

  if (merged.length === 0) {
    throw new Error("All Polymarket tag fetches failed — no live data available");
  }

  _cache = { data: merged, expiresAt: Date.now() + CACHE_TTL };
  return merged.slice(0, limit);
}

router.get("/polymarket/markets", async (req, res): Promise<void> => {
  const queryParsed = GetPolymarketMarketsQueryParams.safeParse(req.query);
  const limit = queryParsed.success ? queryParsed.data.limit : 20;

  try {
    const markets = await fetchPolymarketData(limit);
    res.json(GetPolymarketMarketsResponse.parse(markets.slice(0, limit)));
  } catch (err) {
    logger.error({ err }, "Polymarket fetch failed — no live data available");
    res.status(503).json({
      error: "Polymarket data unavailable",
      message: "Live Polymarket data could not be fetched. Please try again shortly.",
    });
  }
});

export default router;
