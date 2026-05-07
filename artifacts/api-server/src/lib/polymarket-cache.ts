interface CachedOdds {
  yesPrice: number;
  timestamp: number;
}

const cache = new Map<string, CachedOdds>();
const STALE_MS = 5 * 60 * 1000;

export function getOddsShift(marketId: string, currentYesPrice: number): number | null {
  const cached = cache.get(marketId);
  if (!cached) {
    cache.set(marketId, { yesPrice: currentYesPrice, timestamp: Date.now() });
    return null;
  }
  const shift = parseFloat((currentYesPrice - cached.yesPrice).toFixed(4));
  if (Date.now() - cached.timestamp > STALE_MS) {
    cache.set(marketId, { yesPrice: currentYesPrice, timestamp: Date.now() });
  }
  return Math.abs(shift) > 0.001 ? shift : null;
}

export function getGeoMarketsForAsset(
  symbol: string,
  markets: Array<{
    id: string;
    question: string;
    yesPrice: number;
    noPrice: number;
    volume: number;
    liquidity?: number;
    category: string;
    oddsShift?: number | null;
  }>,
): Array<{
  question: string;
  yesPrice: number;
  noPrice: number;
  volume: number;
  liquidity: number;
  category: string;
  marketImpact: string;
  oddsShift: number | null;
}> {
  const s = symbol.toLowerCase();
  const isCrypto = /^(btc|eth|sol|bnb|ada|xrp|doge|avax|dot|link|matic|ltc)$/.test(s);
  const isEnergy = /^(xom|cvx|uso|oil|cop|bp)$/.test(s);
  const isTech = /^(nvda|tsm|amat|mu|intc|aapl|msft|googl|meta|amzn)$/.test(s);
  const isMacro = /^(spy|qqq|tlt|gld|vix)$/.test(s);

  const keywords: string[] = [];
  if (isCrypto)
    keywords.push(
      "bitcoin",
      "crypto",
      "btc",
      "ethereum",
      "regulation",
      "sec",
      "cbdc",
      "stablecoin",
      "digital asset",
    );
  if (isEnergy)
    keywords.push("oil", "opec", "iran", "saudi", "energy", "petroleum", "gas", "barrel");
  if (isTech)
    keywords.push(
      "ai",
      "semiconductor",
      "chip",
      "nvidia",
      "taiwan",
      "china",
      "tech",
      "artificial intelligence",
    );
  if (isMacro || (!isCrypto && !isEnergy && !isTech)) {
    keywords.push(
      "fed",
      "rate",
      "inflation",
      "recession",
      "interest",
      "gdp",
      "dollar",
      "trump",
      "election",
      "debt",
    );
  }
  keywords.push("war", "conflict", "sanction", "nuclear", "ceasefire", "ukraine", "russia");

  const IMPACT_MAP: Record<string, string> = {
    bitcoin: "Crypto sentiment + regulatory risk",
    crypto: "Broad crypto market sentiment",
    regulation: "Regulatory overhang on digital assets",
    oil: "Energy input costs + inflation",
    iran: "Oil supply shock → inflation spike",
    opec: "Oil supply → macro inflation",
    taiwan: "Semiconductor supply chain disruption",
    china: "Tech export controls + supply chain",
    fed: "Rate-sensitive asset repricing",
    rate: "Discount rate → valuation compression",
    recession: "Earnings + risk-off rotation",
    inflation: "Real earnings erosion + Fed policy",
    ukraine: "Commodity prices + risk-off positioning",
    war: "Risk-off → safe haven rotation",
    nuclear: "Extreme tail risk — flight to gold/BTC",
    election: "Policy uncertainty → volatility spike",
    default: "Macro risk-off signal",
  };

  return markets
    .filter((m) => {
      const q = m.question.toLowerCase();
      return keywords.some((kw) => q.includes(kw));
    })
    .slice(0, 5)
    .map((m) => {
      const q = m.question.toLowerCase();
      const matchedKey = keywords.find((kw) => q.includes(kw)) ?? "default";
      return {
        question: m.question,
        yesPrice: m.yesPrice,
        noPrice: m.noPrice,
        volume: m.volume,
        liquidity: m.liquidity ?? 0,
        category: m.category,
        marketImpact: IMPACT_MAP[matchedKey] ?? IMPACT_MAP.default,
        oddsShift: m.oddsShift ?? null,
      };
    });
}

export function buildPolymarketHeadline(market: {
  question: string;
  yesPrice: number;
  oddsShift?: number | null;
  category: string;
}): string {
  const q = market.question;
  const pct = (market.yesPrice * 100).toFixed(0);
  const shift = market.oddsShift;
  const shiftStr =
    shift !== null && Math.abs(shift) > 0.005
      ? `, ${shift > 0 ? "↑" : "↓"} from ${((market.yesPrice - shift) * 100).toFixed(0)}% since news broke`
      : "";

  const q_lower = q.toLowerCase();
  let prefix = "Markets watching";
  if (/russia|ukraine|ceasefire|war|conflict/.test(q_lower))
    prefix = "BREAKING: Geopolitical risk elevated";
  else if (/bitcoin|btc|crypto|ethereum/.test(q_lower)) prefix = "BREAKING: Crypto market signal";
  else if (/fed|rate|inflation|recession/.test(q_lower)) prefix = "BREAKING: Macro risk repricing";
  else if (/iran|oil|opec|energy/.test(q_lower)) prefix = "BREAKING: Energy supply shock risk";
  else if (/china|taiwan|semiconductor/.test(q_lower)) prefix = "BREAKING: Tech supply chain risk";
  else if (/nuclear|nuke/.test(q_lower)) prefix = "BREAKING: Extreme tail risk alert";
  else if (/election|trump|vote/.test(q_lower)) prefix = "BREAKING: Political risk elevated";

  return `${prefix} — ${pct}% chance: ${q}${shiftStr}.`;
}
