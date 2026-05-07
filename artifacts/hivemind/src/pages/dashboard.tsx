import { useState } from "react";
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
import type { MarketPrice, PredictionsSummary } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Activity,
  Target,
  TrendingUp,
  TrendingDown,
  Zap,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
} from "lucide-react";
import { ResponsiveContainer, LineChart, Line, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TickerCombobox } from "@/components/ticker-combobox";
import { useAppStore } from "@/store/app-store";

function makeSparkline(base: number, len = 15): number[] {
  const pts: number[] = [base];
  for (let i = 1; i < len; i++) pts.push(pts[i - 1] * (1 + (Math.random() - 0.5) * 0.012));
  return pts;
}

const PLACEHOLDER_PRICES: MarketPrice[] = [
  { symbol: "BTC", name: "Bitcoin", price: 97500, change: 1220, changePercent: 1.27, volume: 28_400_000_000, marketCap: 1_920_000_000_000, type: "crypto", sparkline: makeSparkline(97500), updatedAt: new Date().toISOString() },
  { symbol: "ETH", name: "Ethereum", price: 1875, change: -18, changePercent: -0.95, volume: 13_200_000_000, marketCap: 225_000_000_000, type: "crypto", sparkline: makeSparkline(1875), updatedAt: new Date().toISOString() },
  { symbol: "SOL", name: "Solana", price: 148, change: 3.2, changePercent: 2.21, volume: 4_100_000_000, marketCap: 68_000_000_000, type: "crypto", sparkline: makeSparkline(148), updatedAt: new Date().toISOString() },
  { symbol: "BNB", name: "BNB", price: 598, change: -4.5, changePercent: -0.75, volume: 1_800_000_000, marketCap: 86_000_000_000, type: "crypto", sparkline: makeSparkline(598), updatedAt: new Date().toISOString() },
  { symbol: "DOGE", name: "Dogecoin", price: 0.178, change: 0.004, changePercent: 2.3, volume: 1_200_000_000, marketCap: 26_000_000_000, type: "crypto", sparkline: makeSparkline(0.178), updatedAt: new Date().toISOString() },
  { symbol: "AVAX", name: "Avalanche", price: 22.5, change: -0.6, changePercent: -2.6, volume: 420_000_000, marketCap: 9_400_000_000, type: "crypto", sparkline: makeSparkline(22.5), updatedAt: new Date().toISOString() },
  { symbol: "AAPL", name: "Apple Inc", price: 213.4, change: 1.8, changePercent: 0.85, volume: 54_000_000, marketCap: 3_280_000_000_000, type: "stock", sparkline: makeSparkline(213.4), updatedAt: new Date().toISOString() },
  { symbol: "MSFT", name: "Microsoft", price: 418.2, change: -2.4, changePercent: -0.57, volume: 22_000_000, marketCap: 3_100_000_000_000, type: "stock", sparkline: makeSparkline(418.2), updatedAt: new Date().toISOString() },
  { symbol: "NVDA", name: "NVIDIA", price: 876.3, change: 18.4, changePercent: 2.14, volume: 48_000_000, marketCap: 2_160_000_000_000, type: "stock", sparkline: makeSparkline(876.3), updatedAt: new Date().toISOString() },
  { symbol: "TSLA", name: "Tesla", price: 174.6, change: -3.9, changePercent: -2.18, volume: 87_000_000, marketCap: 556_000_000_000, type: "stock", sparkline: makeSparkline(174.6), updatedAt: new Date().toISOString() },
  { symbol: "AMZN", name: "Amazon", price: 196.8, change: 0.9, changePercent: 0.46, volume: 31_000_000, marketCap: 2_070_000_000_000, type: "stock", sparkline: makeSparkline(196.8), updatedAt: new Date().toISOString() },
  { symbol: "GOOGL", name: "Alphabet", price: 168.5, change: 1.2, changePercent: 0.72, volume: 19_000_000, marketCap: 2_080_000_000_000, type: "stock", sparkline: makeSparkline(168.5), updatedAt: new Date().toISOString() },
];

const PLACEHOLDER_SUMMARY: PredictionsSummary = {
  totalPredictions: 0,
  correctPredictions: 0,
  accuracy: 0,
  averageConfidence: 0,
  recentAccuracy: 0,
  improvementTrend: 0,
  bySymbol: [],
};

export default function Dashboard() {
  const {
    data: prices,
    isLoading: loadingPrices,
    error: pricesError,
  } = useGetMarketPrices({
    query: {
      refetchInterval: 30000,
      queryKey: getGetMarketPricesQueryKey(),
      placeholderData: PLACEHOLDER_PRICES,
    },
  });
  const {
    data: predictions,
    isLoading: loadingPredictions,
    error: predictionsError,
  } = useGetPredictions({
    query: {
      refetchInterval: 30000,
      queryKey: getGetPredictionsQueryKey(),
      placeholderData: [],
    },
  });
  const { data: summary, error: summaryError } = useGetPredictionsSummary({
    query: {
      refetchInterval: 30000,
      queryKey: getGetPredictionsSummaryQueryKey(),
      placeholderData: PLACEHOLDER_SUMMARY,
    },
  });

  const queryClient = useQueryClient();
  const createPrediction = useCreatePrediction({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetPredictionsQueryKey() });
      },
    },
  });

  const { selectedAsset, setSelectedAsset, setLastPredictionSymbol } = useAppStore();

  const [selectedSymbol, setSelectedSymbol] = useState<string>(selectedAsset?.symbol ?? "");
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>("1d");

  const priceList = Array.isArray(prices) && prices.length > 0 ? prices : PLACEHOLDER_PRICES;
  const predictionList = Array.isArray(predictions) ? predictions : [];
  const hasApiErrors = Boolean(pricesError || predictionsError || summaryError);

  function handleSymbolChange(symbol: string, price?: number) {
    setSelectedSymbol(symbol);
    if (symbol) {
      const asset = priceList.find((p) => p.symbol === symbol);
      setSelectedAsset({ symbol, name: asset?.name, price: price ?? asset?.price });
    } else {
      setSelectedAsset(null);
    }
  }

  function handleGenerate() {
    if (!selectedSymbol) return;
    setLastPredictionSymbol(selectedSymbol);
    createPrediction.mutate({ data: { symbol: selectedSymbol, timeframe: selectedTimeframe } });
  }

  function handleCardClick(symbol: string, price: number, name: string) {
    setSelectedSymbol(symbol);
    setSelectedAsset({ symbol, name, price });
  }

  const latestPrediction = createPrediction.data;

  return (
    <div className="space-y-6 animate-fade-up">
      {/* API Error Alert */}
      {hasApiErrors && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="text-sm font-semibold text-red-300 mb-1">Backend Connection Issue</div>
            <div className="text-xs text-red-200/80">
              The API server is currently unavailable. Displaying cached data when available. Ensure
              the backend is configured with a PostgreSQL database.
            </div>
          </div>
        </div>
      )}

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
          {new Date().toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
          })}
          <br />
          {new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-card/60 border-white/[0.07] card-hover backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="data-label mb-2">Model Accuracy</div>
            <div className="stat-number text-white mb-1">
              {summary && summary.totalPredictions > 0 ? (
                `${(summary.accuracy * 100).toFixed(1)}%`
              ) : (
                <span className="text-white/20">——</span>
              )}
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
              {summary && summary.totalPredictions > 0 ? (
                `${(summary.averageConfidence * 100).toFixed(1)}%`
              ) : (
                <span className="text-white/20">——</span>
              )}
            </div>
            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-700"
                style={{
                  width: `${summary && summary.totalPredictions > 0 ? summary.averageConfidence * 100 : 0}%`,
                  boxShadow: "0 0 8px rgba(0,212,255,0.6)",
                }}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/60 border-white/[0.07] card-hover backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="data-label mb-2">30-Day Accuracy</div>
            <div className="stat-number text-white mb-1">
              {summary && summary.totalPredictions > 0 ? (
                `${(summary.recentAccuracy * 100).toFixed(1)}%`
              ) : (
                <span className="text-white/20">——</span>
              )}
            </div>
            {summary && summary.totalPredictions > 0 && (
              <div
                className={`text-[10px] font-mono flex items-center gap-0.5 ${summary.improvementTrend > 0 ? "text-emerald-400" : "text-red-400"}`}
              >
                {summary.improvementTrend > 0 ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {Math.abs(summary.improvementTrend * 100).toFixed(1)}% vs prior
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-card/60 border-white/[0.07] card-hover backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="data-label mb-2">Resolved</div>
            <div className="stat-number text-white mb-1">
              {summary && summary.totalPredictions > 0 ? (
                `${summary.correctPredictions}/${summary.totalPredictions}`
              ) : (
                <span className="text-white/20">——</span>
              )}
            </div>
            <div className="text-[10px] font-mono text-muted-foreground">Correct / Total</div>
          </CardContent>
        </Card>
      </div>

      {/* Generate Prediction with Autocomplete */}
      <div className="relative rounded-xl border border-primary/20 bg-primary/5 p-4 overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative space-y-3">
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-primary" />
            <span className="text-[11px] font-semibold text-white tracking-wide">
              Generate Prediction
            </span>
          </div>

          {/* Autocomplete search */}
          <TickerCombobox
            value={selectedSymbol}
            onChange={handleSymbolChange}
            options={priceList.map((p) => ({
              symbol: p.symbol,
              name: p.name,
              price: p.price,
              type: p.type,
            }))}
            placeholder="Search ticker or company name…"
          />

          {/* Selected asset preview */}
          {selectedSymbol &&
            (() => {
              const asset = priceList.find((p) => p.symbol === selectedSymbol);
              if (!asset) return null;
              return (
                <div className="flex items-center justify-between bg-black/20 border border-white/[0.06] rounded-lg px-3 py-2">
                  <div>
                    <span className="text-[11px] font-mono font-600 text-white">
                      {asset.symbol}
                    </span>
                    <span className="text-[10px] text-muted-foreground ml-2">{asset.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-mono text-white">
                      $
                      {asset.price.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${asset.changePercent >= 0 ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10"}`}
                    >
                      {asset.changePercent >= 0 ? "+" : ""}
                      {asset.changePercent.toFixed(2)}%
                    </span>
                  </div>
                </div>
              );
            })()}

          <div className="flex gap-2">
            <Select value={selectedTimeframe} onValueChange={setSelectedTimeframe}>
              <SelectTrigger className="w-full bg-black/30 border-white/10 text-sm h-9 font-mono">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15m" className="font-mono">
                  15 Min
                </SelectItem>
                <SelectItem value="30m" className="font-mono">
                  30 Min
                </SelectItem>
                <SelectItem value="1h" className="font-mono">
                  1 Hour
                </SelectItem>
                <SelectItem value="6h" className="font-mono">
                  6 Hours
                </SelectItem>
                <SelectItem value="12h" className="font-mono">
                  12 Hours
                </SelectItem>
                <SelectItem value="1d" className="font-mono">
                  1 Day
                </SelectItem>
                <SelectItem value="7d" className="font-mono">
                  1 Week
                </SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={handleGenerate}
              disabled={!selectedSymbol || createPrediction.isPending}
              className="flex-1 gap-2 h-9 font-mono text-sm whitespace-nowrap"
            >
              <Target className="w-4 h-4" />
              {createPrediction.isPending ? "Analyzing…" : "Run Prediction"}
            </Button>
          </div>

          {/* Inline result of just-generated prediction */}
          {latestPrediction && (
            <div
              className={`mt-1 rounded-lg border p-3 ${
                latestPrediction.direction === "bullish"
                  ? "border-emerald-500/25 bg-emerald-500/5"
                  : latestPrediction.direction === "bearish"
                    ? "border-red-500/25 bg-red-500/5"
                    : "border-amber-500/25 bg-amber-500/5"
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-mono font-600 text-white">
                  {latestPrediction.symbol} · {latestPrediction.timeframe}
                </span>
                <span
                  className={`text-[9px] font-mono px-2 py-0.5 rounded-full font-semibold uppercase tracking-widest ${
                    latestPrediction.direction === "bullish"
                      ? "bg-emerald-500/15 text-emerald-400"
                      : latestPrediction.direction === "bearish"
                        ? "bg-red-500/15 text-red-400"
                        : "bg-amber-500/15 text-amber-400"
                  }`}
                >
                  {latestPrediction.direction}
                </span>
              </div>
              <div className="flex gap-4 text-[10px] font-mono text-muted-foreground">
                <span>
                  Target{" "}
                  <span className="text-white">${latestPrediction.targetPrice.toFixed(2)}</span>
                </span>
                <span>
                  Conf{" "}
                  <span className="text-primary">
                    {(latestPrediction.confidence * 100).toFixed(0)}%
                  </span>
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Live Markets */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-[13px] font-700 text-white tracking-tight">
            Live Markets
          </h2>
          <div className="text-[10px] font-mono text-muted-foreground">
            {priceList.length} assets
          </div>
        </div>

        {loadingPrices && priceList.length === 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-28 rounded-xl bg-card/40 border border-white/[0.05] animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {priceList.map((price) => (
              <Card
                key={price.symbol}
                className={`overflow-hidden bg-card/60 border-white/[0.07] card-hover backdrop-blur-sm cursor-pointer transition-all duration-200 ${selectedSymbol === price.symbol ? "border-primary/30 bg-primary/[0.04]" : ""}`}
                onClick={() => handleCardClick(price.symbol, price.price, price.name)}
              >
                <CardContent className="p-3.5">
                  <div className="flex justify-between items-start mb-1.5">
                    <div>
                      <div className="font-display font-700 text-[13px] text-white leading-tight">
                        {price.symbol}
                      </div>
                      <div className="text-[9px] font-mono text-muted-foreground/70 truncate max-w-[72px] mt-0.5">
                        {price.name}
                      </div>
                    </div>
                    <div
                      className={`text-[10px] font-mono font-medium flex items-center gap-0.5 px-1.5 py-0.5 rounded ${
                        price.changePercent >= 0
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-red-500/10 text-red-400"
                      }`}
                    >
                      {price.changePercent >= 0 ? (
                        <TrendingUp className="w-2.5 h-2.5" />
                      ) : (
                        <TrendingDown className="w-2.5 h-2.5" />
                      )}
                      {Math.abs(price.changePercent).toFixed(2)}%
                    </div>
                  </div>

                  <div className="text-[13px] font-mono font-600 text-white mb-2">
                    $
                    {price.price.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
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
          <h2 className="font-display text-[13px] font-700 text-white tracking-tight">
            Latest Intelligence
          </h2>
          <div className="text-[10px] font-mono text-muted-foreground">
            {predictionList.length} signals
          </div>
        </div>

        {loadingPredictions && predictionList.length === 0 ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-32 rounded-xl bg-card/40 border border-white/[0.05] animate-pulse"
              />
            ))}
          </div>
        ) : predictionList.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-white/10 rounded-xl">
            <Target className="w-6 h-6 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-[12px] text-muted-foreground">
              No predictions yet. Search for an asset above.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {predictionList.map((pred) => (
              <div
                key={pred.id}
                className="relative overflow-hidden rounded-xl border border-white/[0.07] bg-card/60 backdrop-blur-sm card-hover"
              >
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
                      <span className="font-display font-700 text-[14px] text-white">
                        {pred.symbol}
                      </span>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground uppercase tracking-widest">
                        {pred.timeframe}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {pred.outcome === "correct" && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      )}
                      {pred.outcome === "incorrect" && (
                        <XCircle className="w-3.5 h-3.5 text-red-400" />
                      )}
                      {pred.outcome === "pending" && (
                        <Clock className="w-3.5 h-3.5 text-amber-400/60" />
                      )}
                      <div
                        className={`text-[9px] font-mono px-2 py-1 rounded-full font-semibold tracking-widest uppercase ${
                          pred.direction === "bullish"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : pred.direction === "bearish"
                              ? "bg-red-500/10 text-red-400 border border-red-500/20"
                              : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        }`}
                      >
                        {pred.direction}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <div className="data-label mb-1">Target Price</div>
                      <div className="text-[13px] font-mono font-600 text-white">
                        $
                        {pred.targetPrice.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="data-label">Confidence</span>
                        <span className="text-[10px] font-mono text-primary">
                          {(pred.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{
                            width: `${pred.confidence * 100}%`,
                            boxShadow: "0 0 6px rgba(0,212,255,0.5)",
                          }}
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
                          <span
                            className={`text-[11px] font-mono ${sig.bullish ? "text-emerald-400" : "text-red-400"}`}
                          >
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
