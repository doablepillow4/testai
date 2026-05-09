import React, { useState, useRef, useEffect } from "react";
import {
  useGetMarketPrices,
  useRunMonteCarlo,
  useGetMarketQuote,
  getGetMarketQuoteQueryKey,
} from "@workspace/api-client-react";
import type { MonteCarloResult } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import {
  Activity,
  Play,
  BarChart2,
  Search,
  X,
  ChevronDown,
  AlertTriangle,
  Globe,
} from "lucide-react";

// ─── Presets ──────────────────────────────────────────────────────────────────
interface Preset {
  label: string;
  emoji: string;
  volatility: number;
  eventImpact: number;
  timeHorizon: number;
  color: string;
  description: string;
}

const MARKET_PRESETS: Preset[] = [
  {
    label: "Black Swan",
    emoji: "🦢",
    volatility: 75,
    eventImpact: -30,
    timeHorizon: 14,
    color: "border-red-500/40 text-red-400 bg-red-500/5 hover:bg-red-500/10",
    description: "Systemic shock — fat-tail crash event",
  },
  {
    label: "Earnings Beat",
    emoji: "📈",
    volatility: 45,
    eventImpact: 12,
    timeHorizon: 30,
    color: "border-emerald-500/40 text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/10",
    description: "Blowout quarter with raised guidance",
  },
  {
    label: "Fed Shock",
    emoji: "🏦",
    volatility: 35,
    eventImpact: -8,
    timeHorizon: 90,
    color: "border-orange-500/40 text-orange-400 bg-orange-500/5 hover:bg-orange-500/10",
    description: "Surprise 50bps hike — policy shock",
  },
  {
    label: "Bull Run",
    emoji: "🚀",
    volatility: 28,
    eventImpact: 20,
    timeHorizon: 60,
    color: "border-primary/40 text-primary bg-primary/5 hover:bg-primary/10",
    description: "Institutional FOMO + momentum breakout",
  },
  {
    label: "Rate Cut",
    emoji: "✂️",
    volatility: 22,
    eventImpact: 6,
    timeHorizon: 45,
    color: "border-violet-500/40 text-violet-400 bg-violet-500/5 hover:bg-violet-500/10",
    description: "Fed pivot → risk-on rotation",
  },
];

const GEO_PRESETS: Preset[] = [
  {
    label: "Ukraine Ceasefire",
    emoji: "🕊️",
    volatility: 18,
    eventImpact: 5,
    timeHorizon: 30,
    color: "border-emerald-500/40 text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/10",
    description: "Risk-on rally: commodities normalize",
  },
  {
    label: "Taiwan Escalation",
    emoji: "⚔️",
    volatility: 65,
    eventImpact: -18,
    timeHorizon: 21,
    color: "border-red-500/40 text-red-400 bg-red-500/5 hover:bg-red-500/10",
    description: "Semi supply chain + risk-off shock",
  },
  {
    label: "Iran Oil Shock",
    emoji: "🛢️",
    volatility: 55,
    eventImpact: -12,
    timeHorizon: 14,
    color: "border-orange-500/40 text-orange-400 bg-orange-500/5 hover:bg-orange-500/10",
    description: "Hormuz closure → energy spike",
  },
  {
    label: "Crypto Regulation",
    emoji: "⚖️",
    volatility: 50,
    eventImpact: -15,
    timeHorizon: 30,
    color: "border-amber-500/40 text-amber-400 bg-amber-500/5 hover:bg-amber-500/10",
    description: "SEC/regulatory crackdown on digital assets",
  },
  {
    label: "Nuclear Scare",
    emoji: "☢️",
    volatility: 90,
    eventImpact: -35,
    timeHorizon: 7,
    color: "border-red-600/50 text-red-300 bg-red-600/5 hover:bg-red-600/10",
    description: "Extreme tail: flight to gold + BTC",
  },
  {
    label: "Peace Deal",
    emoji: "🤝",
    volatility: 20,
    eventImpact: 8,
    timeHorizon: 30,
    color: "border-cyan-500/40 text-cyan-400 bg-cyan-500/5 hover:bg-cyan-500/10",
    description: "Broad geopolitical de-escalation",
  },
];

// ─── Ticker Combobox ──────────────────────────────────────────────────────────
interface TickerOption {
  symbol: string;
  name: string;
  price: number;
  type: string;
}

interface TickerComboboxProps {
  value: string;
  onChange: (symbol: string, price?: number) => void;
  options: TickerOption[];
  onQuoteLookup?: (symbol: string) => void;
}

function TickerCombobox({ value, onChange, options, onQuoteLookup }: TickerComboboxProps) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!value) setQuery("");
  }, [value]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const q = query.trim().toUpperCase();
  const filtered = q
    ? options.filter((o) => o.symbol.includes(q) || o.name.toUpperCase().includes(q))
    : options;
  const exactMatch = options.find((o) => o.symbol === q);
  const isCustom = q.length > 0 && !exactMatch;

  function select(symbol: string, price?: number) {
    setQuery(symbol);
    setOpen(false);
    onChange(symbol, price);
    if (!price && symbol && onQuoteLookup) onQuoteLookup(symbol);
  }

  function clear() {
    setQuery("");
    onChange("", undefined);
    inputRef.current?.focus();
  }

  return (
    <div ref={containerRef} className="relative">
      <div
        className={`flex items-center gap-2 bg-black/30 border rounded-lg px-3 h-10 transition-colors ${open ? "border-primary/50 shadow-[0_0_0_1px_rgba(0,212,255,0.2)]" : "border-white/10"}`}
      >
        <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <input
          ref={inputRef}
          type="text"
          className="flex-1 bg-transparent outline-none text-sm font-mono text-white placeholder:text-muted-foreground min-w-0"
          placeholder="Symbol or name… (e.g. DOGE, PLTR, ARB, HOOD)"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value.toUpperCase());
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
            if (e.key === "Enter") {
              if (filtered.length > 0) select(filtered[0].symbol, filtered[0].price);
              else if (q.length > 0) select(q);
            }
          }}
        />
        {query ? (
          <button
            onClick={clear}
            className="text-muted-foreground hover:text-white transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        )}
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-[hsl(222,32%,8%)] border border-white/10 rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto">
          {filtered.length > 0 ? (
            <>
              {filtered.map((opt) => (
                <button
                  key={opt.symbol}
                  className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/[0.05] transition-colors text-left"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    select(opt.symbol, opt.price);
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-white/10 text-muted-foreground bg-white/[0.03]">
                      {opt.type === "crypto" ? "CRYPTO" : "STOCK"}
                    </span>
                    <div>
                      <div className="text-sm font-mono font-600 text-white">{opt.symbol}</div>
                      <div className="text-[10px] text-muted-foreground">{opt.name}</div>
                    </div>
                  </div>
                  <div className="text-[12px] font-mono text-primary">
                    $
                    {opt.price.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                </button>
              ))}
              {isCustom && (
                <div className="border-t border-white/[0.06]">
                  <button
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-primary/5 transition-colors text-left"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      select(q);
                    }}
                  >
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-primary/30 text-primary bg-primary/5">
                      LOOKUP
                    </span>
                    <div>
                      <div className="text-sm font-mono font-600 text-white">{q}</div>
                      <div className="text-[10px] text-muted-foreground">
                        Fetch live quote from market
                      </div>
                    </div>
                  </button>
                </div>
              )}
            </>
          ) : q.length > 0 ? (
            <button
              className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-primary/5 transition-colors text-left"
              onMouseDown={(e) => {
                e.preventDefault();
                select(q);
              }}
            >
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-primary/30 text-primary bg-primary/5">
                LOOKUP
              </span>
              <div>
                <div className="text-sm font-mono font-600 text-white">{q}</div>
                <div className="text-[10px] text-muted-foreground">
                  Fetch live quote from market
                </div>
              </div>
            </button>
          ) : (
            <div className="px-3 py-4 text-center text-[12px] text-muted-foreground">
              Type to search or enter any ticker
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Geo Intelligence Panel ───────────────────────────────────────────────────
function GeoIntelPanel({
  signals,
}: {
  signals: NonNullable<MonteCarloResult["geopoliticsContext"]>;
}) {
  if (signals.length === 0) return null;
  return (
    <Card className="bg-card/60 border-white/[0.07] backdrop-blur-sm overflow-hidden">
      <div className="h-0.5 w-full bg-gradient-to-r from-orange-500/60 via-amber-400/40 to-transparent" />
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Globe className="w-3.5 h-3.5 text-orange-400" />
          <span className="text-[11px] font-mono font-700 text-white uppercase tracking-widest">
            Live Geo Intelligence
          </span>
          <span className="text-[9px] font-mono text-muted-foreground ml-1">
            · Polymarket odds feeding this simulation
          </span>
        </div>
        <div className="space-y-2.5">
          {signals.map((sig, i) => {
            const pct = (sig.yesPrice * 100).toFixed(0);
            const shift = sig.oddsShift;
            const isHigh = sig.yesPrice >= 0.5;
            return (
              <div
                key={i}
                className={`rounded-lg border p-3 ${isHigh ? "border-red-500/20 bg-red-500/5" : "border-white/[0.06] bg-white/[0.02]"}`}
              >
                <div className="flex items-start justify-between gap-3 mb-1.5">
                  <p className="text-[11px] text-white/90 leading-snug flex-1">{sig.question}</p>
                  <div className="shrink-0 text-right">
                    <div
                      className={`text-[18px] font-mono font-700 ${isHigh ? "text-red-400" : "text-amber-400"}`}
                    >
                      {pct}%
                    </div>
                    {shift != null && Math.abs(shift) > 0.005 && (
                      <div
                        className={`text-[9px] font-mono ${shift > 0 ? "text-red-400" : "text-emerald-400"}`}
                      >
                        {shift > 0 ? "↑" : "↓"} {Math.abs(shift * 100).toFixed(1)}pp
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1 bg-white/[0.05] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${isHigh ? "bg-red-500/50" : "bg-amber-500/40"}`}
                      style={{ width: `${sig.yesPrice * 100}%` }}
                    />
                  </div>
                  <span className="text-[9px] font-mono text-muted-foreground/60 shrink-0">
                    {sig.marketImpact}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground/40 mt-2.5">
          Real-money prediction markets · odds are live Polymarket YES prices
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Simulator() {
  const { data: prices, isLoading: pricesLoading } = useGetMarketPrices({ live: true }, {
    query: { refetchOnMount: "always", staleTime: 0 },
  });
  const runMonteCarlo = useRunMonteCarlo();
  const [activeTab, setActiveTab] = useState<"market" | "geo">("market");

  const [selectedSymbol, setSelectedSymbol] = useState<string>("");
  const [customPrice, setCustomPrice] = useState<string>("");
  const [volatility, setVolatility] = useState<number>(20);
  const [eventImpact, setEventImpact] = useState<number>(0);
  const [timeHorizon, setTimeHorizon] = useState<number>(30);
  const [simulations, setSimulations] = useState<number>(1000);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [lookupSymbol, setLookupSymbol] = useState<string | null>(null);

  const lookupKey = lookupSymbol ?? "SKIP";
  const { data: quotedAsset, isFetching: quoteFetching } = useGetMarketQuote(lookupKey, {
    query: {
      queryKey: getGetMarketQuoteQueryKey(lookupKey),
      enabled: !!lookupSymbol && lookupSymbol !== "SKIP",
    },
  });

  const priceList = Array.isArray(prices) ? prices : [];
  const knownAsset =
    priceList.find((p) => p.symbol === selectedSymbol) ??
    (quotedAsset?.symbol === selectedSymbol ? quotedAsset : null);
  const isCustomTicker = selectedSymbol.length > 0 && !knownAsset;
  const effectivePrice = knownAsset?.price ?? (parseFloat(customPrice) || 0);

  function handleTickerChange(symbol: string, price?: number) {
    setSelectedSymbol(symbol);
    setLookupSymbol(null);
    if (!price) setCustomPrice("");
    setActivePreset(null);
  }

  function handleQuoteLookup(symbol: string) {
    if (symbol) setLookupSymbol(symbol);
  }

  function applyPreset(preset: Preset) {
    setVolatility(preset.volatility);
    setEventImpact(preset.eventImpact);
    setTimeHorizon(preset.timeHorizon);
    setActivePreset(preset.label);
  }

  function handleRun() {
    const price = effectivePrice;
    if (!selectedSymbol || !price || price <= 0) return;
    runMonteCarlo.mutate({
      data: {
        symbol: selectedSymbol,
        currentPrice: price,
        volatility,
        eventImpact,
        timeHorizon,
        simulations,
      },
    });
  }

  const result = runMonteCarlo.data;
  const canRun = selectedSymbol.length > 0 && effectivePrice > 0;
  const allPresets = activeTab === "market" ? MARKET_PRESETS : GEO_PRESETS;

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div>
        <h1 className="font-display text-[22px] font-700 text-white tracking-tight leading-none">
          Event Simulator
        </h1>
        <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1.5 font-mono">
          <Activity className="w-3 h-3 text-primary" />
          Monte Carlo Engine · GBM + Event Shock · Live Geo Intelligence
        </p>
      </div>

      {/* Controls */}
      <Card className="bg-card/60 border-white/[0.07] backdrop-blur-sm">
        <CardContent className="p-5 space-y-5">
          {/* Asset search */}
          <div className="space-y-1.5">
            <label className="data-label">Target Asset</label>
            <TickerCombobox
              value={selectedSymbol}
              onChange={handleTickerChange}
              options={priceList.map((p) => ({
                symbol: p.symbol,
                name: p.name,
                price: p.price,
                type: p.type,
              }))}
              onQuoteLookup={handleQuoteLookup}
            />
          </div>

          {/* Quote lookup in progress */}
          {quoteFetching && lookupSymbol && (
            <div className="flex items-center gap-2 text-[11px] font-mono text-primary/70">
              <div className="w-3 h-3 border border-primary/40 border-t-transparent rounded-full animate-spin" />
              Fetching live quote for {lookupSymbol}…
            </div>
          )}

          {/* Quoted asset info */}
          {quotedAsset && quotedAsset.symbol === selectedSymbol && !knownAsset?.price && (
            <div className="flex items-center justify-between bg-primary/5 border border-primary/15 rounded-lg px-3 py-2">
              <div className="text-[11px] font-mono text-muted-foreground">
                {quotedAsset.name} · Live Quote
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-mono font-600 text-white">
                  $
                  {quotedAsset.price.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${quotedAsset.changePercent >= 0 ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10"}`}
                >
                  {quotedAsset.changePercent >= 0 ? "+" : ""}
                  {quotedAsset.changePercent.toFixed(2)}%
                </span>
              </div>
            </div>
          )}

          {/* Loading state while prices initialise */}
          {pricesLoading && selectedSymbol && !knownAsset && !quotedAsset && (
            <div className="flex items-center gap-2 text-[11px] font-mono text-muted-foreground/60">
              <div className="w-3 h-3 border border-muted-foreground/30 border-t-transparent rounded-full animate-spin" />
              Loading live prices for {selectedSymbol}…
            </div>
          )}

          {/* Custom price input */}
          {isCustomTicker && !pricesLoading && !quoteFetching && !quotedAsset && (
            <div className="space-y-1.5">
              <label className="data-label flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3 text-amber-400" />
                Current Price for {selectedSymbol}
              </label>
              <div className="flex items-center gap-2 bg-black/30 border border-amber-500/30 rounded-lg px-3 h-10">
                <span className="text-muted-foreground font-mono text-sm">$</span>
                <input
                  type="number"
                  min="0.000001"
                  step="any"
                  className="flex-1 bg-transparent outline-none text-sm font-mono text-white placeholder:text-muted-foreground"
                  placeholder="e.g. 0.15 or 42000"
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                />
              </div>
              <p className="text-[10px] text-amber-400/70 font-mono">
                {selectedSymbol} is not in the default asset list — enter a price manually or use
                the lookup above to fetch live data.
              </p>
            </div>
          )}

          {/* Known asset info bar */}
          {knownAsset && (
            <div className="flex items-center justify-between bg-primary/5 border border-primary/15 rounded-lg px-3 py-2">
              <div className="text-[11px] font-mono text-muted-foreground">{knownAsset.name}</div>
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-mono font-600 text-white">
                  $
                  {knownAsset.price.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${knownAsset.changePercent >= 0 ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10"}`}
                >
                  {knownAsset.changePercent >= 0 ? "+" : ""}
                  {knownAsset.changePercent.toFixed(2)}%
                </span>
              </div>
            </div>
          )}

          {/* Scenario tabs */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="data-label">Scenario Presets</label>
              <div className="flex rounded-lg overflow-hidden border border-white/10 ml-auto">
                <button
                  onClick={() => setActiveTab("market")}
                  className={`px-3 py-1 text-[10px] font-mono transition-colors ${activeTab === "market" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-white"}`}
                >
                  Market
                </button>
                <button
                  onClick={() => setActiveTab("geo")}
                  className={`px-3 py-1 text-[10px] font-mono transition-colors flex items-center gap-1 border-l border-white/10 ${activeTab === "geo" ? "bg-orange-500/15 text-orange-400" : "text-muted-foreground hover:text-white"}`}
                >
                  <Globe className="w-2.5 h-2.5" />
                  Geopolitics
                </button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {allPresets.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => applyPreset(preset)}
                  className={`flex flex-col items-center justify-center gap-0.5 px-2 py-2 rounded-lg border text-[10px] font-semibold tracking-wide transition-all duration-150 ${preset.color} ${activePreset === preset.label ? "ring-1 ring-current/50 scale-[0.97]" : ""}`}
                  title={preset.description}
                >
                  <span className="text-base leading-none">{preset.emoji}</span>
                  <span className="text-center leading-tight">{preset.label}</span>
                </button>
              ))}
            </div>
            {activePreset && (
              <p className="text-[10px] font-mono text-muted-foreground/60 text-center">
                {allPresets.find((p) => p.label === activePreset)?.description}
              </p>
            )}
          </div>

          {/* Volatility */}
          <div className="space-y-2.5">
            <div className="flex justify-between items-center">
              <label className="data-label">Volatility (Annual)</label>
              <span
                className={`text-[12px] font-mono ${volatility >= 60 ? "text-red-400" : volatility >= 35 ? "text-amber-400" : "text-white"}`}
              >
                {volatility}%
              </span>
            </div>
            <Slider
              value={[volatility]}
              onValueChange={(v) => {
                setVolatility(v[0]);
                setActivePreset(null);
              }}
              max={100}
              min={1}
              step={1}
            />
            <div className="flex justify-between text-[9px] font-mono text-muted-foreground/50">
              <span>Low risk</span>
              <span>Extreme</span>
            </div>
          </div>

          {/* Event Impact */}
          <div className="space-y-2.5">
            <div className="flex justify-between items-center">
              <label className="data-label">Event Impact (Day 1 Shock)</label>
              <span
                className={`text-[12px] font-mono ${eventImpact > 0 ? "text-emerald-400" : eventImpact < 0 ? "text-red-400" : "text-muted-foreground"}`}
              >
                {eventImpact > 0 ? "+" : ""}
                {eventImpact}%
              </span>
            </div>
            <Slider
              value={[eventImpact]}
              onValueChange={(v) => {
                setEventImpact(v[0]);
                setActivePreset(null);
              }}
              max={50}
              min={-50}
              step={1}
            />
            <div className="flex justify-between text-[9px] font-mono text-muted-foreground/50">
              <span>Crash −50%</span>
              <span>Rally +50%</span>
            </div>
          </div>

          {/* Time Horizon */}
          <div className="space-y-2.5">
            <div className="flex justify-between items-center">
              <label className="data-label">Time Horizon</label>
              <span className="text-[12px] font-mono text-white">{timeHorizon}d</span>
            </div>
            <Slider
              value={[timeHorizon]}
              onValueChange={(v) => {
                setTimeHorizon(v[0]);
                setActivePreset(null);
              }}
              max={365}
              min={1}
              step={1}
            />
          </div>

          {/* Simulation paths */}
          <div className="space-y-1.5">
            <label className="data-label">Simulation Paths</label>
            <div className="grid grid-cols-3 gap-2">
              {[500, 1000, 2000].map((n) => (
                <button
                  key={n}
                  onClick={() => setSimulations(n)}
                  className={`py-2 rounded-lg border text-[11px] font-mono font-semibold transition-all ${simulations === n ? "border-primary/50 bg-primary/10 text-primary" : "border-white/10 bg-black/20 text-muted-foreground hover:border-white/20 hover:text-white"}`}
                >
                  {n.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          <Button
            className="w-full gap-2 h-10 font-mono"
            onClick={handleRun}
            disabled={!canRun || runMonteCarlo.isPending}
          >
            {runMonteCarlo.isPending ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Running {simulations.toLocaleString()} paths…
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                Run Simulation
              </>
            )}
          </Button>

          {!canRun && selectedSymbol && isCustomTicker && !effectivePrice && (
            <p className="text-[10px] text-center text-amber-400/70 font-mono -mt-2">
              Enter a price above to run simulation
            </p>
          )}
        </CardContent>
      </Card>

      {/* Empty state */}
      {!result && !runMonteCarlo.isPending && (
        <div className="text-center py-12 border border-dashed border-white/10 rounded-xl">
          <BarChart2 className="w-7 h-7 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-[12px] text-muted-foreground">
            Select an asset and configure a scenario to begin.
          </p>
          <p className="text-[11px] text-muted-foreground/50 mt-1">
            Supports stocks, crypto, and any custom ticker — live Polymarket geo context included.
          </p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Header strip */}
          <div className="flex items-center justify-between">
            <div>
              <span className="font-display text-[14px] font-700 text-white">{result.symbol}</span>
              <span className="ml-2 text-[10px] font-mono text-muted-foreground">
                {result.simulations.toLocaleString()} paths · {timeHorizon}d horizon
              </span>
            </div>
            <div
              className={`text-[12px] font-mono font-600 px-2 py-1 rounded-lg border ${result.expectedReturn >= 0 ? "text-emerald-400 border-emerald-500/25 bg-emerald-500/8" : "text-red-400 border-red-500/25 bg-red-500/8"}`}
            >
              {result.expectedReturn >= 0 ? "+" : ""}
              {(result.expectedReturn * 100).toFixed(2)}% E[R]
            </div>
          </div>

          {/* Key stats grid */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="bg-card/60 border-white/[0.07] backdrop-blur-sm">
              <CardContent className="p-4">
                <div className="data-label mb-2">Median Forecast</div>
                <div className="stat-number text-white">
                  $
                  {result.median.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/60 border-white/[0.07] backdrop-blur-sm">
              <CardContent className="p-4">
                <div className="data-label mb-2">Bull / Bear</div>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-[20px] font-mono font-600 text-emerald-400">
                    {(result.bullishProbability * 100).toFixed(0)}%
                  </span>
                  <span className="text-muted-foreground font-mono text-sm">/</span>
                  <span className="text-[20px] font-mono font-600 text-red-400">
                    {(result.bearishProbability * 100).toFixed(0)}%
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/60 border-white/[0.07] backdrop-blur-sm">
              <CardContent className="p-4">
                <div className="data-label mb-2">1-Day 95% VaR</div>
                <div className="stat-number text-amber-400">
                  −$
                  {result.var95.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
                <div className="text-[9px] font-mono text-muted-foreground mt-1">per unit held</div>
              </CardContent>
            </Card>

            <Card className="bg-card/60 border-white/[0.07] backdrop-blur-sm">
              <CardContent className="p-4">
                <div className="data-label mb-2">Max Drawdown</div>
                <div className="stat-number text-red-400">
                  −{(result.maxDrawdown * 100).toFixed(1)}%
                </div>
                <div className="text-[9px] font-mono text-muted-foreground mt-1">
                  worst simulated path
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/60 border-white/[0.07] backdrop-blur-sm col-span-2">
              <CardContent className="p-4">
                <div className="data-label mb-3">P10 — P90 Range</div>
                <div className="flex items-center gap-3">
                  <span className="text-[16px] font-mono font-600 text-red-400/80">
                    ${result.p10.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                  <div className="flex-1 relative h-1.5 bg-gradient-to-r from-red-500/30 via-primary/40 to-emerald-500/30 rounded-full">
                    {effectivePrice > 0 && result.p90 > result.p10 && (
                      <div
                        className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.8)]"
                        style={{
                          left: `${Math.max(2, Math.min(96, ((effectivePrice - result.p10) / (result.p90 - result.p10)) * 92 + 2))}%`,
                        }}
                      />
                    )}
                  </div>
                  <span className="text-[16px] font-mono font-600 text-emerald-400/80">
                    ${result.p90.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
                {effectivePrice > 0 && (
                  <div className="text-[9px] font-mono text-amber-400 text-center mt-1.5">
                    ● Entry: $
                    {effectivePrice.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Fan Chart */}
          <Card className="bg-card/60 border-white/[0.07] backdrop-blur-sm">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-[12px] font-display font-700 text-white tracking-tight">
                Price Path Forecast
              </CardTitle>
            </CardHeader>
            <CardContent className="px-2 pb-4">
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                    <XAxis
                      dataKey="day"
                      stroke="#ffffff30"
                      fontSize={9}
                      fontFamily="JetBrains Mono"
                      tickFormatter={(v) => `D${v}`}
                      type="number"
                      domain={[0, "dataMax"]}
                    />
                    <YAxis
                      domain={["auto", "auto"]}
                      stroke="#ffffff30"
                      fontSize={9}
                      fontFamily="JetBrains Mono"
                      tickFormatter={(v) => `$${Number(v).toLocaleString()}`}
                      width={58}
                    />
                    {result.paths.slice(0, 40).map((path, i) => (
                      <Line
                        key={i}
                        data={path.map((val, day) => ({ day, val }))}
                        type="monotone"
                        dataKey="val"
                        stroke={i < 5 ? "#00d4ff" : "#ffffff"}
                        strokeWidth={i < 5 ? 1.5 : 1}
                        strokeOpacity={i < 5 ? 0.25 : 0.08}
                        dot={false}
                        isAnimationActive={false}
                      />
                    ))}
                    {effectivePrice > 0 && (
                      <ReferenceLine
                        y={effectivePrice}
                        stroke="rgba(251,191,36,0.4)"
                        strokeDasharray="4 4"
                        label={{
                          value: "Entry",
                          position: "insideRight",
                          fontSize: 9,
                          fill: "#fbbf24",
                          fontFamily: "JetBrains Mono",
                        }}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Percentile distribution */}
          <Card className="bg-card/60 border-white/[0.07] backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="data-label mb-3">Percentile Distribution</div>
              <div className="grid grid-cols-5 gap-1 text-center mb-3">
                {[
                  { label: "P10", value: result.p10, color: "text-red-400" },
                  { label: "P25", value: result.p25, color: "text-orange-400/70" },
                  { label: "Med", value: result.median, color: "text-primary" },
                  { label: "P75", value: result.p75, color: "text-emerald-400/70" },
                  { label: "P90", value: result.p90, color: "text-emerald-400" },
                ].map((p) => (
                  <div key={p.label}>
                    <div
                      className={`text-[9px] font-mono font-semibold tracking-widest ${p.color} mb-1`}
                    >
                      {p.label}
                    </div>
                    <div className="text-[10px] font-mono text-white">
                      ${Number(p.value).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="w-full h-5 bg-black/40 rounded-full overflow-hidden flex relative">
                <div className="h-full bg-red-500/25" style={{ width: "10%" }} />
                <div
                  className="h-full bg-red-500/10 border-l border-white/5"
                  style={{ width: "15%" }}
                />
                <div
                  className="h-full bg-primary/20 border-l border-white/10"
                  style={{ width: "25%" }}
                />
                <div
                  className="h-full bg-primary/20 border-l border-white/30"
                  style={{ width: "25%" }}
                />
                <div
                  className="h-full bg-emerald-500/10 border-l border-white/10"
                  style={{ width: "15%" }}
                />
                <div
                  className="h-full bg-emerald-500/25 border-l border-white/5"
                  style={{ width: "10%" }}
                />
                {effectivePrice > 0 && result.p90 > result.p10 && (
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-10"
                    style={{
                      left: `${Math.max(2, Math.min(98, ((effectivePrice - result.p10) / (result.p90 - result.p10)) * 80 + 10))}%`,
                      boxShadow: "0 0 6px rgba(251,191,36,0.8)",
                    }}
                  />
                )}
              </div>
              {effectivePrice > 0 && (
                <div className="text-[9px] font-mono text-amber-400 text-center mt-1.5">
                  ▲ Entry: $
                  {effectivePrice.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Geo Intel from simulation */}
          {result.geopoliticsContext && result.geopoliticsContext.length > 0 && (
            <GeoIntelPanel signals={result.geopoliticsContext} />
          )}
        </div>
      )}
    </div>
  );
}
