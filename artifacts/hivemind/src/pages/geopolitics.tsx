import React, { useState, useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import {
  useGetPolymarketMarkets,
  getGetPolymarketMarketsQueryKey,
  useGetNews,
  getGetNewsQueryKey,
} from "@workspace/api-client-react";
import type { PolymarketMarket, NewsItem } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Globe,
  BarChart2,
  CalendarDays,
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
  Rss,
  Flame,
  Thermometer,
  Wifi,
  CloudLightning,
  Package,
  Users,
  Loader2,
  Eye,
  Radar,
  ArrowRight,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

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
async function fetchGeoImpact(item: NewsItem): Promise<GeoImpactAnalysis> {
  const res = await fetch("/api/geo-impact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      headline: item.title,
      description: item.description ?? "",
      category: item.category ?? "geopolitics",
      isBreaking: item.isBreaking ?? false,
    }),
  });
  if (!res.ok) throw new Error("geo-impact failed");
  return res.json() as Promise<GeoImpactAnalysis>;
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
    watch: { label: "WATCH", color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
    concern: { label: "CONCERN", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
    elevated: { label: "ELEVATED", color: "text-orange-400", bg: "bg-orange-500/12", border: "border-orange-500/25" },
    critical: { label: "CRITICAL", color: "text-red-400", bg: "bg-red-500/15", border: "border-red-500/30" },
  }[severity];
}

// ─── Region config ────────────────────────────────────────────────────────────
const REGION_CONFIG: Record<string, { label: string; flag: string; keywords: string[] }> = {
  all: { label: "All Regions", flag: "🌐", keywords: [] },
  americas: {
    label: "Americas",
    flag: "🌎",
    keywords: ["us", "usa", "america", "canada", "mexico", "brazil", "latin", "election", "trump", "biden", "congress", "fed", "dollar"],
  },
  europe: {
    label: "Europe",
    flag: "🇪🇺",
    keywords: ["europe", "eu", "nato", "ukraine", "russia", "uk", "britain", "germany", "france", "ecb", "euro"],
  },
  middleeast: {
    label: "Middle East",
    flag: "🌙",
    keywords: ["iran", "israel", "saudi", "gulf", "opec", "oil", "yemen", "iraq", "syria", "hormuz", "hamas", "hezbollah"],
  },
  asia: {
    label: "Asia Pacific",
    flag: "🌏",
    keywords: ["china", "taiwan", "japan", "korea", "india", "asean", "xi", "south china", "pacific", "semiconductor"],
  },
  global: {
    label: "Global",
    flag: "⚡",
    keywords: ["global", "world", "imf", "g7", "g20", "wto", "pandemic", "climate", "inflation", "rate", "nuclear"],
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
  const text = `${market.question} ${market.category ?? ""}`.toLowerCase();
  for (const [key, cfg] of Object.entries(REGION_CONFIG)) {
    if (key === "all") continue;
    if (cfg.keywords.some((kw) => text.includes(kw))) return key;
  }
  return "global";
}

function riskLevel(yesPrice: number) {
  if (yesPrice >= 0.65) return { label: "HIGH", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" };
  if (yesPrice >= 0.35) return { label: "MEDIUM", color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" };
  return { label: "LOW", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" };
}

// ─── Enhanced findRelatedMarkets (includes health/pandemic) ───────────────────
function findRelatedMarkets(newsTitle: string, description: string, markets: PolymarketMarket[]): PolymarketMarket[] {
  const text = (newsTitle + " " + description).toLowerCase();
  const KEYWORD_GROUPS = [
    {
      terms: ["virus", "outbreak", "pandemic", "epidemic", "hantavirus", "mpox", "ebola", "sars", "mers", "bird flu", "disease spread", "who declares", "health emergency", "lockdown", "quarantine", "pathogen", "contagion", "infectious"],
      matches: ["pandemic", "disease", "outbreak", "lockdown", "health", "virus", "who", "epidemic"],
    },
    {
      terms: ["russia", "ukraine", "zelensky", "putin", "kyiv", "donbas", "ceasefire"],
      matches: ["russia", "ukraine", "ceasefire"],
    },
    {
      terms: ["iran", "tehran", "hormuz", "strait", "khamenei"],
      matches: ["iran", "hormuz", "oil"],
    },
    {
      terms: ["china", "beijing", "xi", "ccp", "taiwan", "pla"],
      matches: ["china", "taiwan", "semiconductor"],
    },
    {
      terms: ["fed", "federal reserve", "powell", "rate", "inflation", "fomc"],
      matches: ["fed", "rate", "inflation", "interest"],
    },
    {
      terms: ["bitcoin", "btc", "ethereum", "crypto", "sec", "regulation"],
      matches: ["bitcoin", "crypto", "ethereum", "regulation"],
    },
    {
      terms: ["election", "trump", "biden", "vote", "congress", "democrat", "republican"],
      matches: ["election", "trump", "vote"],
    },
    {
      terms: ["nuclear", "warhead", "nuke", "icbm", "north korea"],
      matches: ["nuclear", "north korea", "warhead"],
    },
    {
      terms: ["oil", "opec", "barrel", "brent", "crude", "energy"],
      matches: ["oil", "opec", "energy", "barrel"],
    },
    {
      terms: ["recession", "gdp", "unemployment", "downturn", "contraction"],
      matches: ["recession", "gdp", "downturn"],
    },
    {
      terms: ["hack", "cyber", "ransomware", "breach", "infrastructure attack"],
      matches: ["cyber", "hack", "breach"],
    },
    {
      terms: ["climate", "flood", "hurricane", "wildfire", "earthquake"],
      matches: ["climate", "disaster", "flood"],
    },
  ];

  const matchTerms: string[] = [];
  for (const group of KEYWORD_GROUPS) {
    if (group.terms.some((t) => text.includes(t))) {
      matchTerms.push(...group.matches);
    }
  }
  if (matchTerms.length === 0) return [];

  return markets
    .filter((m) => {
      const q = m.question.toLowerCase();
      return matchTerms.some((t) => q.includes(t));
    })
    .slice(0, 3);
}

// ─── Emergence scorer (client-side mirror of server scorer) ──────────────────
function computeEmergenceScore(item: NewsItem, polymarketMatchCount: number): number {
  const ageMs = Date.now() - new Date(item.publishedAt).getTime();
  const ageHours = ageMs / 3_600_000;
  let score = 0;

  if (ageHours < 2) score += 40;
  else if (ageHours < 8) score += 25;
  else if (ageHours < 24) score += 10;

  if (item.isBreaking) score += 25;
  if (item.sentiment === "bearish") score += 10;

  const CATEGORY_SCORES: Record<string, number> = {
    pandemic: 45,
    health: 35,
    conflict: 20,
    energy: 15,
    macro: 5,
    geopolitics: 10,
  };
  score += CATEGORY_SCORES[item.category ?? ""] ?? 0;

  const text = (item.title + " " + (item.description ?? "")).toLowerCase();
  if (/hantavirus|novel|new strain|emerging|first.*case|unconfirmed|initial report|rare disease|new outbreak/.test(text)) score += 40;
  if (/spread|spreading|multiple countries|cluster|cases rising|reported in/.test(text)) score += 20;
  if (/warning|alert|urgent|monitoring|watch|concern/.test(text)) score += 10;

  if (polymarketMatchCount === 0) score += 20;
  else if (polymarketMatchCount === 1) score += 5;

  return score;
}

// ─── Emerging Signal Card ─────────────────────────────────────────────────────
function EmergingSignalCard({
  item,
  analysis,
  isLoading,
  relatedMarkets,
  rank,
}: {
  item: NewsItem;
  analysis: GeoImpactAnalysis | undefined;
  isLoading: boolean;
  relatedMarkets: PolymarketMarket[];
  rank: number;
}) {
  const [expanded, setExpanded] = useState(rank === 0);

  const tc = analysis ? getThreatConfig(analysis.type) : getThreatConfig("unknown");
  const sc = analysis ? getSeverityConfig(analysis.severity) : getSeverityConfig("watch");

  let timeAgo = "recently";
  try { timeAgo = formatDistanceToNow(new Date(item.publishedAt), { addSuffix: true }); } catch {}

  return (
    <div className={`relative border ${tc.border} ${tc.bg} rounded-xl p-3.5 flex flex-col gap-2.5 transition-all`}>
      {/* Rank badge */}
      <div className="absolute top-3 left-3 flex items-center gap-1">
        <span className={`text-[8px] font-mono font-800 ${tc.color} opacity-40`}>#{rank + 1}</span>
      </div>

      {/* Severity + breaking */}
      <div className="flex items-center gap-1.5 pt-1 pl-4 flex-wrap">
        {analysis && (
          <span className={`flex items-center gap-1 text-[9px] font-mono font-700 px-1.5 py-0.5 rounded border ${sc.border} ${sc.color} ${sc.bg} uppercase tracking-widest`}>
            {tc.pulse && <span className={`w-1.5 h-1.5 rounded-full ${tc.color.replace("text-", "bg-")} animate-pulse shrink-0`} />}
            {sc.label}
          </span>
        )}
        {item.isBreaking && (
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-500/15 border border-red-500/25">
            <Radio className="w-2 h-2 text-red-400 animate-pulse" />
            <span className="text-[8px] font-mono font-700 text-red-400">LIVE</span>
          </span>
        )}
        {analysis && (
          <span className={`flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded border ${tc.border} ${tc.color}`}>
            {tc.icon}
            {analysis.label}
          </span>
        )}
        <span className="text-[8px] font-mono text-muted-foreground/40 ml-auto">{timeAgo}</span>
      </div>

      {/* Title */}
      <a
        href={item.url !== "#" ? item.url : undefined}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[13px] font-semibold text-white leading-snug hover:text-primary transition-colors group px-1"
      >
        {item.title}
        {item.url !== "#" && (
          <ExternalLink className="inline w-3 h-3 ml-1 text-muted-foreground/30 group-hover:text-primary/60 align-middle" />
        )}
      </a>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center gap-2 px-1 py-2">
          <Loader2 className="w-3 h-3 animate-spin text-muted-foreground/50" />
          <span className="text-[10px] font-mono text-muted-foreground/50">Analyzing market impact…</span>
        </div>
      )}

      {/* Analysis bars */}
      {analysis && (
        <div className="grid grid-cols-3 gap-2 px-1">
          {[
            { label: "Lockdown Risk", value: analysis.lockdownRisk },
            { label: "Economic Impact", value: analysis.economicDisruptionRisk },
            { label: "Market Impact", value: analysis.marketImpactScore },
          ].map(({ label, value }) => (
            <div key={label}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-[8px] font-mono text-muted-foreground/60">{label}</span>
                <span className={`text-[9px] font-mono font-700 ${value >= 0.65 ? "text-red-400" : value >= 0.35 ? "text-amber-400" : "text-emerald-400"}`}>
                  {(value * 100).toFixed(0)}%
                </span>
              </div>
              <div className="h-1 bg-white/[0.05] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${value >= 0.65 ? "bg-red-500/60" : value >= 0.35 ? "bg-amber-500/60" : "bg-emerald-500/60"}`}
                  style={{ width: `${value * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Affected tickers */}
      {analysis && (
        <div className="flex items-center gap-1.5 px-1 flex-wrap">
          <span className="text-[8px] font-mono text-muted-foreground/50 shrink-0">Exposed:</span>
          {analysis.affectedTickers.slice(0, 5).map((t) => (
            <span key={t} className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${tc.border} ${tc.color} bg-transparent`}>{t}</span>
          ))}
          <span className="text-[8px] font-mono text-muted-foreground/40 ml-auto">{analysis.timeHorizon}</span>
        </div>
      )}

      {/* Related Polymarket */}
      {relatedMarkets.length > 0 && (
        <div className="space-y-1.5 px-1">
          <div className="text-[8px] font-mono text-muted-foreground/50 uppercase tracking-widest">Polymarket Odds</div>
          {relatedMarkets.slice(0, 2).map((m, i) => (
            <div key={i} className="flex items-center gap-2 p-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
              <span className={`font-mono text-[13px] font-800 shrink-0 ${m.yesPrice >= 0.5 ? "text-red-400" : "text-amber-400"}`}>
                {(m.yesPrice * 100).toFixed(0)}%
              </span>
              <p className="text-[10px] text-white/70 leading-snug line-clamp-1 flex-1">{m.question}</p>
              {m.oddsShift !== null && Math.abs(m.oddsShift ?? 0) > 0.005 && (
                <span className={`text-[9px] font-mono shrink-0 ${(m.oddsShift ?? 0) > 0 ? "text-red-400" : "text-emerald-400"}`}>
                  {(m.oddsShift ?? 0) > 0 ? "↑" : "↓"}{Math.abs((m.oddsShift ?? 0) * 100).toFixed(1)}pp
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Expandable narrative */}
      {analysis && (
        <div className="px-1">
          <button
            onClick={() => setExpanded((o) => !o)}
            className={`flex items-center gap-1.5 text-[9px] font-mono ${tc.color} hover:opacity-80 transition-opacity`}
          >
            <Eye className="w-3 h-3" />
            {expanded ? "Hide" : "Show"} long-term market analysis
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {expanded && (
            <div className="mt-2 p-2.5 rounded-lg bg-black/20 border border-white/[0.05]">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Radar className="w-3 h-3 text-primary/60" />
                <span className="text-[8px] font-mono text-muted-foreground/60 uppercase tracking-widest">
                  Long-term Impact Analysis · {analysis.timeHorizon}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground/80 leading-relaxed">{analysis.narrative}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {analysis.affectedSectors.slice(0, 4).map((s) => (
                  <span key={s} className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06] text-muted-foreground/60">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Emerging Signal Radar ────────────────────────────────────────────────────
function EmergingSignalRadar({
  news,
  markets,
  isLoading,
}: {
  news: NewsItem[];
  markets: PolymarketMarket[];
  isLoading: boolean;
}) {
  // Score each news item for emergence
  const scored = useMemo(() => {
    return news
      .map((item) => {
        const relatedMarkets = findRelatedMarkets(item.title, item.description ?? "", markets);
        const score = computeEmergenceScore(item, relatedMarkets.length);
        return { item, relatedMarkets, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }, [news, markets]);

  // Fetch geo-impact analysis for each top signal
  const analysisResults = useQueries({
    queries: scored.map(({ item }) => ({
      queryKey: ["geo-impact", item.id],
      queryFn: () => fetchGeoImpact(item),
      staleTime: 5 * 60 * 1000,
      retry: 1,
    })),
  });

  if (isLoading) {
    return (
      <Card className="bg-card/60 border-white/[0.07] backdrop-blur-sm overflow-hidden">
        <div className="h-0.5 w-full bg-gradient-to-r from-violet-500/60 via-primary/40 to-transparent" />
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Radar className="w-3.5 h-3.5 text-violet-400" />
            <span className="text-[11px] font-mono font-700 text-white uppercase tracking-widest">Emerging Signal Radar</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 rounded-xl bg-white/[0.03] border border-white/[0.05] animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (scored.length === 0) return null;

  const highSeverityCount = analysisResults.filter(
    (r) => r.data?.severity === "critical" || r.data?.severity === "elevated",
  ).length;

  return (
    <Card className="bg-card/60 border-violet-500/15 backdrop-blur-sm overflow-hidden">
      <div className="h-0.5 w-full bg-gradient-to-r from-violet-500/70 via-primary/50 to-transparent" />
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="flex items-center gap-2">
              <Radar className="w-3.5 h-3.5 text-violet-400" />
              <span className="text-[11px] font-mono font-700 text-white uppercase tracking-widest">
                Emerging Signal Radar
              </span>
              {highSeverityCount > 0 && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-500/15 border border-red-500/25">
                  <AlertTriangle className="w-2.5 h-2.5 text-red-400" />
                  <span className="text-[8px] font-mono text-red-400 font-700">{highSeverityCount} HIGH</span>
                </span>
              )}
            </div>
            <p className="text-[9px] font-mono text-muted-foreground mt-0.5">
              Novel threats · AI-powered long-term market impact analysis · Catches what Polymarket hasn't priced yet
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {scored.map(({ item, relatedMarkets }, i) => (
            <EmergingSignalCard
              key={item.id}
              item={item}
              analysis={analysisResults[i]?.data}
              isLoading={analysisResults[i]?.isLoading ?? false}
              relatedMarkets={relatedMarkets}
              rank={i}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Polymarket Badge ─────────────────────────────────────────────────────────
function PolymarketBadge({ market }: { market: PolymarketMarket }) {
  const pct = (market.yesPrice * 100).toFixed(0);
  const shift = market.oddsShift;
  const isHighRisk = market.yesPrice >= 0.5;

  return (
    <div className={`mt-2 flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${isHighRisk ? "border-red-500/25 bg-red-500/8" : "border-amber-500/20 bg-amber-500/5"}`}>
      <div className="shrink-0">
        <div className={`text-[13px] font-mono font-700 ${isHighRisk ? "text-red-400" : "text-amber-400"}`}>
          {pct}%
        </div>
        {shift !== null && Math.abs(shift ?? 0) > 0.005 && (
          <div className={`text-[8px] font-mono ${(shift ?? 0) > 0 ? "text-red-400" : "text-emerald-400"}`}>
            {(shift ?? 0) > 0 ? "↑" : "↓"} from {((market.yesPrice - (shift ?? 0)) * 100).toFixed(0)}%
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-white/80 leading-snug line-clamp-2">{market.question}</p>
        <div className="flex items-center gap-1 mt-0.5">
          <span className="text-[8px] font-mono text-muted-foreground/50">Polymarket YES odds</span>
          {shift !== null && Math.abs(shift ?? 0) > 0.005 && (
            <span className={`text-[8px] font-mono font-600 ${(shift ?? 0) > 0 ? "text-red-400/70" : "text-emerald-400/70"}`}>
              · {(shift ?? 0) > 0 ? "rising" : "falling"} since news broke
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── News Intel Card ──────────────────────────────────────────────────────────
function NewsIntelCard({
  item,
  relatedMarkets,
  threatType,
}: {
  item: NewsItem;
  relatedMarkets: PolymarketMarket[];
  threatType?: string;
}) {
  const SENTIMENT_CONFIG = {
    bullish: { color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", dot: "bg-emerald-400", label: "BULLISH" },
    bearish: { color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", dot: "bg-red-400", label: "BEARISH" },
    neutral: { color: "text-muted-foreground", bg: "bg-white/[0.04]", border: "border-white/[0.07]", dot: "bg-muted-foreground", label: "NEUTRAL" },
  };
  const s = SENTIMENT_CONFIG[item.sentiment as keyof typeof SENTIMENT_CONFIG] ?? SENTIMENT_CONFIG.neutral;
  const tc = threatType && threatType !== "unknown" ? getThreatConfig(threatType) : null;

  let timeAgo = "recently";
  try { timeAgo = formatDistanceToNow(new Date(item.publishedAt), { addSuffix: true }); } catch {}

  return (
    <div className={`relative border ${relatedMarkets.length > 0 ? "border-amber-500/20 bg-amber-500/[0.03]" : s.border} rounded-xl p-3.5 ${relatedMarkets.length === 0 ? s.bg : ""} transition-all`}>
      {item.isBreaking && (
        <div className="absolute top-3 right-3 flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-500/20 border border-red-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
          <span className="text-[8px] font-mono font-700 text-red-400 uppercase tracking-widest">Breaking</span>
        </div>
      )}

      <div className="flex items-start gap-2.5 pr-16">
        <div className="shrink-0 mt-0.5">
          <div className={`w-2 h-2 rounded-full ${s.dot} mt-1`} />
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <a
            href={item.url !== "#" ? item.url : undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-[13px] font-semibold text-white leading-snug hover:text-primary transition-colors group"
          >
            <span>{item.title}</span>
            {item.url !== "#" && (
              <ExternalLink className="inline w-3 h-3 ml-1 text-muted-foreground/40 group-hover:text-primary/60 align-middle" />
            )}
          </a>

          {item.description && (
            <p className="text-[11px] text-muted-foreground/70 leading-relaxed line-clamp-2">{item.description}</p>
          )}

          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
            <span className="text-[9px] font-mono font-600 px-1.5 py-0.5 rounded bg-white/[0.05] border border-white/[0.08] text-muted-foreground">
              {item.source}
            </span>
            <span className={`text-[9px] font-mono font-700 px-1.5 py-0.5 rounded border ${s.border} ${s.color} ${s.bg}`}>
              {s.label}
            </span>
            {tc && (
              <span className={`flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded border ${tc.border} ${tc.color}`}>
                {tc.icon}
                <span className="capitalize">{threatType?.replace("_", " ")}</span>
              </span>
            )}
            <div className="flex items-center gap-1 text-[9px] font-mono text-muted-foreground/40 ml-auto">
              <Clock className="w-2.5 h-2.5" />
              {timeAgo}
            </div>
          </div>

          {relatedMarkets.map((m, i) => (
            <PolymarketBadge key={i} market={m} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Breaking Intel Feed ──────────────────────────────────────────────────────
function BreakingIntelFeed({
  news,
  markets,
  isLoading,
}: {
  news: NewsItem[] | undefined;
  markets: PolymarketMarket[];
  isLoading: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const items = Array.isArray(news) ? news : [];
  const breakingItems = items.filter((n) => n.isBreaking);
  const bearishCount = items.filter((n) => n.sentiment === "bearish").length;
  const bullishCount = items.filter((n) => n.sentiment === "bullish").length;

  // Get threat type for category-based badges
  function getThreatTypeFromCategory(category: string): string | undefined {
    const map: Record<string, string> = {
      pandemic: "pandemic",
      health: "pandemic",
      conflict: "conflict",
      nuclear: "nuclear",
      energy: "energy",
      cyber: "cyber",
      climate: "climate",
    };
    return map[category];
  }

  const itemsWithMarkets = useMemo(
    () =>
      items.map((item) => ({
        item,
        relatedMarkets: findRelatedMarkets(item.title, item.description ?? "", markets),
        threatType: getThreatTypeFromCategory(item.category ?? ""),
      })),
    [items, markets],
  );
  const visibleWithMarkets = expanded ? itemsWithMarkets : itemsWithMarkets.slice(0, 6);
  const withPolymarket = itemsWithMarkets.filter((x) => x.relatedMarkets.length > 0).length;

  return (
    <Card className="bg-card/60 border-white/[0.07] backdrop-blur-sm overflow-hidden">
      <div className="h-0.5 w-full bg-gradient-to-r from-amber-500/60 via-primary/40 to-transparent" />
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="flex items-center gap-2">
              <Rss className="w-3.5 h-3.5 text-primary" />
              <span className="text-[11px] font-mono font-700 text-white uppercase tracking-widest">
                Intelligence Feed
              </span>
              {breakingItems.length > 0 && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-500/15 border border-red-500/25">
                  <Radio className="w-2.5 h-2.5 text-red-400 animate-pulse" />
                  <span className="text-[8px] font-mono text-red-400 font-700">{breakingItems.length} LIVE</span>
                </span>
              )}
              {withPolymarket > 0 && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                  <BarChart2 className="w-2.5 h-2.5 text-amber-400" />
                  <span className="text-[8px] font-mono text-amber-400 font-600">{withPolymarket} with odds</span>
                </span>
              )}
            </div>
            <p className="text-[9px] font-mono text-muted-foreground mt-0.5">
              Breaking news · Polymarket prediction odds · Real-money market intelligence
            </p>
          </div>
          {items.length > 0 && (
            <div className="flex items-center gap-2 text-[9px] font-mono">
              <span className="text-emerald-400 font-600">{bullishCount}B</span>
              <span className="text-muted-foreground/40">·</span>
              <span className="text-red-400 font-600">{bearishCount}S</span>
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="mb-3 p-2.5 rounded-lg bg-white/[0.03] border border-white/[0.06]">
            <div className="flex items-center justify-between text-[9px] font-mono text-muted-foreground mb-1.5">
              <span>Aggregate News Sentiment</span>
              <span className={bearishCount > bullishCount ? "text-red-400 font-600" : bullishCount > bearishCount ? "text-emerald-400 font-600" : "text-muted-foreground"}>
                {bearishCount > bullishCount ? "RISK-OFF" : bullishCount > bearishCount ? "RISK-ON" : "MIXED"}
              </span>
            </div>
            <div className="h-1.5 bg-white/[0.04] rounded-full overflow-hidden flex">
              <div className="h-full bg-emerald-500/50 transition-all" style={{ width: `${items.length ? (bullishCount / items.length) * 100 : 0}%` }} />
              <div className="h-full bg-muted-foreground/20 transition-all" style={{ width: `${items.length ? ((items.length - bullishCount - bearishCount) / items.length) * 100 : 0}%` }} />
              <div className="h-full bg-red-500/50 transition-all" style={{ width: `${items.length ? (bearishCount / items.length) * 100 : 0}%` }} />
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 rounded-xl bg-white/[0.03] border border-white/[0.05] animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-white/10 rounded-xl">
            <Newspaper className="w-5 h-5 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-[11px] text-muted-foreground">News feed unavailable</p>
          </div>
        ) : (
          <div className="space-y-2">
            {visibleWithMarkets.map(({ item, relatedMarkets, threatType }, i) => (
              <NewsIntelCard key={item.id ?? i} item={item} relatedMarkets={relatedMarkets} threatType={threatType} />
            ))}
            {items.length > 6 && (
              <button
                onClick={() => setExpanded((o) => !o)}
                className="w-full text-[10px] font-mono text-muted-foreground/60 hover:text-white py-2 transition-colors flex items-center justify-center gap-1.5"
              >
                {expanded ? (
                  <><ChevronUp className="w-3 h-3" /> Show less</>
                ) : (
                  <><ChevronDown className="w-3 h-3" /> {items.length - 6} more stories</>
                )}
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Global Risk Barometer ────────────────────────────────────────────────────
function GlobalRiskBarometer({ markets, news }: { markets: PolymarketMarket[]; news: NewsItem[] }) {
  const geoMarkets = markets.filter((m) => {
    const q = m.question.toLowerCase();
    return /war|conflict|attack|crisis|sanction|nuclear|invasion|strike|threat|tension|ceasefire|escalat/.test(q);
  });
  const pandemicNews = news.filter((n) => n.category === "pandemic" || n.category === "health");

  const score =
    geoMarkets.length === 0
      ? 0
      : geoMarkets.reduce((s, m) => s + m.yesPrice, 0) / geoMarkets.length;
  const level = score >= 0.55 ? "ELEVATED" : score >= 0.35 ? "MODERATE" : "CONTAINED";
  const levelColor = score >= 0.55 ? "text-red-400" : score >= 0.35 ? "text-amber-400" : "text-emerald-400";
  const barColor = score >= 0.55 ? "from-red-600 to-red-400" : score >= 0.35 ? "from-amber-600 to-amber-400" : "from-emerald-600 to-emerald-400";
  const glow = score >= 0.55 ? "rgba(248,113,113,0.4)" : score >= 0.35 ? "rgba(251,191,36,0.4)" : "rgba(52,211,153,0.4)";

  return (
    <Card className="bg-card/60 border-white/[0.07] backdrop-blur-sm overflow-hidden">
      <div className={`h-0.5 w-full bg-gradient-to-r ${barColor} to-transparent`} />
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">Global Risk Barometer</div>
            <div className="flex items-baseline gap-2">
              <span className={`font-display text-3xl font-800 ${levelColor}`}>{(score * 100).toFixed(0)}</span>
              <span className="text-[11px] font-mono text-muted-foreground">/100</span>
              <span className={`text-[10px] font-mono font-700 ${levelColor} ml-1 tracking-widest`}>{level}</span>
            </div>
            <p className="text-[10px] text-muted-foreground font-mono">Aggregated from {geoMarkets.length} conflict & crisis markets</p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <Activity className={`w-5 h-5 ${levelColor}`} style={{ filter: `drop-shadow(0 0 6px ${glow})` }} />
            <div className="text-[9px] font-mono text-muted-foreground">{markets.length} total markets</div>
          </div>
        </div>
        <div className="mt-3 space-y-1.5">
          <div className="h-2.5 bg-white/[0.04] rounded-full overflow-hidden border border-white/[0.06]">
            <div
              className={`h-full rounded-full bg-gradient-to-r ${barColor} transition-all duration-700`}
              style={{ width: `${score * 100}%`, boxShadow: `0 0 8px ${glow}` }}
            />
          </div>
          <div className="flex justify-between text-[9px] font-mono text-muted-foreground/50">
            <span>CONTAINED</span><span>MODERATE</span><span>ELEVATED</span><span>CRITICAL</span>
          </div>
        </div>
        {pandemicNews.length > 0 && (
          <div className="mt-3 pt-3 border-t border-white/[0.05]">
            <div className="flex items-center gap-1.5">
              <Thermometer className="w-3 h-3 text-violet-400" />
              <span className="text-[9px] font-mono text-violet-400 font-600 uppercase tracking-widest">
                Health Signal Active
              </span>
              <span className="text-[9px] font-mono text-muted-foreground ml-1">
                {pandemicNews.length} health/pandemic news item{pandemicNews.length > 1 ? "s" : ""} detected
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Market Card ──────────────────────────────────────────────────────────────
function MarketCard({ market, region }: { market: PolymarketMarket & { region: string }; region: string }) {
  const [expanded, setExpanded] = useState(false);
  const risk = riskLevel(market.yesPrice);
  const exposure = getMarketExposure(market.question);
  const yesDir = market.yesPrice >= 0.5 ? "up" : "down";
  const shift = market.oddsShift;

  return (
    <Card className={`border ${risk.border} ${risk.bg} backdrop-blur-sm overflow-hidden transition-all`}>
      <CardContent className="p-4">
        <div className="flex gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white text-[13px] leading-snug mb-1.5">{market.question}</h3>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[9px] font-mono font-700 px-2 py-0.5 rounded-full border ${risk.border} ${risk.color} ${risk.bg} uppercase tracking-widest`}>
                {risk.label} RISK
              </span>
              {market.category && (
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground uppercase tracking-widest border border-white/[0.06]">
                  {market.category}
                </span>
              )}
              <span className="text-[9px] font-mono text-muted-foreground">
                {REGION_CONFIG[region]?.flag ?? "🌐"} {REGION_CONFIG[region]?.label ?? region}
              </span>
            </div>
          </div>
          <div className="shrink-0 flex flex-col items-end gap-1">
            <div className={`font-display text-2xl font-800 ${risk.color}`}>{(market.yesPrice * 100).toFixed(0)}%</div>
            {shift !== null && Math.abs(shift ?? 0) > 0.005 ? (
              <div className={`text-[9px] font-mono font-600 flex items-center gap-0.5 ${(shift ?? 0) > 0 ? "text-red-400" : "text-emerald-400"}`}>
                {(shift ?? 0) > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {(shift ?? 0) > 0 ? "+" : ""}{((shift ?? 0) * 100).toFixed(1)}pp
              </div>
            ) : (
              <div className="flex items-center gap-1 text-[9px] font-mono text-muted-foreground">
                {yesDir === "up" ? <TrendingUp className="w-3 h-3 text-emerald-400" /> : <TrendingDown className="w-3 h-3 text-red-400" />}
                YES
              </div>
            )}
          </div>
        </div>

        <div className="space-y-1.5 mb-3">
          <div className="relative h-7 bg-white/[0.04] rounded-lg overflow-hidden border border-white/[0.04]">
            <div className="absolute left-0 top-0 bottom-0 transition-all duration-500" style={{ width: `${market.yesPrice * 100}%`, background: `rgba(${market.yesPrice > 0.6 ? "239,68,68" : market.yesPrice > 0.4 ? "251,191,36" : "52,211,153"},0.2)` }} />
            <div className="relative flex justify-between w-full h-full px-2.5 items-center z-10">
              <span className="text-[10px] font-semibold font-mono text-emerald-400">YES</span>
              <span className="text-[11px] font-mono font-600 text-white">{(market.yesPrice * 100).toFixed(1)}%</span>
            </div>
          </div>
          <div className="relative h-7 bg-white/[0.04] rounded-lg overflow-hidden border border-white/[0.04]">
            <div className="absolute left-0 top-0 bottom-0 bg-blue-500/10" style={{ width: `${market.noPrice * 100}%` }} />
            <div className="relative flex justify-between w-full h-full px-2.5 items-center z-10">
              <span className="text-[10px] font-semibold font-mono text-blue-400">NO</span>
              <span className="text-[11px] font-mono font-600 text-white">{(market.noPrice * 100).toFixed(1)}%</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-white/[0.05] pt-2.5">
          <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
            <div className="flex items-center gap-1">
              <BarChart2 className="w-3 h-3" />
              <span>${(market.volume ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} vol</span>
            </div>
            {market.endDate && (
              <div className="flex items-center gap-1">
                <CalendarDays className="w-3 h-3" />
                {format(new Date(market.endDate), "MMM d, yyyy")}
              </div>
            )}
          </div>
          <button
            onClick={() => setExpanded((o) => !o)}
            className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          >
            <Zap className="w-3 h-3 text-primary/60" />
            Market Impact
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        {expanded && (
          <div className="mt-3 pt-3 border-t border-white/[0.05] space-y-2">
            <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest mb-2">Exposed Assets</div>
            <div className="flex flex-wrap gap-1.5">
              {exposure.tickers.map((t) => (
                <span key={t} className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary">{t}</span>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground/80 leading-relaxed">{exposure.note}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────
export default function Geopolitics() {
  const { data: markets, isLoading: marketsLoading } = useGetPolymarketMarkets(undefined, {
    query: { queryKey: getGetPolymarketMarketsQueryKey(), refetchInterval: 5 * 60 * 1000 },
  });
  const { data: news, isLoading: newsLoading } = useGetNews(undefined, {
    query: { queryKey: getGetNewsQueryKey(), refetchInterval: 5 * 60 * 1000 },
  });

  const [activeRegion, setActiveRegion] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"risk" | "volume" | "deadline">("risk");

  const marketList = Array.isArray(markets) ? markets : [];
  const newsList = Array.isArray(news) ? (news as NewsItem[]) : [];

  const marketsWithRegion = useMemo(
    () => marketList.map((m) => ({ ...m, region: classifyRegion(m) })),
    [marketList],
  );

  const filtered = useMemo(() => {
    const base = activeRegion === "all" ? marketsWithRegion : marketsWithRegion.filter((m) => m.region === activeRegion);
    return [...base].sort((a, b) => {
      if (sortBy === "risk") return b.yesPrice - a.yesPrice;
      if (sortBy === "volume") return (b.volume ?? 0) - (a.volume ?? 0);
      if (sortBy === "deadline") {
        if (!a.endDate) return 1;
        if (!b.endDate) return -1;
        return new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
      }
      return 0;
    });
  }, [marketsWithRegion, activeRegion, sortBy]);

  const highRiskCount = filtered.filter((m) => m.yesPrice >= 0.65).length;
  const mediumRiskCount = filtered.filter((m) => m.yesPrice >= 0.35 && m.yesPrice < 0.65).length;

  return (
    <div className="space-y-5 animate-fade-up">
      <div>
        <h1 className="font-display text-[22px] font-700 text-white tracking-tight leading-none">Geopolitics</h1>
        <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1.5 font-mono">
          <Globe className="w-3 h-3 text-primary" />
          Emerging threat detection · Long-term market impact predictions · Real-money Polymarket odds
        </p>
      </div>

      {/* Emerging Signal Radar — top billing */}
      <EmergingSignalRadar news={newsList} markets={marketList} isLoading={newsLoading || marketsLoading} />

      {/* Risk barometer + Intel feed side by side on large screens */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5">
        <div className="space-y-5">
          {!marketsLoading && marketList.length > 0 && (
            <GlobalRiskBarometer markets={marketList} news={newsList} />
          )}

          {/* Quick stats */}
          {!marketsLoading && filtered.length > 0 && (
            <div className="space-y-2">
              {highRiskCount > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                  <span className="text-[11px] font-mono text-red-400 font-600">{highRiskCount} HIGH RISK markets</span>
                </div>
              )}
              {mediumRiskCount > 0 && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <Shield className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-[11px] font-mono text-amber-400 font-600">{mediumRiskCount} MEDIUM RISK markets</span>
                </div>
              )}
              <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <span className="text-[10px] font-mono text-muted-foreground">Sort markets by</span>
                <div className="flex gap-1">
                  {(["risk", "volume", "deadline"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setSortBy(s)}
                      className={`px-2 py-0.5 rounded text-[9px] font-mono uppercase tracking-wide transition-colors ${sortBy === s ? "bg-primary/15 text-primary border border-primary/30" : "text-muted-foreground hover:text-white"}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <BreakingIntelFeed news={newsList} markets={marketList} isLoading={newsLoading} />
      </div>

      {/* Region filters */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-1 px-1 no-scrollbar">
        {Object.entries(REGION_CONFIG).map(([key, cfg]) => (
          <button
            key={key}
            onClick={() => setActiveRegion(key)}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-mono font-600 transition-all ${activeRegion === key ? "bg-primary/15 text-primary border border-primary/30" : "bg-white/[0.04] text-muted-foreground border border-white/[0.07] hover:border-white/15 hover:text-white"}`}
          >
            <span>{cfg.flag}</span>
            <span>{cfg.label}</span>
          </button>
        ))}
      </div>

      {/* Markets grid */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <BarChart2 className="w-3.5 h-3.5 text-primary" />
          <span className="text-[11px] font-mono font-700 text-white uppercase tracking-widest">Prediction Markets</span>
          <span className="text-[9px] font-mono text-muted-foreground ml-1">
            {filtered.length} markets · real-money odds
          </span>
          {filtered.length > 0 && (
            <span className="ml-auto flex items-center gap-1 text-[9px] font-mono text-muted-foreground/50">
              <ArrowRight className="w-3 h-3" /> Sorted by {sortBy}
            </span>
          )}
        </div>
        {marketsLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-40 rounded-xl bg-white/[0.03] border border-white/[0.05] animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-white/10 rounded-xl">
            <Globe className="w-6 h-6 text-muted-foreground/20 mx-auto mb-2" />
            <p className="text-[11px] text-muted-foreground">No markets for this region</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((market) => (
              <MarketCard key={market.id} market={market} region={market.region} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
