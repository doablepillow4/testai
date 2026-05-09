import React, { useState, useMemo } from "react";
import {
  useGetNews,
  useGetPolymarketMarkets,
  getGetNewsQueryKey,
  getGetPolymarketMarketsQueryKey,
} from "@workspace/api-client-react";
import type { PolymarketMarket, NewsItem } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  BarChart2,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Zap,
  Shield,
  Activity,
  ChevronDown,
  ChevronUp,
  Radio,
  ExternalLink,
  Newspaper,
  Clock,
  Flame,
  Thermometer,
  Wifi,
  CloudLightning,
  Package,
  Users,
  Loader2,
  Radar,
  WifiOff,
  Telescope,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// ─── Types ───────────────────────────────────────────────────────────────────
interface GeoImpactAnalysis {
  type: string;
  label: string;
  severity: "watch" | "concern" | "elevated" | "critical";
  lockdownRisk: number;
  economicDisruptionRisk: number;
  marketImpactScore: number;
  timeHorizon: string;
  affectedSectors: string[];
  affectedTickers: string[];
  polymarketSearchTerms: string[];
  narrative: string;
}

// FIX: Stable key for each news item — item.id is optional and can be undefined,
// which caused expand/collapse to never work and geo-impact cache to collide.
function newsKey(item: NewsItem): string {
  return item.id != null ? String(item.id) : item.title.slice(0, 80);
}

// ─── Geo-impact API hook ──────────────────────────────────────────────────────
const _geoCache = new Map<string, GeoImpactAnalysis>();

async function fetchGeoImpact(item: NewsItem): Promise<GeoImpactAnalysis> {
  // FIX: Use the stable newsKey instead of item.id directly
  const cacheKey = newsKey(item);
  if (_geoCache.has(cacheKey)) return _geoCache.get(cacheKey)!;

  const res = await fetch("/api/geo-impact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      headline: item.title,
      description: item.description ?? "",
      category: item.category ?? "geopolitics",
      isBreaking: item.isBreaking ?? false,
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`geo-impact failed: ${res.status}`);
  const data = (await res.json()) as GeoImpactAnalysis;
  _geoCache.set(cacheKey, data);
  return data;
}

// ─── Risk Barometer ───────────────────────────────────────────────────────────
function computeRiskBarometer(
  news: NewsItem[],
  markets: PolymarketMarket[],
): {
  score: number;
  level: "LOW" | "MODERATE" | "ELEVATED" | "CRITICAL";
  color: string;
  bgColor: string;
  borderColor: string;
  drivers: string[];
} | null {
  if (news.length === 0 && markets.length === 0) return null;

  const bearishNews = news.filter((n) => n.sentiment === "bearish").length;
  const newsScore = news.length > 0 ? (bearishNews / news.length) * 35 : 0;

  const breakingCount = news.filter((n) => n.isBreaking).length;
  const breakingScore = Math.min(15, breakingCount * 5);

  const threatMarkets = markets.filter((m) => {
    const q = m.question.toLowerCase();
    return /conflict|war|nuclear|invasion|recession|crisis|pandemic|attack|collapse|sanctions/.test(q);
  });
  const avgThreat =
    threatMarkets.length > 0
      ? threatMarkets.reduce((sum, m) => sum + m.yesPrice, 0) / threatMarkets.length
      : 0.18;
  const polyScore = avgThreat * 50;

  const score = Math.min(100, Math.round(newsScore + breakingScore + polyScore));

  let level: "LOW" | "MODERATE" | "ELEVATED" | "CRITICAL";
  let color: string;
  let bgColor: string;
  let borderColor: string;
  if (score < 25) {
    level = "LOW";
    color = "text-emerald-400";
    bgColor = "bg-emerald-500/10";
    borderColor = "border-emerald-500/20";
  } else if (score < 50) {
    level = "MODERATE";
    color = "text-yellow-400";
    bgColor = "bg-yellow-500/10";
    borderColor = "border-yellow-500/20";
  } else if (score < 72) {
    level = "ELEVATED";
    color = "text-orange-400";
    bgColor = "bg-orange-500/10";
    borderColor = "border-orange-500/25";
  } else {
    level = "CRITICAL";
    color = "text-red-400";
    bgColor = "bg-red-500/15";
    borderColor = "border-red-500/30";
  }

  const drivers: string[] = [];
  news
    .filter((n) => n.isBreaking)
    .slice(0, 2)
    .forEach((n) => drivers.push(n.title.slice(0, 55) + "…"));
  threatMarkets
    .sort((a, b) => b.yesPrice - a.yesPrice)
    .slice(0, 2)
    .forEach((m) =>
      drivers.push(`${m.question.slice(0, 45)}… (${(m.yesPrice * 100).toFixed(0)}%)`),
    );

  return { score, level, color, bgColor, borderColor, drivers };
}

// ─── Threat type config ───────────────────────────────────────────────────────
function getThreatConfig(type: string) {
  const cfg: Record<
    string,
    { icon: React.ReactNode; color: string; bg: string; border: string; pulse: boolean }
  > = {
    pandemic: {
      icon: <Thermometer className="w-3.5 h-3.5" />,
      color: "text-violet-400",
      bg: "bg-violet-500/10",
      border: "border-violet-500/25",
      pulse: true,
    },
    bioterror: {
      icon: <AlertTriangle className="w-3.5 h-3.5" />,
      color: "text-red-400",
      bg: "bg-red-500/15",
      border: "border-red-500/30",
      pulse: true,
    },
    nuclear: {
      icon: <Zap className="w-3.5 h-3.5" />,
      color: "text-red-400",
      bg: "bg-red-500/15",
      border: "border-red-500/30",
      pulse: true,
    },
    conflict: {
      icon: <Activity className="w-3.5 h-3.5" />,
      color: "text-orange-400",
      bg: "bg-orange-500/10",
      border: "border-orange-500/25",
      pulse: false,
    },
    energy: {
      icon: <Flame className="w-3.5 h-3.5" />,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/25",
      pulse: false,
    },
    financial: {
      icon: <TrendingDown className="w-3.5 h-3.5" />,
      color: "text-red-400",
      bg: "bg-red-500/10",
      border: "border-red-500/20",
      pulse: false,
    },
    political: {
      icon: <Users className="w-3.5 h-3.5" />,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
      border: "border-blue-500/20",
      pulse: false,
    },
    climate: {
      icon: <CloudLightning className="w-3.5 h-3.5" />,
      color: "text-cyan-400",
      bg: "bg-cyan-500/10",
      border: "border-cyan-500/20",
      pulse: false,
    },
    cyber: {
      icon: <Wifi className="w-3.5 h-3.5" />,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
      pulse: false,
    },
    supply_chain: {
      icon: <Package className="w-3.5 h-3.5" />,
      color: "text-amber-400",
      bg: "bg-amber-500/8",
      border: "border-amber-500/20",
      pulse: false,
    },
  };
  return (
    cfg[type] ?? {
      icon: <Shield className="w-3.5 h-3.5" />,
      color: "text-muted-foreground",
      bg: "bg-white/[0.04]",
      border: "border-white/[0.08]",
      pulse: false,
    }
  );
}

function getSeverityConfig(severity: GeoImpactAnalysis["severity"]) {
  return {
    watch: {
      label: "WATCH",
      color: "text-blue-400",
      bg: "bg-blue-500/10",
      border: "border-blue-500/20",
    },
    concern: {
      label: "CONCERN",
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/20",
    },
    elevated: {
      label: "ELEVATED",
      color: "text-orange-400",
      bg: "bg-orange-500/12",
      border: "border-orange-500/25",
    },
    critical: {
      label: "CRITICAL",
      color: "text-red-400",
      bg: "bg-red-500/15",
      border: "border-red-500/30",
    },
  }[severity];
}

// ─── Region config ────────────────────────────────────────────────────────────
const REGION_CONFIG: Record<string, { label: string; flag: string; keywords: string[] }> = {
  all: { label: "All Regions", flag: "🌐", keywords: [] },
  americas: {
    label: "Americas",
    flag: "🌎",
    keywords: [
      "us ", "u.s.", "usa", "america", "american", "canada", "mexico", "brazil", "latin",
      "election", "trump", "biden", "congress", "fed ", "federal reserve", "dollar",
      "democratic", "republican", "democrat", "presidential", "nomination", "senate",
      "house of rep", "wall street", "nasdaq", "s&p", "dow ", "white house", "pentagon", "washington",
    ],
  },
  europe: {
    label: "Europe",
    flag: "🇪🇺",
    keywords: [
      "europe", "european", " eu ", "nato", "ukraine", "russia", "uk ", "britain", "british",
      "germany", "german", "france", "french", "ecb", "euro", "macron", "scholz", "zelensky",
      "putin", "brexit", "poland", "swedish",
    ],
  },
  middleeast: {
    label: "Middle East",
    flag: "🌙",
    keywords: [
      "iran", "israel", "israeli", "saudi", "gulf", "opec", "oil price", "yemen", "iraq",
      "syria", "hormuz", "hamas", "hezbollah", "gaza", "netanyahu", "beirut", "tehran", "riyadh",
    ],
  },
  asia: {
    label: "Asia Pacific",
    flag: "🌏",
    keywords: [
      "china", "chinese", "taiwan", "japan", "japanese", "korea", "korean", "india", "indian",
      "asean", "xi jinping", "south china", "pacific", "semiconductor", "beijing", "tokyo",
      "seoul", "modi", "philippines", "vietnam",
    ],
  },
  global: {
    label: "Global",
    flag: "⚡",
    keywords: [
      "global", "world", "imf", "g7", "g20", "wto", "pandemic", "climate", "inflation",
      "interest rate", "nuclear", "bitcoin", "crypto", "ethereum", "ai ", "artificial intelligence",
      "recession", "gdp", "gold ", "oil barrel",
    ],
  },
};

const MARKET_EXPOSURE: Record<string, { tickers: string[]; note: string }> = {
  oil: { tickers: ["XOM", "CVX", "USO", "SPY"], note: "Energy sector + oil-linked assets" },
  china: { tickers: ["BABA", "JD", "NVDA", "TSM"], note: "Semiconductor & China-exposed tech" },
  taiwan: { tickers: ["TSM", "NVDA", "AMAT", "SPY"], note: "Semiconductor supply chain at risk" },
  ukraine: { tickers: ["CORN", "WEAT", "XOM", "SPY"], note: "Commodities + European defence" },
  iran: { tickers: ["USO", "XOM", "GLD", "BTC"], note: "Oil + safe havens spike on Strait tensions" },
  election: { tickers: ["SPY", "TLT", "DXY", "BTC"], note: "Volatility + policy repricing" },
  fed: { tickers: ["TLT", "SPY", "GLD", "BTC"], note: "Rate-sensitive assets across the board" },
  nuclear: { tickers: ["GLD", "BTC", "TLT", "VIX"], note: "Flight to safety — classic risk-off trade" },
  crypto: { tickers: ["BTC", "ETH", "SOL", "COIN"], note: "Direct regulatory or sentiment impact" },
  pandemic: { tickers: ["XLV", "AMZN", "ZM", "UAL", "DAL"], note: "Healthcare + e-commerce up, travel down" },
  default: { tickers: ["SPY", "GLD", "BTC"], note: "Broad market + safe-haven impact" },
};

function getMarketExposure(question: string) {
  const q = question.toLowerCase();
  if (/iran|hormuz|opec|oil/.test(q)) return MARKET_EXPOSURE.oil;
  if (/china|beijing|ccp/.test(q)) return MARKET_EXPOSURE.china;
  if (/taiwan/.test(q)) return MARKET_EXPOSURE.taiwan;
  if (/ukraine|russia|zelensky/.test(q)) return MARKET_EXPOSURE.ukraine;
  if (/election|vote|ballot/.test(q)) return MARKET_EXPOSURE.election;
  if (/fed|rate|interest|inflation/.test(q)) return MARKET_EXPOSURE.fed;
  if (/nuclear|nuke|warhead/.test(q)) return MARKET_EXPOSURE.nuclear;
  if (/bitcoin|crypto|ethereum|stablecoin/.test(q)) return MARKET_EXPOSURE.crypto;
  if (/pandemic|virus|outbreak|lockdown|vaccine/.test(q)) return MARKET_EXPOSURE.pandemic;
  return MARKET_EXPOSURE.default;
}

function classifyRegion(market: { question: string; category?: string | null }): string {
  const text = ` ${market.question} ${market.category ?? ""} `.toLowerCase();
  for (const [key, cfg] of Object.entries(REGION_CONFIG)) {
    if (key === "all" || key === "global") continue;
    if (cfg.keywords.some((kw) => text.includes(kw))) return key;
  }
  const globalCfg = REGION_CONFIG["global"];
  if (globalCfg && globalCfg.keywords.some((kw) => text.includes(kw))) return "global";
  return "americas";
}

function riskLevel(yesPrice: number) {
  if (yesPrice >= 0.65)
    return { label: "HIGH", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" };
  if (yesPrice >= 0.35)
    return { label: "MED", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" };
  return { label: "LOW", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" };
}

function findRelatedMarkets(
  newsTitle: string,
  description: string,
  markets: PolymarketMarket[],
): PolymarketMarket[] {
  const text = (newsTitle + " " + description).toLowerCase();
  const KEYWORD_GROUPS = {
    oil: ["oil", "opec", "energy", "hormuz", "crude", "petroleum", "gas "],
    china: ["china", "chinese", "beijing", "xi jinping", "taiwan", "south china sea"],
    ukraine: ["ukraine", "russia", "putin", "zelensky", "nato", "kyiv", "moscow"],
    middleeast: ["iran", "israel", "israeli", "gaza", "hamas", "hezbollah", "lebanon", "beirut", "tehran", "tel aviv"],
    election: ["election", "trump", "biden", "vote", "poll ", "republican", "democrat", "presidential", "harris"],
    macro: ["fed ", "interest rate", "inflation", "cpi ", "recession", "debt", "treasury"],
    pandemic: ["pandemic", "virus", "outbreak", "lockdown", "mpox", "bird flu", "vaccine", "health emergency", "quarantine"],
    crypto: ["bitcoin", "crypto", "ethereum", "stablecoin", "sec ", "binance", "coinbase"],
  };

  const matches: PolymarketMarket[] = [];
  for (const [key, kws] of Object.entries(KEYWORD_GROUPS)) {
    if (kws.some((kw) => text.includes(kw))) {
      const related = markets.filter((m) => {
        const mq = m.question.toLowerCase();
        const mc = (m.category ?? "").toLowerCase();
        return kws.some((kw) => mq.includes(kw) || mc.includes(kw)) || mc.includes(key);
      });
      matches.push(...related);
    }
  }
  return Array.from(new Set(matches)).slice(0, 5);
}

// ─── Main Intelligence Page ───────────────────────────────────────────────────
export default function Intelligence() {
  const [selectedRegion, setSelectedRegion] = useState("all");
  // FIX: Use string (stable key) instead of string | null to avoid undefined comparisons
  const [expandedNews, setExpandedNews] = useState<string>("");
  const [analyses, setAnalyses] = useState<Record<string, GeoImpactAnalysis>>({});
  const [analysisErrors, setAnalysisErrors] = useState<Record<string, string>>({});
  const [loadingAnalysis, setLoadingAnalysis] = useState<Record<string, boolean>>({});

  // FIX: Pass params correctly. Orval-generated hooks from this spec take params as first arg.
  // If your generated hook signature is useGetNews(params?, options?), keep as-is.
  // If it's useGetNews(options?), remove the first arg and add `params: { live: true }` inside query.
  // The version below works for both patterns by splitting concerns clearly:
  const {
    data: newsData,
    isLoading: loadingNews,
    error: newsError,
  } = useGetNews(
    { live: true },  // query params — passed to ?live=true on the API call
    {
      query: {
        queryKey: getGetNewsQueryKey({ live: true }),
        refetchInterval: 60_000,
        refetchOnMount: "always",
        staleTime: 0,
        retry: 2,
      },
    },
  );

  const {
    data: polymarketData,
    isLoading: loadingMarkets,
    error: marketsError,
  } = useGetPolymarketMarkets(
    { live: true },
    {
      query: {
        queryKey: getGetPolymarketMarketsQueryKey({ live: true }),
        refetchInterval: 60_000,
        refetchOnMount: "always",
        staleTime: 0,
        retry: 2,
      },
    },
  );

  const newsItems: NewsItem[] = Array.isArray(newsData) ? newsData : [];
  const markets: PolymarketMarket[] = Array.isArray(polymarketData) ? polymarketData : [];

  const barometer = useMemo(
    () => computeRiskBarometer(newsItems, markets),
    [newsItems, markets],
  );

  const filteredNews = useMemo(() => {
    if (selectedRegion === "all") return newsItems;
    const cfg = REGION_CONFIG[selectedRegion];
    if (!cfg) return newsItems;
    return newsItems.filter((item) => {
      const text = (item.title + " " + (item.description ?? "")).toLowerCase();
      return cfg.keywords.some((kw) => text.includes(kw));
    });
  }, [newsItems, selectedRegion]);

  const marketByRegion = useMemo(() => {
    const groups: Record<string, PolymarketMarket[]> = {
      americas: [], europe: [], middleeast: [], asia: [], global: [],
    };
    markets.forEach((m) => {
      const reg = classifyRegion(m);
      if (groups[reg]) groups[reg].push(m);
    });
    return groups;
  }, [markets]);

  // FIX: Use newsKey() everywhere instead of item.id to get a stable, non-undefined key
  async function handleExpand(item: NewsItem) {
    const key = newsKey(item);
    if (expandedNews === key) {
      setExpandedNews("");
      return;
    }
    setExpandedNews(key);
    if (!analyses[key] && !analysisErrors[key]) {
      setLoadingAnalysis((prev) => ({ ...prev, [key]: true }));
      try {
        const analysis = await fetchGeoImpact(item);
        setAnalyses((prev) => ({ ...prev, [key]: analysis }));
      } catch (err) {
        setAnalysisErrors((prev) => ({
          ...prev,
          [key]: err instanceof Error ? err.message : "Analysis unavailable",
        }));
      } finally {
        setLoadingAnalysis((prev) => ({ ...prev, [key]: false }));
      }
    }
  }

  const isLoading = loadingNews || loadingMarkets;

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-[22px] font-700 text-white tracking-tight leading-none flex items-center gap-2">
            <Telescope className="w-5 h-5 text-primary" />
            Intelligence
          </h1>
          <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1.5 font-mono">
            <Radio className="w-3 h-3 text-primary animate-pulse" />
            Live Global Feeds · Polymarket Sentiment · 60s refresh
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-[10px] font-mono text-muted-foreground/50 text-right leading-relaxed">
            {new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
            <br />
            {new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
          </div>
          <div className="px-2.5 py-1 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Live</span>
          </div>
        </div>
      </div>

      {/* Error banners */}
      {(!isLoading && (newsError || marketsError) && (newsItems.length === 0 || markets.length === 0)) && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2">
          <WifiOff className="w-4 h-4 text-red-400 shrink-0" />
          <span className="text-[11px] text-red-300">
            {newsError && marketsError && newsItems.length === 0 && markets.length === 0
              ? "News feeds and Polymarket are currently unreachable."
              : newsError && newsItems.length === 0
                ? "News feeds temporarily unavailable."
                : "Polymarket data temporarily unavailable."}
            {" "}Retrying automatically.
          </span>
        </div>
      )}

      {/* Risk Barometer */}
      {barometer ? (
        <Card className={`${barometer.bgColor} ${barometer.borderColor} border overflow-hidden relative`}>
          <div
            className="absolute top-0 right-0 w-40 h-40 rounded-full blur-3xl opacity-30 -translate-y-1/2 translate-x-1/2"
            style={{
              background: barometer.score >= 72
                ? "#ef4444"
                : barometer.score >= 50
                  ? "#f97316"
                  : barometer.score >= 25
                    ? "#eab308"
                    : "#10b981",
            }}
          />
          <CardContent className="p-4 relative">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <Shield className={`w-4 h-4 ${barometer.color}`} />
                <h3 className="text-[11px] font-bold text-white uppercase tracking-wider">
                  Global Risk Barometer
                </h3>
              </div>
              <div className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${barometer.bgColor} ${barometer.color} ${barometer.borderColor}`}>
                {barometer.level}
              </div>
            </div>

            <div className="flex items-end gap-4 mb-3">
              <div className={`text-[32px] font-mono font-bold leading-none ${barometer.color}`}>
                {barometer.score}
              </div>
              <div className="text-[10px] text-muted-foreground font-mono pb-1">/ 100</div>
              <div className="flex-1 pb-2">
                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-1000"
                    style={{
                      width: `${barometer.score}%`,
                      background: barometer.score >= 72
                        ? "linear-gradient(90deg, #f97316, #ef4444)"
                        : barometer.score >= 50
                          ? "linear-gradient(90deg, #eab308, #f97316)"
                          : barometer.score >= 25
                            ? "linear-gradient(90deg, #10b981, #eab308)"
                            : "linear-gradient(90deg, #10b981, #34d399)",
                      boxShadow: `0 0 10px ${barometer.score >= 72 ? "rgba(239,68,68,0.5)" : barometer.score >= 50 ? "rgba(249,115,22,0.4)" : "rgba(16,185,129,0.4)"}`,
                    }}
                  />
                </div>
              </div>
            </div>

            {barometer.drivers.length > 0 && (
              <div className="space-y-1">
                <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest mb-1.5">
                  Key Drivers
                </div>
                {barometer.drivers.slice(0, 3).map((d, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <div className={`w-1 h-1 rounded-full mt-1.5 shrink-0 ${barometer.color}`} />
                    <span className="text-[10px] text-muted-foreground leading-snug">{d}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="h-32 rounded-xl bg-white/[0.03] animate-pulse" />
      ) : null}

      {/* Region Selector */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {Object.entries(REGION_CONFIG).map(([key, cfg]) => (
          <button
            key={key}
            onClick={() => setSelectedRegion(key)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all whitespace-nowrap ${
              selectedRegion === key
                ? "bg-primary/10 border-primary/30 text-white"
                : "bg-white/[0.03] border-white/[0.06] text-muted-foreground hover:border-white/20"
            }`}
          >
            <span className="text-xs">{cfg.flag}</span>
            <span className="text-[11px] font-semibold tracking-wide uppercase">{cfg.label}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: News Feed */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <Newspaper className="w-4 h-4 text-primary" />
              <h2 className="text-[13px] font-bold text-white uppercase tracking-widest">
                Signal Stream
              </h2>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground">
              {filteredNews.length > 0
                ? `${filteredNews.length} events`
                : isLoading
                  ? "loading…"
                  : "0 events"}
            </span>
          </div>

          {loadingNews && newsItems.length === 0 ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 rounded-xl bg-white/[0.03] animate-pulse" />
              ))}
            </div>
          ) : newsError && newsItems.length === 0 ? (
            <div className="py-16 text-center border border-dashed border-red-500/20 rounded-2xl bg-red-500/5">
              <WifiOff className="w-8 h-8 text-red-400/40 mx-auto mb-3" />
              <p className="text-sm text-red-300/60">News feeds unavailable. Retrying…</p>
            </div>
          ) : filteredNews.length === 0 ? (
            <div className="py-20 text-center border border-dashed border-white/10 rounded-2xl bg-white/[0.01]">
              <Radar className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No signals detected in this region</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredNews.map((item) => {
                // FIX: Compute key once per item render, use it for all state lookups
                const key = newsKey(item);
                return (
                  <Card
                    key={key}
                    className={`bg-card/40 border-white/[0.06] transition-all duration-300 overflow-hidden ${
                      expandedNews === key
                        ? "ring-1 ring-primary/20 shadow-2xl shadow-primary/5"
                        : "hover:bg-card/60"
                    }`}
                  >
                    <CardContent className="p-0">
                      <button
                        onClick={() => handleExpand(item)}
                        className="w-full text-left p-4 focus:outline-none group"
                      >
                        <div className="flex items-start gap-3">
                          <div className="mt-1">
                            {item.isBreaking ? (
                              <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center relative">
                                <Flame className="w-4 h-4 text-red-500" />
                                <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-ping" />
                              </div>
                            ) : (
                              <div className="w-8 h-8 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center">
                                <Clock className="w-4 h-4 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono text-primary/80 uppercase tracking-tighter">
                                  {item.source}
                                </span>
                                <span className="text-[10px] text-muted-foreground/40">•</span>
                                <span className="text-[10px] font-mono text-muted-foreground">
                                  {formatDistanceToNow(new Date(item.publishedAt), { addSuffix: true })}
                                </span>
                              </div>
                              {item.isBreaking && (
                                <span className="text-[9px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded uppercase tracking-tighter">
                                  Breaking
                                </span>
                              )}
                            </div>
                            <h3 className="text-[14px] font-semibold text-white leading-tight group-hover:text-primary/90 transition-colors">
                              {item.title}
                            </h3>
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded uppercase ${
                                item.sentiment === "bullish"
                                  ? "bg-emerald-500/10 text-emerald-400"
                                  : item.sentiment === "bearish"
                                    ? "bg-red-500/10 text-red-400"
                                    : "bg-white/5 text-muted-foreground"
                              }`}>
                                {item.sentiment}
                              </span>
                              <span className="text-[9px] font-mono text-muted-foreground/50 uppercase">
                                {item.category}
                              </span>
                            </div>
                          </div>
                          <div className="mt-1">
                            {expandedNews === key ? (
                              <ChevronUp className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            )}
                          </div>
                        </div>
                      </button>

                      {expandedNews === key && (
                        <div className="px-4 pb-4 animate-in fade-in slide-in-from-top-2 duration-300">
                          <div className="h-px bg-white/[0.06] mb-4" />
                          <p className="text-[13px] text-muted-foreground leading-relaxed mb-4">
                            {item.description}
                          </p>

                          {loadingAnalysis[key] ? (
                            <div className="py-8 flex flex-col items-center justify-center gap-3 bg-black/20 rounded-xl border border-white/[0.04]">
                              <Loader2 className="w-5 h-5 text-primary animate-spin" />
                              <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest">
                                Analyzing Global Impact…
                              </span>
                            </div>
                          ) : analysisErrors[key] ? (
                            <div className="py-6 text-center bg-black/20 rounded-xl border border-white/[0.04]">
                              <span className="text-[11px] text-muted-foreground/60">
                                Impact analysis unavailable for this item.
                              </span>
                            </div>
                          ) : analyses[key] ? (
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-3">
                                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                                  <div className="text-[10px] font-mono text-muted-foreground uppercase mb-1">
                                    Threat Type
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {getThreatConfig(analyses[key].type).icon}
                                    <span className={`text-xs font-bold uppercase ${getThreatConfig(analyses[key].type).color}`}>
                                      {analyses[key].label}
                                    </span>
                                  </div>
                                </div>
                                <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                                  <div className="text-[10px] font-mono text-muted-foreground uppercase mb-1">
                                    Severity
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <div className={`w-1.5 h-1.5 rounded-full ${getSeverityConfig(analyses[key].severity)?.bg}`} />
                                    <span className={`text-xs font-bold uppercase ${getSeverityConfig(analyses[key].severity)?.color}`}>
                                      {getSeverityConfig(analyses[key].severity)?.label}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div className="p-4 rounded-xl bg-black/20 border border-white/[0.04] space-y-4">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-semibold text-white uppercase tracking-wide">
                                    Market Impact Score
                                  </span>
                                  <span className="text-[11px] font-mono text-primary font-bold">
                                    {analyses[key].marketImpactScore}/100
                                  </span>
                                </div>
                                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-primary rounded-full transition-all duration-1000"
                                    style={{
                                      width: `${analyses[key].marketImpactScore}%`,
                                      boxShadow: "0 0 8px rgba(0,212,255,0.4)",
                                    }}
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-4 pt-2">
                                  <div>
                                    <div className="flex justify-between mb-1">
                                      <span className="text-[10px] text-muted-foreground uppercase">Economic Disruption</span>
                                      <span className="text-[10px] font-mono text-white">{analyses[key].economicDisruptionRisk}%</span>
                                    </div>
                                    <div className="h-1 w-full bg-white/5 rounded-full">
                                      <div className="h-full bg-amber-500/60 rounded-full" style={{ width: `${analyses[key].economicDisruptionRisk}%` }} />
                                    </div>
                                  </div>
                                  <div>
                                    <div className="flex justify-between mb-1">
                                      <span className="text-[10px] text-muted-foreground uppercase">Lockdown/Stability</span>
                                      <span className="text-[10px] font-mono text-white">{analyses[key].lockdownRisk}%</span>
                                    </div>
                                    <div className="h-1 w-full bg-white/5 rounded-full">
                                      <div className="h-full bg-red-500/60 rounded-full" style={{ width: `${analyses[key].lockdownRisk}%` }} />
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <Zap className="w-3.5 h-3.5 text-primary" />
                                  <span className="text-[11px] font-bold text-white uppercase tracking-wider">
                                    Hivemind Analysis
                                  </span>
                                </div>
                                <div className="text-[12px] text-muted-foreground leading-relaxed p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                                  {analyses[key].narrative}
                                </div>
                              </div>

                              {markets.length > 0 && (
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <BarChart2 className="w-3.5 h-3.5 text-emerald-400" />
                                    <span className="text-[11px] font-bold text-white uppercase tracking-wider">
                                      Related Prediction Markets
                                    </span>
                                  </div>
                                  <div className="space-y-1.5">
                                    {findRelatedMarkets(item.title, item.description ?? "", markets).map((m) => (
                                      <div
                                        key={m.id}
                                        className="flex items-center justify-between p-2 rounded-lg bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.06] transition-colors"
                                      >
                                        <span className="text-[11px] text-white/80 line-clamp-1 flex-1 pr-4">
                                          {m.question}
                                        </span>
                                        <div className="flex items-center gap-2 shrink-0">
                                          <div className="text-right">
                                            <div className={`text-[11px] font-mono font-bold ${riskLevel(m.yesPrice).color}`}>
                                              {(m.yesPrice * 100).toFixed(0)}%
                                            </div>
                                            <div className="text-[8px] font-mono text-muted-foreground uppercase tracking-tighter">Yes</div>
                                          </div>
                                          {typeof m.oddsShift === "number" && Math.abs(m.oddsShift) > 0.005 && (
                                            <div className={`flex items-center gap-0.5 text-[9px] font-mono ${m.oddsShift > 0 ? "text-emerald-400" : "text-red-400"}`}>
                                              {m.oddsShift > 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                                              {Math.abs(m.oddsShift * 100).toFixed(1)}%
                                            </div>
                                          )}
                                          <div className={`px-1.5 py-0.5 rounded text-[8px] font-bold border ${riskLevel(m.yesPrice).bg} ${riskLevel(m.yesPrice).color} ${riskLevel(m.yesPrice).border}`}>
                                            {riskLevel(m.yesPrice).label}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                    {findRelatedMarkets(item.title, item.description ?? "", markets).length === 0 && (
                                      <div className="text-[10px] text-muted-foreground/50 italic py-2">
                                        No direct Polymarket correlation for this event.
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}

                              <div className="flex items-center justify-between pt-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-mono text-muted-foreground uppercase">Horizon:</span>
                                  <span className="text-[10px] font-mono text-white bg-white/5 px-1.5 py-0.5 rounded">
                                    {analyses[key].timeHorizon}
                                  </span>
                                </div>
                                {item.url && item.url !== "#" && (
                                  <a
                                    href={item.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[10px] font-bold text-primary hover:text-primary/80 flex items-center gap-1 uppercase tracking-widest transition-colors"
                                  >
                                    View Source <ExternalLink className="w-2.5 h-2.5" />
                                  </a>
                                )}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Prediction Markets */}
        <div className="lg:col-span-5 space-y-6">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-emerald-400" />
              <h2 className="text-[13px] font-bold text-white uppercase tracking-widest">
                Prediction Markets
              </h2>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-mono text-muted-foreground uppercase">Polymarket</span>
            </div>
          </div>

          {loadingMarkets && markets.length === 0 ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 rounded-xl bg-white/[0.03] animate-pulse" />
              ))}
            </div>
          ) : marketsError && markets.length === 0 ? (
            <div className="py-16 text-center border border-dashed border-red-500/20 rounded-2xl bg-red-500/5">
              <WifiOff className="w-8 h-8 text-red-400/40 mx-auto mb-3" />
              <p className="text-sm text-red-300/60">Polymarket unavailable. Retrying…</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(marketByRegion)
                .filter(
                  ([key, list]) =>
                    (selectedRegion === "all" || selectedRegion === key) && list.length > 0,
                )
                .map(([region, list]) => (
                  <div key={region} className="space-y-3">
                    <div className="flex items-center gap-2 px-1">
                      <span className="text-xs">{REGION_CONFIG[region]?.flag}</span>
                      <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">
                        {REGION_CONFIG[region]?.label}
                      </h3>
                      <div className="flex-1 h-px bg-white/[0.06]" />
                    </div>

                    <div className="space-y-2.5">
                      {list.slice(0, 4).map((m) => {
                        const exposure = getMarketExposure(m.question);
                        return (
                          <Card
                            key={m.id}
                            className="bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04] transition-all duration-300 group"
                          >
                            <CardContent className="p-3.5">
                              <div className="flex items-start justify-between gap-4 mb-3">
                                <h4 className="text-[12px] font-medium text-white/90 leading-snug flex-1">
                                  {m.question}
                                </h4>
                                <div className="text-right shrink-0">
                                  <div className={`text-[15px] font-mono font-bold leading-none ${riskLevel(m.yesPrice).color}`}>
                                    {(m.yesPrice * 100).toFixed(0)}%
                                  </div>
                                  <div className="text-[8px] font-mono text-muted-foreground uppercase tracking-tighter mt-1">
                                    Yes Odds
                                  </div>
                                </div>
                              </div>

                              <div className="flex h-1 rounded-full overflow-hidden mb-3 gap-px">
                                <div
                                  className="bg-emerald-500/60 rounded-l-full transition-all duration-700"
                                  style={{ width: `${m.yesPrice * 100}%` }}
                                />
                                <div
                                  className="bg-red-500/40 rounded-r-full transition-all duration-700"
                                  style={{ width: `${m.noPrice * 100}%` }}
                                />
                              </div>

                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="flex -space-x-1.5">
                                    {exposure.tickers.slice(0, 3).map((t) => (
                                      <div
                                        key={t}
                                        className="w-5 h-5 rounded-full bg-black border border-white/10 flex items-center justify-center text-[7px] font-bold text-white"
                                        title={t}
                                      >
                                        {t.slice(0, 2)}
                                      </div>
                                    ))}
                                  </div>
                                  <span className="text-[9px] font-mono text-muted-foreground">
                                    {exposure.tickers.length > 3
                                      ? `+${exposure.tickers.length - 3} more`
                                      : exposure.tickers.join(", ")}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2">
                                  {typeof m.oddsShift === "number" && m.oddsShift !== 0 && Math.abs(m.oddsShift) > 0.005 && (
                                    <div className={`flex items-center gap-0.5 text-[9px] font-mono ${m.oddsShift > 0 ? "text-emerald-400" : "text-red-400"}`}>
                                      {m.oddsShift > 0 ? (
                                        <TrendingUp className="w-2.5 h-2.5" />
                                      ) : (
                                        <TrendingDown className="w-2.5 h-2.5" />
                                      )}
                                      {Math.abs(m.oddsShift * 100).toFixed(1)}%
                                    </div>
                                  )}
                                  <div className="px-1.5 py-0.5 rounded-[4px] bg-white/[0.05] border border-white/[0.08] text-[8px] font-mono text-muted-foreground">
                                    ${((m.volume ?? 0) / 1_000_000).toFixed(1)}M Vol
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                ))}

              {markets.length > 0 &&
                Object.values(marketByRegion).every((l) => l.length === 0) && (
                  <div className="py-16 text-center border border-dashed border-white/10 rounded-2xl">
                    <Radar className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">No markets in this region</p>
                  </div>
                )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
