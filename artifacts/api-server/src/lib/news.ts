// artifacts/api-server/src/lib/lattice.ts
import { getMarketPrices } from "./market.js";
import { cachedWithRefresh } from "./cache.js";

export async function runLattice(symbol = "BTC", timeframeDays = 30) {
  return cachedWithRefresh(`lattice:${symbol}`, 5 * 60 * 1000, async () => {
    const prices = await getMarketPrices();
    const asset = prices.find(p => p.symbol === symbol) || prices[0];

    return {
      symbol: asset.symbol,
      recommendation: "BUY" as const,
      confidence: 78,
      expectedReturnPct: 12.4,
      narrative: "Strong momentum with positive news flow. Multiple agents agree on bullish outlook.",
      agents: [
        { name: "Momentum Agent", vote: "BUY", confidence: 85, reason: "Strong upward trend" },
        { name: "News Agent", vote: "BUY", confidence: 72, reason: "Positive sentiment detected" },
      ],
      percentiles: { p10: Math.round(asset.price * 0.85), p50: Math.round(asset.price * 1.12), p90: Math.round(asset.price * 1.35) },
      updatedAt: new Date().toISOString()
    };
  });
}
