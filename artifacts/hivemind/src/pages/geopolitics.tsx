import React, { useState, useMemo } from "react";
import { useGetPolymarketMarkets, getGetPolymarketMarketsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Globe, BarChart2, CalendarDays, AlertTriangle, TrendingUp, TrendingDown,
  Zap, Shield, Activity, ChevronDown, ChevronUp,
} from "lucide-react";
import { format } from "date-fns";

const REGION_CONFIG: Record<string, { label: string; flag: string; keywords: string[] }> = {
  all:        { label: "All Regions", flag: "🌐", keywords: [] },
  americas:   { label: "Americas",    flag: "🌎", keywords: ["us", "usa", "america", "canada", "mexico", "brazil", "latin", "election", "trump", "biden", "congress", "fed", "dollar"] },
  europe:     { label: "Europe",      flag: "🇪🇺", keywords: ["europe", "eu", "nato", "ukraine", "russia", "uk", "britain", "germany", "france", "ecb", "euro"] },
  middleeast: { label: "Middle East", flag: "🌙", keywords: ["iran", "israel", "saudi", "gulf", "opec", "oil", "yemen", "iraq", "syria", "hormuz", "hamas", "hezbollah"] },
  asia:       { label: "Asia Pacific", flag: "🌏", keywords: ["china", "taiwan", "japan", "korea", "india", "asean", "xi", "south china", "pacific", "semiconductor"] },
  global:     { label: "Global",      flag: "⚡", keywords: ["global", "world", "imf", "g7", "g20", "wto", "pandemic", "climate", "inflation", "rate", "nuclear"] },
};

const MARKET_EXPOSURE: Record<string, { tickers: string[]; note: string }> = {
  oil:       { tickers: ["XOM", "CVX", "USO", "SPY"],     note: "Energy sector + oil-linked assets" },
  china:     { tickers: ["BABA", "JD", "NVDA", "TSM"],    note: "Semiconductor & China-exposed tech" },
  taiwan:    { tickers: ["TSM", "NVDA", "AMAT", "SPY"],   note: "Semiconductor supply chain at risk" },
  ukraine:   { tickers: ["CORN", "WEAT", "XOM", "SPY"],   note: "Commodities + European defence" },
  iran:      { tickers: ["USO", "XOM", "GLD", "BTC"],     note: "Oil + safe havens spike on Strait tensions" },
  election:  { tickers: ["SPY", "TLT", "DXY", "BTC"],    note: "Volatility + policy repricing" },
  fed:       { tickers: ["TLT", "SPY", "GLD", "BTC"],     note: "Rate-sensitive assets across the board" },
  nuclear:   { tickers: ["GLD", "BTC", "TLT", "VIX"],     note: "Flight to safety — classic risk-off trade" },
  default:   { tickers: ["SPY", "GLD", "BTC"],            note: "Broad market + safe-haven impact" },
};

function getMarketExposure(question: string) {
  const q = question.toLowerCase();
  if (/iran|hormuz|opec|oil/.test(q)) return MARKET_EXPOSURE.oil;
  if (/china|beijing|ccp/.test(q))   return MARKET_EXPOSURE.china;
  if (/taiwan/.test(q))              return MARKET_EXPOSURE.taiwan;
  if (/ukraine|russia|zelensky/.test(q)) return MARKET_EXPOSURE.ukraine;
  if (/iran|strait/.test(q))         return MARKET_EXPOSURE.iran;
  if (/election|vote|ballot/.test(q)) return MARKET_EXPOSURE.election;
  if (/fed|rate|interest|inflation/.test(q)) return MARKET_EXPOSURE.fed;
  if (/nuclear|nuke|warhead/.test(q)) return MARKET_EXPOSURE.nuclear;
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

function riskLevel(yesPrice: number): { label: string; color: string; bg: string; border: string } {
  if (yesPrice >= 0.65) return { label: "HIGH",   color: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/20" };
  if (yesPrice >= 0.35) return { label: "MEDIUM", color: "text-amber-400",  bg: "bg-amber-500/10",  border: "border-amber-500/20" };
  return               { label: "LOW",    color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" };
}

function GlobalRiskBarometer({ markets }: { markets: { yesPrice: number; question: string }[] }) {
  const geoMarkets = markets.filter((m) => {
    const q = m.question.toLowerCase();
    return /war|conflict|attack|crisis|sanction|nuclear|invasion|strike|threat|tension/.test(q);
  });
  const score = geoMarkets.length === 0
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
            <p className="text-[10px] text-muted-foreground font-mono">
              Aggregated from {geoMarkets.length} conflict & crisis prediction markets
            </p>
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
      </CardContent>
    </Card>
  );
}

function MarketCard({ market, region }: { market: { id: string; question: string; yesPrice: number; noPrice: number; volume?: number | null; endDate?: string | null; category?: string | null }; region: string }) {
  const [expanded, setExpanded] = useState(false);
  const risk = riskLevel(market.yesPrice);
  const exposure = getMarketExposure(market.question);
  const yesDir = market.yesPrice >= 0.5 ? "up" : "down";

  return (
    <Card className={`border ${risk.border} ${risk.bg} backdrop-blur-sm overflow-hidden transition-all duration-200`}>
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2 mb-1.5">
              <h3 className="font-semibold text-white text-[13px] leading-snug flex-1">{market.question}</h3>
            </div>
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
            <div className={`font-display text-2xl font-800 ${risk.color}`}>
              {(market.yesPrice * 100).toFixed(0)}%
            </div>
            <div className="flex items-center gap-1 text-[9px] font-mono text-muted-foreground">
              {yesDir === "up" ? <TrendingUp className="w-3 h-3 text-emerald-400" /> : <TrendingDown className="w-3 h-3 text-red-400" />}
              YES probability
            </div>
          </div>
        </div>

        {/* YES/NO probability bars */}
        <div className="space-y-1.5 mb-3">
          <div className="relative h-7 bg-white/[0.04] rounded-lg overflow-hidden border border-white/[0.04]">
            <div
              className="absolute left-0 top-0 bottom-0 transition-all duration-500"
              style={{
                width: `${market.yesPrice * 100}%`,
                background: `rgba(${market.yesPrice > 0.6 ? "239,68,68" : market.yesPrice > 0.4 ? "251,191,36" : "52,211,153"},0.2)`,
              }}
            />
            <div className="relative flex justify-between w-full h-full px-2.5 items-center z-10">
              <span className="text-[10px] font-semibold font-mono text-emerald-400">YES</span>
              <span className="text-[11px] font-mono font-600 text-white">{(market.yesPrice * 100).toFixed(1)}%</span>
            </div>
          </div>
          <div className="relative h-7 bg-white/[0.04] rounded-lg overflow-hidden border border-white/[0.04]">
            <div
              className="absolute left-0 top-0 bottom-0 bg-blue-500/10 transition-all duration-500"
              style={{ width: `${market.noPrice * 100}%` }}
            />
            <div className="relative flex justify-between w-full h-full px-2.5 items-center z-10">
              <span className="text-[10px] font-semibold font-mono text-blue-400">NO</span>
              <span className="text-[11px] font-mono font-600 text-white">{(market.noPrice * 100).toFixed(1)}%</span>
            </div>
          </div>
        </div>

        {/* Meta row */}
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

        {/* Market impact expansion */}
        {expanded && (
          <div className="mt-3 pt-3 border-t border-white/[0.05] space-y-2">
            <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest mb-2">Exposed Assets</div>
            <div className="flex flex-wrap gap-1.5">
              {exposure.tickers.map((t) => (
                <span
                  key={t}
                  className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary"
                >
                  {t}
                </span>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground/80 leading-relaxed">{exposure.note}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Geopolitics() {
  const { data: markets, isLoading } = useGetPolymarketMarkets(undefined, {
    query: { queryKey: getGetPolymarketMarketsQueryKey() },
  });
  const [activeRegion, setActiveRegion] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"risk" | "volume" | "deadline">("risk");

  const marketList = Array.isArray(markets) ? markets : [];

  const marketsWithRegion = useMemo(
    () => marketList.map((m) => ({ ...m, region: classifyRegion(m) })),
    [marketList]
  );

  const filtered = useMemo(() => {
    const base = activeRegion === "all"
      ? marketsWithRegion
      : marketsWithRegion.filter((m) => m.region === activeRegion);

    return [...base].sort((a, b) => {
      if (sortBy === "risk")     return b.yesPrice - a.yesPrice;
      if (sortBy === "volume")   return (b.volume ?? 0) - (a.volume ?? 0);
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
      {/* Header */}
      <div>
        <h1 className="font-display text-[22px] font-700 text-white tracking-tight leading-none">Geopolitics</h1>
        <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1.5 font-mono">
          <Globe className="w-3 h-3 text-primary" />
          Real-money prediction market intelligence · Polymarket live odds
        </p>
      </div>

      {/* Global Risk Barometer */}
      {!isLoading && marketList.length > 0 && (
        <GlobalRiskBarometer markets={marketList} />
      )}

      {/* Risk summary pills */}
      {filtered.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {highRiskCount > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20">
              <AlertTriangle className="w-3 h-3 text-red-400" />
              <span className="text-[10px] font-mono text-red-400 font-600">{highRiskCount} HIGH</span>
            </div>
          )}
          {mediumRiskCount > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
              <Shield className="w-3 h-3 text-amber-400" />
              <span className="text-[10px] font-mono text-amber-400 font-600">{mediumRiskCount} MEDIUM</span>
            </div>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            <span className="text-[9px] font-mono text-muted-foreground">Sort:</span>
            {(["risk", "volume", "deadline"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className={`px-2 py-0.5 rounded text-[9px] font-mono uppercase tracking-wide transition-colors ${
                  sortBy === s
                    ? "bg-primary/15 text-primary border border-primary/30"
                    : "text-muted-foreground hover:text-white"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Region tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4" style={{ scrollbarWidth: "none" }}>
        {Object.entries(REGION_CONFIG).map(([key, cfg]) => {
          const count = key === "all" ? marketsWithRegion.length : marketsWithRegion.filter((m) => m.region === key).length;
          if (count === 0 && key !== "all") return null;
          return (
            <button
              key={key}
              onClick={() => setActiveRegion(key)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-semibold tracking-widest uppercase transition-all duration-200 ${
                activeRegion === key
                  ? "bg-primary text-primary-foreground shadow-[0_0_12px_rgba(0,212,255,0.4)]"
                  : "bg-card/60 text-muted-foreground border border-white/[0.07] hover:border-white/20 hover:text-white"
              }`}
            >
              <span>{cfg.flag}</span>
              <span>{cfg.label}</span>
              <span className={`text-[9px] rounded px-1 ${activeRegion === key ? "bg-white/20" : "bg-white/[0.06]"}`}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Market cards */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 rounded-xl bg-card/40 border border-white/[0.05] animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-white/10 rounded-xl">
          <Globe className="w-6 h-6 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-[12px] text-muted-foreground">No markets in this region.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((market) => (
            <MarketCard key={market.id} market={market} region={market.region} />
          ))}
        </div>
      )}
    </div>
  );
}
