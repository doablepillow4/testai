import React, { useState } from "react";
import { useGetMarketPrices } from "@workspace/api-client-react";
import type { MarketPrice } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus, RefreshCw, WifiOff } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, Tooltip } from "recharts";

function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  if (!data || data.length < 2) return null;
  const chartData = data.map((v, i) => ({ i, v }));
  return (
    <div className="w-16 h-8">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <Line
            type="monotone"
            dataKey="v"
            stroke={positive ? "#34d399" : "#f87171"}
            strokeWidth={1.5}
            dot={false}
          />
          <Tooltip content={() => null} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function AssetRow({ asset, onSelect }: { asset: MarketPrice; onSelect: () => void }) {
  const isUp = asset.changePercent > 0;
  const isDown = asset.changePercent < 0;

  return (
    <button
      onClick={onSelect}
      className="w-full flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-white/[0.04] transition-colors text-left group"
    >
      <div className="w-8 h-8 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center shrink-0">
        <span className="text-[10px] font-mono font-700 text-white">
          {asset.symbol.slice(0, 2)}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-mono font-600 text-white">{asset.symbol}</span>
          <span className="text-[13px] font-mono font-600 text-white">
            ${asset.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: asset.price >= 100 ? 2 : 4 })}
          </span>
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-[10px] text-muted-foreground truncate pr-2">{asset.name}</span>
          <div
            className={`flex items-center gap-0.5 text-[10px] font-mono ${isUp ? "text-emerald-400" : isDown ? "text-red-400" : "text-amber-400"}`}
          >
            {isUp ? <TrendingUp className="w-3 h-3" /> : isDown ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
            {isUp ? "+" : ""}{asset.changePercent.toFixed(2)}%
          </div>
        </div>
      </div>

      <Sparkline data={asset.sparkline} positive={!isDown} />
    </button>
  );
}

export function MarketOverview() {
  const { data: prices, isLoading, error, refetch, isFetching } = useGetMarketPrices();
  const [filter, setFilter] = useState<"all" | "crypto" | "stock">("all");

  const priceList = Array.isArray(prices) ? prices : [];
  const filtered =
    filter === "all" ? priceList : priceList.filter((p) => p.type === filter);

  const cryptoCount = priceList.filter((p) => p.type === "crypto").length;
  const stockCount = priceList.filter((p) => p.type === "stock").length;

  return (
    <Card className="bg-card/60 border-white/[0.07] backdrop-blur-sm overflow-hidden">
      <div className="h-0.5 w-full bg-gradient-to-r from-primary/60 via-primary/20 to-transparent" />
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex gap-1">
            {(["all", "crypto", "stock"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-mono uppercase tracking-wide transition-colors ${
                  filter === tab
                    ? "bg-primary/15 text-primary border border-primary/25"
                    : "text-muted-foreground hover:text-white border border-transparent"
                }`}
              >
                {tab === "all" ? `All (${priceList.length})` : tab === "crypto" ? `Crypto (${cryptoCount})` : `Stocks (${stockCount})`}
              </button>
            ))}
          </div>
          <button
            onClick={() => refetch()}
            className="text-muted-foreground hover:text-white transition-colors p-1"
            disabled={isFetching}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
          </button>
        </div>

        {error && !isLoading && priceList.length === 0 ? (
          <div className="py-6 flex flex-col items-center gap-3">
            <WifiOff className="w-8 h-8 text-muted-foreground/40" />
            <p className="text-[11px] text-muted-foreground font-mono text-center">
              Market data temporarily unavailable
            </p>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-[11px] font-mono text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
            >
              {isFetching ? "Retrying..." : "Retry"}
            </button>
          </div>
        ) : isLoading ? (
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-12 rounded-xl bg-white/[0.03] animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-8 text-center text-[12px] text-muted-foreground font-mono">
            No assets found
          </div>
        ) : (
          <div className="space-y-0.5">
            {filtered.map((asset) => (
              <AssetRow
                key={asset.symbol}
                asset={asset}
                onSelect={() => {}}
              />
            ))}
          </div>
        )}

        {priceList.length > 0 && (
          <p className="text-[9px] font-mono text-muted-foreground/40 mt-3 text-center">
            Prices auto-refresh every 5 min · Last updated {new Date(priceList[0]?.updatedAt ?? Date.now()).toLocaleTimeString()}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
