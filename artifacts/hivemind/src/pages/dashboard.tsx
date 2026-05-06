import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useGetMarketPrices, useGetPredictions, useGetPredictionsSummary, useCreatePrediction, getGetMarketPricesQueryKey, getGetPredictionsQueryKey, getGetPredictionsSummaryQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCw, Activity, Target, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";

export default function Dashboard() {
  const { data: prices, isLoading: loadingPrices } = useGetMarketPrices({
    query: { refetchInterval: 30000, queryKey: getGetMarketPricesQueryKey() }
  });
  
  const { data: predictions, isLoading: loadingPredictions } = useGetPredictions({
    query: { refetchInterval: 30000, queryKey: getGetPredictionsQueryKey() }
  });
  
  const { data: summary, isLoading: loadingSummary } = useGetPredictionsSummary({
    query: { refetchInterval: 30000, queryKey: getGetPredictionsSummaryQueryKey() }
  });

  const queryClient = useQueryClient();
  const createPrediction = useCreatePrediction({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetPredictionsQueryKey() });
      }
    }
  });
  
  const [selectedSymbol, setSelectedSymbol] = useState<string>("");
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>("1w");

  const handleGenerate = () => {
    if (!selectedSymbol) return;
    createPrediction.mutate({
      data: { symbol: selectedSymbol, timeframe: selectedTimeframe }
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Market Intelligence</h1>
          <p className="text-muted-foreground mt-1 flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Live data feed active
          </p>
        </div>
        
        <div className="flex items-center gap-4 bg-card p-2 rounded-lg border border-border">
          <Select value={selectedSymbol} onValueChange={setSelectedSymbol}>
            <SelectTrigger className="w-[120px] bg-background border-none">
              <SelectValue placeholder="Symbol" />
            </SelectTrigger>
            <SelectContent>
              {prices?.map(p => (
                <SelectItem key={p.symbol} value={p.symbol}>{p.symbol}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={selectedTimeframe} onValueChange={setSelectedTimeframe}>
            <SelectTrigger className="w-[120px] bg-background border-none">
              <SelectValue placeholder="Timeframe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1d">1 Day</SelectItem>
              <SelectItem value="1w">1 Week</SelectItem>
              <SelectItem value="1m">1 Month</SelectItem>
            </SelectContent>
          </Select>
          
          <Button 
            onClick={handleGenerate} 
            disabled={!selectedSymbol || createPrediction.isPending}
            className="gap-2"
          >
            <Target className="w-4 h-4" />
            Predict
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-card/50 backdrop-blur-sm border-white/5">
          <CardContent className="p-6">
            <div className="text-sm font-medium text-muted-foreground mb-2">Model Accuracy</div>
            <div className="text-3xl font-bold text-white">
              {summary ? `${(summary.accuracy * 100).toFixed(1)}%` : "---"}
            </div>
            <div className="text-xs text-primary mt-2">
              Based on {summary?.totalPredictions || 0} predictions
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-card/50 backdrop-blur-sm border-white/5">
          <CardContent className="p-6">
            <div className="text-sm font-medium text-muted-foreground mb-2">Avg Confidence</div>
            <div className="text-3xl font-bold text-white">
              {summary ? `${(summary.averageConfidence * 100).toFixed(1)}%` : "---"}
            </div>
            <Progress value={summary ? summary.averageConfidence * 100 : 0} className="h-1 mt-3" />
          </CardContent>
        </Card>
        
        <Card className="bg-card/50 backdrop-blur-sm border-white/5">
          <CardContent className="p-6">
            <div className="text-sm font-medium text-muted-foreground mb-2">Recent Accuracy (30d)</div>
            <div className="text-3xl font-bold text-white">
              {summary ? `${(summary.recentAccuracy * 100).toFixed(1)}%` : "---"}
            </div>
            <div className={`text-xs mt-2 flex items-center gap-1 ${summary && summary.improvementTrend > 0 ? "text-green-400" : "text-red-400"}`}>
              {summary && summary.improvementTrend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {summary ? `${Math.abs(summary.improvementTrend * 100).toFixed(1)}% vs prior` : ""}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-white/5">
          <CardContent className="p-6">
            <div className="text-sm font-medium text-muted-foreground mb-2">Correct / Total</div>
            <div className="text-3xl font-bold text-white">
              {summary ? `${summary.correctPredictions} / ${summary.totalPredictions}` : "---"}
            </div>
            <div className="text-xs text-muted-foreground mt-2">
              Resolved predictions
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Prices Grid */}
      <div>
        <h2 className="text-xl font-semibold text-white mb-4">Live Markets</h2>
        {loadingPrices ? (
          <div className="text-muted-foreground">Loading markets...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {prices?.map((price) => (
              <Card key={price.symbol} className="overflow-hidden hover:border-primary/50 transition-colors cursor-default group">
                <CardContent className="p-5">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="font-bold text-lg text-white">{price.symbol}</div>
                      <div className="text-xs text-muted-foreground">{price.name}</div>
                    </div>
                    <div className={`text-sm font-medium flex items-center gap-1 ${price.changePercent >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {price.changePercent >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {Math.abs(price.changePercent).toFixed(2)}%
                    </div>
                  </div>
                  
                  <div className="text-2xl font-mono text-white mb-4">
                    ${price.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  
                  <div className="h-10 w-full opacity-50 group-hover:opacity-100 transition-opacity">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={price.sparkline.map((val, i) => ({ val, i }))}>
                        <YAxis domain={['auto', 'auto']} hide />
                        <Line 
                          type="monotone" 
                          dataKey="val" 
                          stroke={price.changePercent >= 0 ? "#4ade80" : "#f87171"} 
                          strokeWidth={2} 
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
        <h2 className="text-xl font-semibold text-white mb-4">Latest Intelligence</h2>
        {loadingPredictions ? (
          <div className="text-muted-foreground">Loading predictions...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {predictions?.map((pred) => (
              <Card key={pred.id} className="bg-card/30 border-white/5 relative overflow-hidden">
                <div className={`absolute top-0 left-0 w-1 h-full ${
                  pred.direction === 'bullish' ? 'bg-green-500' : 
                  pred.direction === 'bearish' ? 'bg-red-500' : 'bg-yellow-500'
                }`} />
                <CardContent className="p-5 pl-6">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-lg">{pred.symbol}</span>
                      <span className="text-xs px-2 py-1 rounded bg-white/5 text-muted-foreground uppercase tracking-wider">
                        {pred.timeframe}
                      </span>
                    </div>
                    <div className={`text-xs px-2 py-1 rounded font-medium ${
                      pred.direction === 'bullish' ? 'bg-green-500/10 text-green-400' : 
                      pred.direction === 'bearish' ? 'bg-red-500/10 text-red-400' : 
                      'bg-yellow-500/10 text-yellow-400'
                    }`}>
                      {pred.direction.toUpperCase()}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Target</div>
                      <div className="text-lg font-mono text-white">
                        ${pred.targetPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1 flex justify-between">
                        <span>Confidence</span>
                        <span className="text-primary">{(pred.confidence * 100).toFixed(0)}%</span>
                      </div>
                      <Progress value={pred.confidence * 100} className="h-1.5 mt-2" />
                    </div>
                  </div>

                  <div className="bg-black/20 rounded p-3 text-xs">
                    <div className="text-muted-foreground mb-2">Key Signals</div>
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
