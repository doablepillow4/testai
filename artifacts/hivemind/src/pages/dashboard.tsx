import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetMarketPrices,
  useGetPredictions,
  useGetPredictionsSummary,
  useCreatePrediction,
  getGetMarketPricesQueryKey,
  getGetPredictionsQueryKey,
  getGetPredictionsSummaryQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Activity, Target, TrendingUp, TrendingDown, Zap, ChevronRight } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";

export default function Dashboard() {
  const { data: prices, isLoading: loadingPrices } = useGetMarketPrices({
    query: { refetchInterval: 30000, queryKey: getGetMarketPricesQueryKey() },
  });
  const { data: predictions, isLoading: loadingPredictions } = useGetPredictions({
    query: { refetchInterval: 30000, queryKey: getGetPredictionsQueryKey() },
  });
  const { data: summary } = useGetPredictionsSummary({
    query: { refetchInterval: 30000, queryKey: getGetPredictionsSummaryQueryKey() },
  });

  const queryClient = useQueryClient();
  const createPrediction = useCreatePrediction({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetPredictionsQueryKey() });
      },
    },
  });

  const [selectedSymbol, setSelectedSymbol] = useState<string>("");
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>("1w");
  const priceList = Array.isArray(prices) ? prices : [];
  const predictionList = Array.isArray(predictions) ? predictions : [];

  const handleGenerate = () => {
    if (!selectedSymbol) return;
    createPrediction.mutate({ data: { symbol: selectedSymbol, timeframe: selectedTimeframe } });
  };

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-[22px] font-700 text-white tracking-tight leading-none">
            Market Intelligence
          </h1>
          <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1.5 font-mono">
            <Activity className="w-3 h-3 text-primary" />
            Live data feed · 30s refresh
          </p>
        </div>
        <div className="text-[10px] font-mono text-muted-foreground/50 text-right leading-relaxed">
          {new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}<br />
          {new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-card/60 border-white/[0.07] card-hover backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="data-label mb-2">Model Accuracy</div>
            <div className="stat-number text-white mb-1">
              {summary ? `${(summary.accuracy * 100).toFixed(1)}%` : <span className="text-white/20">——</span>}
            </div>
            <div className="text-[10px] font-mono text-primary/80">
              {summary?.totalPredictions || 0} predictions
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/60 border-white/[0.07] card-hover backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="data-label mb-2">Avg Confidence</div>
            <div className="stat-number text-white mb-2">
              {summary ? `${(summary.averageConfidence * 100).toFixed(1)}%` : <span className="text-white/20">——</span>}
            </div>
            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-700"
                style={{ width: `${summary ? summary.averageConfidence * 100 : 0}%`, boxShadow: "0 0 8px rgba(0,212,255,0.6)" }}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/60 border-white/[0.07] card-hover backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="data-label mb-2">30-Day Accuracy</div>
            <div className="stat-number text-white mb-1">
              {summary ? `${(summary.recentAccuracy * 100).toFixed(1)}%` : <span className="text-white/20">——</span>}
            </div>
            {summary && (
              <div className={`text-[10px] font-mono flex items-center gap-0.5 ${summary.improvementTrend > 0 ? "text-emerald-400" : "text-red-400"}`}>
                {summary.improvementTrend > 0
                  ? <TrendingUp className="w-3 h-3" />
                  : <TrendingDown className="w-3 h-3" />}
                {Math.abs(summary.improvementTrend * 100).toFixed(1)}% vs prior
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/60 border-white/[0.07] card-hover backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="data-label mb-2">Resolved</div>
            <div className="stat-number text-white mb-1">
              {summary ? `${summary.correctPredictions}/${summary.totalPredictions}` : <span className="text-white/20">——</span>}
            </div>
            <div className="text-[10px] font-mono text-muted-foreground">Correct / Total</div>
          </CardContent>
        </Card>
      </div>

      {/* Generate Prediction */}
      <div className="relative rounded-xl border border-primary/20 bg-primary/5 p-4 overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative space-y-3">
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-primary" />
            <span className="text-[11px] font-semibold text-white tracking-wide">Generate Prediction</span>
          </div>
          <div className="flex gap-2">
            <Select value={selectedSymbol} onValueChange={setSelectedSymbol}>
              <SelectTrigger className="flex-1 bg-black/30 border-white/10 text-sm h-9 font-mono">
                <SelectValue placeholder="Symbol" />
              </SelectTrigger>
              <SelectContent>
                {priceList.map((p) => (
                  <SelectItem key={p.symbol} value={p.symbol} className="font-mono">{p.symbol}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedTimeframe} onValueChange={setSelectedTimeframe}>
              <SelectTrigger className="w-28 bg-black/30 border-white/10 text-sm h-9 font-mono">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1d" className="font-mono">1D</SelectItem>
                <SelectItem value="1w" className="font-mono">1W</SelectItem>
                <SelectItem value="1m" className="font-mono">1M</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={handleGenerate}
            disabled={!selectedSymbol || createPrediction.isPending}
            className="w-full gap-2 h-9 font-mono text-sm"
          >
            <Target className="w-4 h-4" />
            {createPrediction.isPending ? "Analyzing..." : "Run Prediction"}
          </Button>
        </div>
      </div>

      {/* Live Markets */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-[13px] font-700 text-white tracking-tight">Live Markets</h2>
          <div className="text-[10px] font-mono text-muted-foreground">{priceList.length} assets</div>
        </div>

        {loadingPrices ? (
          <div className="grid grid-cols-2 gap-3">
            {[1,2,3,4].map(i => (
              <div key={i} className="h-28 rounded-xl bg-card/40 border border-white/[0.05] animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {priceList.map((price) => (
              <Card key={price.symbol} className="overflow-hidden bg-card/60 border-white/[0.07] card-hover backdrop-blur-sm cursor-pointer">
                <CardContent className="p-3.5">
                  <div className="flex justify-between items-start mb-1.5">
                    <div>
                      <div className="font-display font-700 text-[13px] text-white leading-tight">{price.symbol}</div>
                      <div className="text-[9px] font-mono text-muted-foreground/70 truncate max-w-[72px] mt-0.5">{price.name}</div>
                    </div>
                    <div className={`text-[10px] font-mono font-medium flex items-center gap-0.5 px-1.5 py-0.5 rounded ${
                      price.changePercent >= 0
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-red-500/10 text-red-400"
                    }`}>
                      {price.changePercent >= 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                      {Math.abs(price.changePercent).toFixed(2)}%
                    </div>
                  </div>

                  <div className="text-[13px] font-mono font-600 text-white mb-2">
                    ${price.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>

                  <div className="h-9 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={price.sparkline.map((val, i) => ({ val, i }))}>
                        <YAxis domain={["auto", "auto"]} hide />
                        <Line
                          type="monotone"
                          dataKey="val"
                          stroke={price.changePercent >= 0 ? "#34d399" : "#f87171"}
                          strokeWidth={1.5}
                          dot={false}
                          isAnimationActive={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Predictions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-[13px] font-700 text-white tracking-tight">Latest Intelligence</h2>
          <div className="text-[10px] font-mono text-muted-foreground">{predictionList.length} signals</div>
        </div>

        {loadingPredictions ? (
          <div className="space-y-3">
            {[1,2].map(i => (
              <div key={i} className="h-32 rounded-xl bg-card/40 border border-white/[0.05] animate-pulse" />
            ))}
          </div>
        ) : predictionList.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-white/10 rounded-xl">
            <Target className="w-6 h-6 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-[12px] text-muted-foreground">No predictions yet. Generate one above.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {predictionList.map((pred) => (
              <div key={pred.id} className="relative overflow-hidden rounded-xl border border-white/[0.07] bg-card/60 backdrop-blur-sm card-hover">
                <div
                  className={`absolute top-0 left-0 w-1 h-full ${
                    pred.direction === "bullish"
                      ? "bg-emerald-500"
                      : pred.direction === "bearish"
                      ? "bg-red-500"
                      : "bg-amber-500"
                  }`}
                />
                <div className="p-4 pl-5">
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-display font-700 text-[14px] text-white">{pred.symbol}</span>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground uppercase tracking-widest">
                        {pred.timeframe}
                      </span>
                    </div>
                    <div className={`text-[9px] font-mono px-2 py-1 rounded-full font-semibold tracking-widest uppercase ${
                      pred.direction === "bullish"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : pred.direction === "bearish"
                        ? "bg-red-500/10 text-red-400 border border-red-500/20"
                        : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                    }`}>
                      {pred.direction}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <div className="data-label mb-1">Target Price</div>
                      <div className="text-[13px] font-mono font-600 text-white">
                        ${pred.targetPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="data-label">Confidence</span>
                        <span className="text-[10px] font-mono text-primary">{(pred.confidence * 100).toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${pred.confidence * 100}%`, boxShadow: "0 0 6px rgba(0,212,255,0.5)" }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="bg-black/20 rounded-lg p-2.5 border border-white/[0.04]">
                    <div className="data-label mb-2">Key Signals</div>
                    <div className="space-y-1.5">
                      {pred.signals.slice(0, 3).map((sig, i) => (
                        <div key={i} className="flex justify-between items-center">
                          <span className="text-[11px] text-white/60">{sig.name}</span>
                          <span className={`text-[11px] font-mono ${sig.bullish ? "text-emerald-400" : "text-red-400"}`}>
                            {sig.value.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
