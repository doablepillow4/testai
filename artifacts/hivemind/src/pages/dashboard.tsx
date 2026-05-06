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
import { Activity, Target, TrendingUp, TrendingDown } from "lucide-react";
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
  const predictionList = Array.isArray(predictions) ? predictions : [];

  const handleGenerate = () => {
    if (!selectedSymbol) return;
    createPrediction.mutate({ data: { symbol: selectedSymbol, timeframe: selectedTimeframe } });
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Market Intelligence</h1>
        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
          <Activity className="w-3 h-3 text-primary" />
          Live data feed active
        </p>
      </div>

      {/* Summary Stats — 2×2 grid on mobile */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-card/50 border-white/5">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Model Accuracy</div>
            <div className="text-2xl font-bold text-white">
              {summary ? `${(summary.accuracy * 100).toFixed(1)}%` : "---"}
            </div>
            <div className="text-[10px] text-primary mt-1">
              {summary?.totalPredictions || 0} predictions
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-white/5">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Avg Confidence</div>
            <div className="text-2xl font-bold text-white">
              {summary ? `${(summary.averageConfidence * 100).toFixed(1)}%` : "---"}
            </div>
            <Progress value={summary ? summary.averageConfidence * 100 : 0} className="h-1 mt-2" />
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-white/5">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">30d Accuracy</div>
            <div className="text-2xl font-bold text-white">
              {summary ? `${(summary.recentAccuracy * 100).toFixed(1)}%` : "---"}
            </div>
            <div className={`text-[10px] mt-1 flex items-center gap-0.5 ${summary && summary.improvementTrend > 0 ? "text-green-400" : "text-red-400"}`}>
              {summary && summary.improvementTrend > 0
                ? <TrendingUp className="w-3 h-3" />
                : <TrendingDown className="w-3 h-3" />}
              {summary ? `${Math.abs(summary.improvementTrend * 100).toFixed(1)}% vs prior` : ""}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-white/5">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground mb-1">Correct / Total</div>
            <div className="text-2xl font-bold text-white">
              {summary ? `${summary.correctPredictions}/${summary.totalPredictions}` : "---"}
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">Resolved</div>
          </CardContent>
        </Card>
      </div>

      {/* Generate Prediction */}
      <Card className="bg-card/50 border-white/5">
        <CardContent className="p-4 space-y-3">
          <div className="text-sm font-semibold text-white">Generate Prediction</div>
          <div className="flex gap-2">
            <Select value={selectedSymbol} onValueChange={setSelectedSymbol}>
              <SelectTrigger className="flex-1 bg-background border-white/10 text-sm h-9">
                <SelectValue placeholder="Symbol" />
              </SelectTrigger>
              <SelectContent>
                {prices?.map((p) => (
                  <SelectItem key={p.symbol} value={p.symbol}>{p.symbol}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedTimeframe} onValueChange={setSelectedTimeframe}>
              <SelectTrigger className="w-28 bg-background border-white/10 text-sm h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1d">1 Day</SelectItem>
                <SelectItem value="1w">1 Week</SelectItem>
                <SelectItem value="1m">1 Month</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={handleGenerate}
            disabled={!selectedSymbol || createPrediction.isPending}
            className="w-full gap-2 h-9"
          >
            <Target className="w-4 h-4" />
            {createPrediction.isPending ? "Analyzing..." : "Predict"}
          </Button>
        </CardContent>
      </Card>

      {/* Live Markets */}
      <div>
        <h2 className="text-base font-semibold text-white mb-3">Live Markets</h2>
        {loadingPrices ? (
          <div className="text-sm text-muted-foreground">Loading markets...</div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {prices?.map((price) => (
              <Card key={price.symbol} className="overflow-hidden hover:border-primary/40 transition-colors">
                <CardContent className="p-3">
                  <div className="flex justify-between items-start mb-1">
                    <div>
                      <div className="font-bold text-sm text-white">{price.symbol}</div>
                      <div className="text-[10px] text-muted-foreground truncate max-w-[80px]">{price.name}</div>
                    </div>
                    <div className={`text-[11px] font-medium flex items-center gap-0.5 ${price.changePercent >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {price.changePercent >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {Math.abs(price.changePercent).toFixed(2)}%
                    </div>
                  </div>

                  <div className="text-base font-mono text-white mb-2">
                    ${price.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>

                  <div className="h-8 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={price.sparkline.map((val, i) => ({ val, i }))}>
                        <YAxis domain={["auto", "auto"]} hide />
                        <Line
                          type="monotone"
                          dataKey="val"
                          stroke={price.changePercent >= 0 ? "#4ade80" : "#f87171"}
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
        <h2 className="text-base font-semibold text-white mb-3">Latest Intelligence</h2>
        {loadingPredictions ? (
          <div className="text-sm text-muted-foreground">Loading predictions...</div>
        ) : (
          <div className="space-y-3">
            {predictionList.map((pred) => (
              <Card key={pred.id} className="bg-card/30 border-white/5 relative overflow-hidden">
                <div
                  className={`absolute top-0 left-0 w-1 h-full ${
                    pred.direction === "bullish"
                      ? "bg-green-500"
                      : pred.direction === "bearish"
                      ? "bg-red-500"
                      : "bg-yellow-500"
                  }`}
                />
                <CardContent className="p-4 pl-5">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white">{pred.symbol}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground uppercase tracking-wider">
                        {pred.timeframe}
                      </span>
                    </div>
                    <div
                      className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                        pred.direction === "bullish"
                          ? "bg-green-500/10 text-green-400"
                          : pred.direction === "bearish"
                          ? "bg-red-500/10 text-red-400"
                          : "bg-yellow-500/10 text-yellow-400"
                      }`}
                    >
                      {pred.direction.toUpperCase()}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <div className="text-[10px] text-muted-foreground mb-0.5">Target</div>
                      <div className="text-sm font-mono text-white">
                        ${pred.targetPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-muted-foreground mb-0.5 flex justify-between">
                        <span>Confidence</span>
                        <span className="text-primary">{(pred.confidence * 100).toFixed(0)}%</span>
                      </div>
                      <Progress value={pred.confidence * 100} className="h-1.5 mt-1" />
                    </div>
                  </div>

                  <div className="bg-black/20 rounded p-2.5 text-[11px]">
                    <div className="text-muted-foreground mb-1.5">Key Signals</div>
                    <div className="space-y-1">
                      {pred.signals.slice(0, 3).map((sig, i) => (
                        <div key={i} className="flex justify-between items-center">
                          <span className="text-gray-300">{sig.name}</span>
                          <span className={sig.bullish ? "text-green-400" : "text-red-400"}>
                            {sig.value.toFixed(2)} ({sig.weight.toFixed(1)})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
