import React, { useState, useMemo } from "react";
import {
  useGetPolymarketMarkets,
  useGetNews,
  getGetNewsQueryKey,
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
  ArrowRight,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";

// ─── Placeholder / fallback data ─────────────────────────────────────────────
const _now = new Date().toISOString();
const _1h = new Date(Date.now() - 3_600_000).toISOString();
const _2h = new Date(Date.now() - 7_200_000).toISOString();

const PLACEHOLDER_NEWS: NewsItem[] = [
  { id: "ph-1", title: "Middle East Tensions Elevate Oil Market Risk Premium", description: "Escalating tensions near the Strait of Hormuz raise concerns over supply disruption.", url: "#", source: "Hivemind Intel", publishedAt: _1h, sentiment: "bearish", category: "energy", isBreaking: true },
  { id: "ph-2", title: "Fed Officials Signal Caution on Rate Cuts Amid Sticky Inflation", description: "Federal Reserve speakers push back on early easing expectations.", url: "#", source: "Hivemind Intel", publishedAt: _2h, sentiment: "bearish", category: "macro", isBreaking: false },
  { id: "ph-3", title: "Ukraine-Russia Ceasefire Talks Stall as Both Sides Harden Positions", description: "Diplomatic efforts hit a roadblock ahead of next negotiations.", url: "#", source: "Hivemind Intel", publishedAt: _2h, sentiment: "bearish", category: "conflict", isBreaking: false },
  { id: "ph-4", title: "China GDP Growth Misses Estimates, Trade Tensions Flare", description: "Weaker-than-expected output data adds to global growth concerns.", url: "#", source: "Hivemind Intel", publishedAt: _now, sentiment: "bearish", category: "macro", isBreaking: false },
  { id: "ph-5", title: "US-EU Trade Deal Progress Boosts Risk Appetite", description: "Reports of progress on transatlantic trade framework lift equities.", url: "#", source: "Hivemind Intel", publishedAt: _now, sentiment: "bullish", category: "trade", isBreaking: false },
  { id: "ph-6", title: "OPEC+ Reaffirms Output Cuts Through Next Quarter", description: "Cartel reaffirms production discipline keeping oil prices supported.", url: "#", source: "Hivemind Intel", publishedAt: _now, sentiment: "neutral", category: "energy", isBreaking: false },
  { id: "ph-7", title: "Bitcoin Holds Above Key Support as Institutional Flows Stabilize", description: "BTC consolidates after volatility spike as ETF inflows resume.", url: "#", source: "Hivemind Intel", publishedAt: _now, sentiment: "bullish", category: "crypto", isBreaking: false },
  { id: "ph-8", title: "Taiwan Strait Tensions Rise on PLA Naval Exercise Reports", description: "Beijing orders large-scale naval exercises near Taiwan.", url: "#", source: "Hivemind Intel", publishedAt: _1h, sentiment: "bearish", category: "geopolitics", isBreaking: true },
  { id: "ph-9", title: "Global Health Officials Monitor Novel Respiratory Outbreak", description: "WHO convenes emergency session as cluster of unusual respiratory cases reported.", url: "#", source: "Hivemind Intel", publishedAt: _1h, sentiment: "bearish", category: "pandemic", isBreaking: true },
  { id: "ph-10", title: "Nvidia AI Chip Demand Outpaces Supply, Shares Hit Record", description: "Data center AI buildout accelerates as hyperscalers commit multi-year GPU contracts.", url: "#", source: "Hivemind Intel", publishedAt: _now, sentiment: "bullish", category: "technology", isBreaking: false },
];

const PLACEHOLDER_MARKETS: PolymarketMarket[] = [
  { id: "pm-1", question: "Will the US Federal Reserve cut rates in 2025?", category: "macro", yesPrice: 0.62, noPrice: 0.38, volume: 4_200_000, endDate: "2025-12-31", url: "#" },
  { id: "pm-2", question: "Will Bitcoin reach $100k before end of 2025?", category: "crypto", yesPrice: 0.55, noPrice: 0.45, volume: 8_700_000, endDate: "2025-12-31", url: "#" },
  { id: "pm-3", question: "Will there be a US-China trade deal in 2025?", category: "trade", yesPrice: 0.28, noPrice: 0.72, volume: 2_100_000, endDate: "2025-12-31", url: "#" },
  { id: "pm-4", question: "Will Ukraine-Russia ceasefire be reached in 2025?", category: "conflict", yesPrice: 0.41, noPrice: 0.59, volume: 5_300_000, endDate: "2025-12-31", url: "#" },
  { id: "pm-5", question: "Will OPEC+ maintain current production cuts through Q3?", category: "energy", yesPrice: 0.71, noPrice: 0.29, volume: 1_800_000, endDate: "2025-09-30", url: "#" },
  { id: "pm-6", question: "Will there be a new WHO global health emergency declared?", category: "pandemic", yesPrice: 0.33, noPrice: 0.67, volume: 920_000, endDate: "2025-12-31", url: "#" },
];

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

// ─── Geo-impact API hook ──────────────────────────────────────────────────────
const _geoCache = new Map<string, GeoImpactAnalysis>();

async function fetchGeoImpact(item: NewsItem): Promise<GeoImpactAnalysis> {
  const cacheKey = item.id ?? item.title.slice(0, 60);
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
  if (!res.ok) {
    console.warn(`geo-impact failed: ${res.status}, using fallback`);
    return {
      type: "unknown",
      label: "Analysis Unavailable",
      severity: "watch",
      lockdownRisk: 0,
      economicDisruptionRisk: 0,
      marketImpactScore: 0,
      timeHorizon: "Unknown",
      affectedSectors: [],
      affectedTickers: [],
      polymarketSearchTerms: [],
      narrative:
        "Real-time analysis is currently unavailable for this item. Please check back later.",
    };
  }
  const data = (await res.json()) as GeoImpactAnalysis;
  _geoCache.set(cacheKey, data);
  return data;
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
      "us ",
      "u.s.",
      "usa",
      "america",
      "american",
      "canada",
      "mexico",
      "brazil",
      "latin",
      "election",
      "trump",
      "biden",
      "congress",
      "fed ",
      "federal reserve",
      "dollar",
      "democratic",
      "republican",
      "democrat",
      "presidential",
      "nomination",
      "senate",
      "house of rep",
      "wall street",
      "nasdaq",
      "s&p",
      "dow ",
      "white house",
      "pentagon",
      "washington",
    ],
  },
  europe: {
    label: "Europe",
    flag: "🇪🇺",
    keywords: [
      "europe",
      "european",
      " eu ",
      "nato",
      "ukraine",
      "russia",
      "uk ",
      "britain",
      "british",
      "germany",
      "german",
      "france",
      "french",
      "ecb",
      "euro",
      "macron",
      "scholz",
      "zelensky",
      "putin",
      "brexit",
      "poland",
      "swedish",
    ],
  },
  middleeast: {
    label: "Middle East",
    flag: "🌙",
    keywords: [
      "iran",
      "israel",
      "israeli",
      "saudi",
      "gulf",
      "opec",
      "oil price",
      "yemen",
      "iraq",
      "syria",
      "hormuz",
      "hamas",
      "hezbollah",
      "gaza",
      "netanyahu",
      "beirut",
      "tehran",
      "riyadh",
    ],
  },
  asia: {
    label: "Asia Pacific",
    flag: "🌏",
    keywords: [
      "china",
      "chinese",
      "taiwan",
      "japan",
      "japanese",
      "korea",
      "korean",
      "india",
      "indian",
      "asean",
      "xi jinping",
      "south china",
      "pacific",
      "semiconductor",
      "beijing",
      "tokyo",
      "seoul",
      "modi",
      "philippines",
      "vietnam",
    ],
  },
  global: {
    label: "Global",
    flag: "⚡",
    keywords: [
      "global",
      "world",
      "imf",
      "g7",
      "g20",
      "wto",
      "pandemic",
      "climate",
      "inflation",
      "interest rate",
      "nuclear",
      "bitcoin",
      "crypto",
      "ethereum",
      "ai ",
      "artificial intelligence",
      "recession",
      "gdp",
      "gold ",
      "oil barrel",
    ],
  },
};

const MARKET_EXPOSURE: Record<string, { tickers: string[]; note: string }> = {
  oil: { tickers: ["XOM", "CVX", "USO", "SPY"], note: "Energy sector + oil-linked assets" },
  china: { tickers: ["BABA", "JD", "NVDA", "TSM"], note: "Semiconductor & China-exposed tech" },
  taiwan: { tickers: ["TSM", "NVDA", "AMAT", "SPY"], note: "Semiconductor supply chain at risk" },
  ukraine: { tickers: ["CORN", "WEAT", "XOM", "SPY"], note: "Commodities + European defence" },
  iran: {
    tickers: ["USO", "XOM", "GLD", "BTC"],
    note: "Oil + safe havens spike on Strait tensions",
  },
  election: { tickers: ["SPY", "TLT", "DXY", "BTC"], note: "Volatility + policy repricing" },
  fed: { tickers: ["TLT", "SPY", "GLD", "BTC"], note: "Rate-sensitive assets across the board" },
  nuclear: {
    tickers: ["GLD", "BTC", "TLT", "VIX"],
    note: "Flight to safety — classic risk-off trade",
  },
  crypto: { tickers: ["BTC", "ETH", "SOL", "COIN"], note: "Direct regulatory or sentiment impact" },
  pandemic: {
    tickers: ["XLV", "AMZN", "ZM", "UAL", "DAL"],
    note: "Healthcare + e-commerce up, travel down",
  },
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
    return {
      label: "HIGH",
      color: "text-red-400",
      bg: "bg-red-500/10",
      border: "border-red-500/20",
    };
  if (yesPrice >= 0.35)
    return {
      label: "MEDIUM",
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/20",
    };
  return {
    label: "LOW",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
  };
}

// ─── Enhanced findRelatedMarkets (includes health/pandemic) ───────────────────
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
    middleeast: [
      "iran",
      "israel",
      "israeli",
      "gaza",
      "hamas",
      "hezbollah",
      "lebanon",
      "beirut",
      "tehran",
      "tel aviv",
    ],
    election: [
      "election",
      "trump",
      "biden",
      "vote",
      "poll ",
      "republican",
      "democrat",
      "presidential",
      "harris",
    ],
    macro: ["fed ", "interest rate", "inflation", "cpi ", "recession", "debt", "treasury"],
    pandemic: [
      "pandemic",
      "virus",
      "outbreak",
      "lockdown",
      "mpox",
      "bird flu",
      "vaccine",
      "health emergency",
      "quarantine",
    ],
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

// ─── Main Geopolitics Page ───────────────────────────────────────────────────
export default function Geopolitics() {
  const [selectedRegion, setSelectedRegion] = useState("all");
  const [expandedNews, setExpandedNews] = useState<string | null>(null);
  const [analyses, setAnalyses] = useState<Record<string, GeoImpactAnalysis>>({});
  const [loadingAnalysis, setLoadingAnalysis] = useState<Record<string, boolean>>({});

  const { data: newsData, isLoading: loadingNews } = useGetNews(undefined, {
    query: {
      queryKey: getGetNewsQueryKey(),
      refetchInterval: 60000,
      placeholderData: PLACEHOLDER_NEWS,
    },
  });

  const { data: polymarketData, isLoading: loadingMarkets } = useGetPolymarketMarkets(undefined, {
    query: {
      queryKey: ["polymarket-markets"],
      refetchInterval: 120000,
      placeholderData: PLACEHOLDER_MARKETS,
    },
  });

  const filteredNews = useMemo(() => {
    const items = Array.isArray(newsData) && newsData.length > 0 ? newsData : PLACEHOLDER_NEWS;
    if (selectedRegion === "all") return items;
    const cfg = REGION_CONFIG[selectedRegion];
    return items.filter((item) => {
      const text = (item.title + " " + (item.description ?? "")).toLowerCase();
      return cfg.keywords.some((kw) => text.includes(kw));
    });
  }, [newsData, selectedRegion]);

  const marketByRegion = useMemo(() => {
    const mks = Array.isArray(polymarketData) && polymarketData.length > 0 ? polymarketData : PLACEHOLDER_MARKETS;
    const groups: Record<string, PolymarketMarket[]> = {
      americas: [],
      europe: [],
      middleeast: [],
      asia: [],
      global: [],
    };
    mks.forEach((m) => {
      const reg = classifyRegion(m);
      if (groups[reg]) groups[reg].push(m);
    });
    return groups;
  }, [polymarketData]);
  const markets = Array.isArray(polymarketData) && polymarketData.length > 0 ? polymarketData : PLACEHOLDER_MARKETS;

  async function handleExpand(item: NewsItem) {
    if (expandedNews === item.id) {
      setExpandedNews(null);
      return;
    }
    setExpandedNews(item.id);
    if (!analyses[item.id]) {
      setLoadingAnalysis((prev) => ({ ...prev, [item.id]: true }));
      try {
        const analysis = await fetchGeoImpact(item);
        setAnalyses((prev) => ({ ...prev, [item.id]: analysis }));
      } finally {
        setLoadingAnalysis((prev) => ({ ...prev, [item.id]: false }));
      }
    }
  }

  const isLoading = loadingNews || loadingMarkets;

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-[22px] font-700 text-white tracking-tight leading-none">
            Geopolitical Intel
          </h1>
          <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1.5 font-mono">
            <Radio className="w-3 h-3 text-primary animate-pulse" />
            Live Global Feeds · Polymarket Sentiment
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-2.5 py-1 rounded-full bg-white/[0.03] border border-white/[0.06] flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
              System Nominal
            </span>
          </div>
        </div>
      </div>

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
              {filteredNews.length} events detected
            </span>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-32 rounded-xl bg-white/[0.03] animate-pulse" />
              ))}
            </div>
          ) : filteredNews.length === 0 ? (
            <div className="py-20 text-center border border-dashed border-white/10 rounded-2xl bg-white/[0.01]">
              <Radar className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No signals detected in this region</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredNews.map((item) => (
                <Card
                  key={item.id}
                  className={`bg-card/40 border-white/[0.06] transition-all duration-300 overflow-hidden ${
                    expandedNews === item.id
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
                                {formatDistanceToNow(new Date(item.publishedAt), {
                                  addSuffix: true,
                                })}
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
                        </div>
                        <div className="mt-1">
                          {expandedNews === item.id ? (
                            <ChevronUp className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          )}
                        </div>
                      </div>
                    </button>

                    {expandedNews === item.id && (
                      <div className="px-4 pb-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="h-px bg-white/[0.06] mb-4" />
                        <p className="text-[13px] text-muted-foreground leading-relaxed mb-4">
                          {item.description}
                        </p>

                        {loadingAnalysis[item.id] ? (
                          <div className="py-8 flex flex-col items-center justify-center gap-3 bg-black/20 rounded-xl border border-white/[0.04]">
                            <Loader2 className="w-5 h-5 text-primary animate-spin" />
                            <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest">
                              Analyzing Global Impact...
                            </span>
                          </div>
                        ) : analyses[item.id] ? (
                          <div className="space-y-4">
                            {/* Analysis Header */}
                            <div className="grid grid-cols-2 gap-3">
                              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                                <div className="text-[10px] font-mono text-muted-foreground uppercase mb-1">
                                  Threat Type
                                </div>
                                <div className="flex items-center gap-2">
                                  {getThreatConfig(analyses[item.id].type).icon}
                                  <span
                                    className={`text-xs font-bold uppercase ${getThreatConfig(analyses[item.id].type).color}`}
                                  >
                                    {analyses[item.id].label}
                                  </span>
                                </div>
                              </div>
                              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                                <div className="text-[10px] font-mono text-muted-foreground uppercase mb-1">
                                  Severity
                                </div>
                                <div className="flex items-center gap-2">
                                  <div
                                    className={`w-1.5 h-1.5 rounded-full ${getSeverityConfig(analyses[item.id].severity).bg} ${getSeverityConfig(analyses[item.id].severity).color}`}
                                  />
                                  <span
                                    className={`text-xs font-bold uppercase ${getSeverityConfig(analyses[item.id].severity).color}`}
                                  >
                                    {getSeverityConfig(analyses[item.id].severity).label}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Risk Scores */}
                            <div className="p-4 rounded-xl bg-black/20 border border-white/[0.04] space-y-4">
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] font-semibold text-white uppercase tracking-wide">
                                  Market Impact Score
                                </span>
                                <span className="text-[11px] font-mono text-primary font-bold">
                                  {analyses[item.id].marketImpactScore}/100
                                </span>
                              </div>
                              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary rounded-full transition-all duration-1000"
                                  style={{
                                    width: `${analyses[item.id].marketImpactScore}%`,
                                    boxShadow: "0 0 8px rgba(0,212,255,0.4)",
                                  }}
                                />
                              </div>

                              <div className="grid grid-cols-2 gap-4 pt-2">
                                <div>
                                  <div className="flex justify-between mb-1">
                                    <span className="text-[10px] text-muted-foreground uppercase">
                                      Economic Disruption
                                    </span>
                                    <span className="text-[10px] font-mono text-white">
                                      {analyses[item.id].economicDisruptionRisk}%
                                    </span>
                                  </div>
                                  <div className="h-1 w-full bg-white/5 rounded-full">
                                    <div
                                      className="h-full bg-amber-500/60 rounded-full"
                                      style={{
                                        width: `${analyses[item.id].economicDisruptionRisk}%`,
                                      }}
                                    />
                                  </div>
                                </div>
                                <div>
                                  <div className="flex justify-between mb-1">
                                    <span className="text-[10px] text-muted-foreground uppercase">
                                      Lockdown/Stability
                                    </span>
                                    <span className="text-[10px] font-mono text-white">
                                      {analyses[item.id].lockdownRisk}%
                                    </span>
                                  </div>
                                  <div className="h-1 w-full bg-white/5 rounded-full">
                                    <div
                                      className="h-full bg-red-500/60 rounded-full"
                                      style={{ width: `${analyses[item.id].lockdownRisk}%` }}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Narrative */}
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <Zap className="w-3.5 h-3.5 text-primary" />
                                <span className="text-[11px] font-bold text-white uppercase tracking-wider">
                                  Hivemind Analysis
                                </span>
                              </div>
                              <div className="text-[12px] text-muted-foreground leading-relaxed p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                                {analyses[item.id].narrative}
                              </div>
                            </div>

                            {/* Related Markets from Polymarket */}
                            {markets.length > 0 && (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <BarChart2 className="w-3.5 h-3.5 text-emerald-400" />
                                    <span className="text-[11px] font-bold text-white uppercase tracking-wider">
                                      Related Prediction Markets
                                    </span>
                                  </div>
                                </div>
                                <div className="space-y-1.5">
                                  {findRelatedMarkets(
                                    item.title,
                                    item.description ?? "",
                                    markets,
                                  ).map((m) => (
                                    <div
                                      key={m.id}
                                      className="flex items-center justify-between p-2 rounded-lg bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.06] transition-colors"
                                    >
                                      <span className="text-[11px] text-white/80 line-clamp-1 flex-1 pr-4">
                                        {m.question}
                                      </span>
                                      <div className="flex items-center gap-3 shrink-0">
                                        <div className="text-right">
                                          <div
                                            className={`text-[11px] font-mono font-bold ${riskLevel(m.yesPrice).color}`}
                                          >
                                            {(m.yesPrice * 100).toFixed(0)}%
                                          </div>
                                          <div className="text-[8px] font-mono text-muted-foreground uppercase tracking-tighter">
                                            Yes Prob
                                          </div>
                                        </div>
                                        <div
                                          className={`px-1.5 py-0.5 rounded text-[8px] font-bold border ${riskLevel(m.yesPrice).bg} ${riskLevel(m.yesPrice).color} ${riskLevel(m.yesPrice).border}`}
                                        >
                                          {riskLevel(m.yesPrice).label}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                  {findRelatedMarkets(item.title, item.description ?? "", markets)
                                    .length === 0 && (
                                    <div className="text-[10px] text-muted-foreground/50 italic py-2">
                                      No direct Polymarket correlation found for this specific
                                      event.
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Footer Links */}
                            <div className="flex items-center justify-between pt-2">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono text-muted-foreground uppercase">
                                  Horizon:
                                </span>
                                <span className="text-[10px] font-mono text-white bg-white/5 px-1.5 py-0.5 rounded">
                                  {analyses[item.id].timeHorizon}
                                </span>
                              </div>
                              <a
                                href={item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] font-bold text-primary hover:text-primary/80 flex items-center gap-1 uppercase tracking-widest transition-colors"
                              >
                                View Source <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Polymarket Overview */}
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
              <span className="text-[10px] font-mono text-muted-foreground uppercase">Live</span>
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 rounded-xl bg-white/[0.03] animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Region-specific markets */}
              {Object.entries(marketByRegion)
                .filter(
                  ([key, list]) =>
                    (selectedRegion === "all" || selectedRegion === key) && list.length > 0,
                )
                .map(([region, list]) => (
                  <div key={region} className="space-y-3">
                    <div className="flex items-center gap-2 px-1">
                      <span className="text-xs">{REGION_CONFIG[region].flag}</span>
                      <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">
                        {REGION_CONFIG[region].label}
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
                                  <div
                                    className={`text-[15px] font-mono font-bold leading-none ${riskLevel(m.yesPrice).color}`}
                                  >
                                    {(m.yesPrice * 100).toFixed(0)}%
                                  </div>
                                  <div className="text-[8px] font-mono text-muted-foreground uppercase tracking-tighter mt-1">
                                    Yes Odds
                                  </div>
                                </div>
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
                                  {typeof m.oddsShift === "number" && m.oddsShift !== 0 && (
                                    <div
                                      className={`flex items-center gap-0.5 text-[9px] font-mono ${m.oddsShift > 0 ? "text-emerald-400" : "text-red-400"}`}
                                    >
                                      {m.oddsShift > 0 ? (
                                        <TrendingUp className="w-2.5 h-2.5" />
                                      ) : (
                                        <TrendingDown className="w-2.5 h-2.5" />
                                      )}
                                      {Math.abs(m.oddsShift * 100).toFixed(1)}%
                                    </div>
                                  )}
                                  <div className="px-1.5 py-0.5 rounded-[4px] bg-white/[0.05] border border-white/[0.08] text-[8px] font-mono text-muted-foreground">
                                    ${((m.volume ?? 0) / 1000000).toFixed(1)}M Vol
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
            </div>
          )}

          {/* Global Indicators */}
          <Card className="bg-primary/5 border-primary/20 overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <CardContent className="p-4 relative">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-4 h-4 text-primary" />
                <h3 className="text-[11px] font-bold text-white uppercase tracking-wider">
                  Systemic Risk Outlook
                </h3>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="text-[10px] text-muted-foreground uppercase">
                      Geopolitical Tension Index
                    </div>
                    <div className="text-lg font-mono font-bold text-white">74.2</div>
                  </div>
                  <div className="text-right space-y-1">
                    <div className="text-[10px] text-muted-foreground uppercase">Status</div>
                    <div className="text-[10px] font-bold text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20">
                      ELEVATED
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-[9px] font-mono uppercase">
                    <span className="text-muted-foreground">Market Fragility</span>
                    <span className="text-primary">Moderate</span>
                  </div>
                  <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-primary/60 w-[58%]" />
                  </div>
                </div>

                <div className="pt-2">
                  <Button
                    variant="ghost"
                    className="w-full h-8 text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-white hover:bg-white/5 gap-2"
                  >
                    View Full Risk Report <ArrowRight className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
