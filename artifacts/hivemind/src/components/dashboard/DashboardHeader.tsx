import React, { useState, useEffect } from "react";
import { useGetMarketPrices, useGetPredictionsSummary } from "@workspace/api-client-react";
import { Brain, TrendingUp, TrendingDown, Minus, Activity } from "lucide-react";

export function DashboardHeader() {
  const { data: prices } = useGetMarketPrices({
    live: true,
  }, {
    query: { refetchOnMount: "always", staleTime: 0 },
  });
  const { data: summary } = useGetPredictionsSummary();

  const priceList = Array.isArray(prices) ? prices : [];
  const bullishCount = priceList.filter((p) => p.changePercent > 0).length;
  const bearishCount = priceList.filter((p) => p.changePercent < 0).length;
  const marketMood =
    bullishCount > bearishCount ? "bullish" : bearishCount > bullishCount ? "bearish" : "neutral";

  // FIX: Use state so the clock actually ticks; computing `new Date()` inline
  // only runs once at mount and then goes stale until the next re-render.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="mb-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="font-display text-[22px] font-700 text-white tracking-tight leading-none flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            Markets
          </h1>
          <p className="text-[11px] text-muted-foreground mt-1.5 font-mono">
            {dateStr} · {timeStr}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {marketMood === "bullish" && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <TrendingUp className="w-3 h-3 text-emerald-400" />
              <span className="text-[10px] font-mono text-emerald-400 uppercase tracking-wider">
                Risk On
              </span>
            </div>
          )}
          {marketMood === "bearish" && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20">
              <TrendingDown className="w-3 h-3 text-red-400" />
              <span className="text-[10px] font-mono text-red-400 uppercase tracking-wider">
                Risk Off
              </span>
            </div>
          )}
          {marketMood === "neutral" && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
              <Minus className="w-3 h-3 text-amber-400" />
              <span className="text-[10px] font-mono text-amber-400 uppercase tracking-wider">
                Mixed
              </span>
            </div>
          )}
        </div>
      </div>

      {priceList.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
            <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest mb-1">
              Tracked Assets
            </div>
            <div className="text-[20px] font-mono font-700 text-white leading-none">
              {priceList.length}
            </div>
          </div>
          <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/15 p-3">
            <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest mb-1">
              Gaining
            </div>
            <div className="text-[20px] font-mono font-700 text-emerald-400 leading-none">
              {bullishCount}
            </div>
          </div>
          <div className="rounded-xl bg-red-500/5 border border-red-500/15 p-3">
            <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest mb-1">
              Falling
            </div>
            <div className="text-[20px] font-mono font-700 text-red-400 leading-none">
              {bearishCount}
            </div>
          </div>
        </div>
      )}

      {summary && (
        <div className="mt-2 rounded-xl bg-primary/5 border border-primary/15 px-3 py-2 flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="text-[11px] font-mono text-muted-foreground">
            Lattice accuracy:{" "}
            <span className="text-white font-600">
              {(summary.accuracy * 100).toFixed(1)}%
            </span>{" "}
            across{" "}
            <span className="text-white font-600">{summary.totalPredictions}</span> predictions
          </span>
        </div>
      )}
    </div>
  );
}
