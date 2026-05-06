import React, { useState } from "react";
import { useGetMarketPrices, useRunMonteCarlo } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid } from "recharts";
import { Activity, Play, ArrowRight, TrendingUp, TrendingDown } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export default function Simulator() {
  const { data: prices, isLoading: loadingPrices } = useGetMarketPrices();
  const runMonteCarlo = useRunMonteCarlo();

  const [selectedSymbol, setSelectedSymbol] = useState<string>("");
  const [volatility, setVolatility] = useState<number>(20);
  const [eventImpact, setEventImpact] = useState<number>(0);
  const [timeHorizon, setTimeHorizon] = useState<number>(30);
  const [simulations, setSimulations] = useState<number>(1000);

  const selectedPrice = prices?.find(p => p.symbol === selectedSymbol);

  const handleRunSimulation = () => {
    if (!selectedSymbol || !selectedPrice) return;
    
    runMonteCarlo.mutate({
      data: {
        symbol: selectedSymbol,
        currentPrice: selectedPrice.price,
        volatility: volatility / 100, // Convert to decimal
        eventImpact: eventImpact / 100, // Convert to decimal
        timeHorizon,
        simulations
      }
    });
  };

  const result = runMonteCarlo.data;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Event Simulator</h1>
        <p className="text-muted-foreground mt-1 flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          Monte Carlo Forecasting Engine
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls Panel */}
        <Card className="bg-card/50 backdrop-blur-sm border-white/5 lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-xl text-white">Parameters</CardTitle>
            <CardDescription className="text-muted-foreground">Configure the simulation</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Target Asset</label>
              <Select value={selectedSymbol} onValueChange={setSelectedSymbol}>
                <SelectTrigger className="w-full bg-background border-none">
                  <SelectValue placeholder="Select Asset" />
                </SelectTrigger>
                <SelectContent>
                  {prices?.map(p => (
                    <SelectItem key={p.symbol} value={p.symbol}>
                      {p.symbol} - ${p.price.toFixed(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-sm font-medium text-muted-foreground">Volatility</label>
                <span className="text-sm text-white font-mono">{volatility}%</span>
              </div>
              <Slider 
                value={[volatility]} 
                onValueChange={(val) => setVolatility(val[0])} 
                max={100} 
                min={1} 
                step={1}
                className="[&_[role=slider]]:border-primary"
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-sm font-medium text-muted-foreground">Event Impact</label>
                <span className="text-sm text-white font-mono">{eventImpact > 0 ? '+' : ''}{eventImpact}%</span>
              </div>
              <Slider 
                value={[eventImpact]} 
                onValueChange={(val) => setEventImpact(val[0])} 
                max={50} 
                min={-50} 
                step={1}
                className="[&_[role=slider]]:border-primary"
              />
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <label className="text-sm font-medium text-muted-foreground">Time Horizon</label>
                <span className="text-sm text-white font-mono">{timeHorizon} Days</span>
              </div>
              <Slider 
                value={[timeHorizon]} 
                onValueChange={(val) => setTimeHorizon(val[0])} 
                max={365} 
                min={1} 
                step={1}
                className="[&_[role=slider]]:border-primary"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Simulation Count</label>
              <Select value={simulations.toString()} onValueChange={(val) => setSimulations(parseInt(val))}>
                <SelectTrigger className="w-full bg-background border-none">
                  <SelectValue placeholder="Count" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="500">500 Paths</SelectItem>
                  <SelectItem value="1000">1,000 Paths</SelectItem>
                  <SelectItem value="2000">2,000 Paths</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button 
              className="w-full gap-2 mt-4" 
              size="lg"
              onClick={handleRunSimulation}
              disabled={!selectedSymbol || runMonteCarlo.isPending}
            >
              {runMonteCarlo.isPending ? (
                <>Running Simulation...</>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  Run Simulation
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Results Panel */}
        <div className="lg:col-span-2 space-y-6">
          {!result && !runMonteCarlo.isPending && (
            <Card className="bg-card/30 border-dashed border-white/10 h-full flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <LineChart className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium text-white mb-2">Awaiting Simulation</h3>
                <p className="text-muted-foreground max-w-sm mx-auto">
                  Select an asset and configure the parameters to generate a Monte Carlo forecast.
                </p>
              </div>
            </Card>
          )}

          {runMonteCarlo.isPending && (
            <Card className="bg-card/30 border-white/5 h-full flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-muted-foreground">Computing {simulations.toLocaleString()} possible futures...</p>
              </div>
            </Card>
          )}

          {result && (
            <>
              {/* Top Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="bg-card/50 border-white/5">
                  <CardContent className="p-4">
                    <div className="text-xs text-muted-foreground mb-1">Median Forecast</div>
                    <div className="text-2xl font-bold font-mono text-white">
                      ${result.median.toFixed(2)}
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-card/50 border-white/5">
                  <CardContent className="p-4">
                    <div className="text-xs text-muted-foreground mb-1">Bullish Prob.</div>
                    <div className="text-2xl font-bold font-mono text-green-400">
                      {(result.bullishProbability * 100).toFixed(1)}%
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-card/50 border-white/5">
                  <CardContent className="p-4">
                    <div className="text-xs text-muted-foreground mb-1">Bearish Prob.</div>
                    <div className="text-2xl font-bold font-mono text-red-400">
                      {(result.bearishProbability * 100).toFixed(1)}%
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-card/50 border-white/5">
                  <CardContent className="p-4">
                    <div className="text-xs text-muted-foreground mb-1">P10 - P90 Range</div>
                    <div className="text-lg font-bold font-mono text-white mt-1">
                      ${result.p10.toFixed(0)} - ${result.p90.toFixed(0)}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Fan Chart */}
              <Card className="bg-card/50 border-white/5">
                <CardHeader>
                  <CardTitle className="text-lg text-white">Price Path Forecast</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                        <XAxis 
                          dataKey="day" 
                          stroke="#ffffff50" 
                          fontSize={12}
                          tickFormatter={(val) => `D${val}`}
                          type="number"
                          domain={[0, 'dataMax']}
                        />
                        <YAxis 
                          domain={['auto', 'auto']} 
                          stroke="#ffffff50" 
                          fontSize={12}
                          tickFormatter={(val) => `$${val}`}
                        />
                        {result.paths.slice(0, 50).map((path, i) => (
                          <Line 
                            key={i}
                            data={path.map((val, day) => ({ day, val }))}
                            type="monotone"
                            dataKey="val"
                            stroke="#00d4ff"
                            strokeWidth={1}
                            strokeOpacity={0.15}
                            dot={false}
                            isAnimationActive={false}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Distribution */}
              <Card className="bg-card/50 border-white/5">
                <CardHeader>
                  <CardTitle className="text-lg text-white">Percentile Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[100px] flex flex-col justify-center">
                    <div className="flex justify-between mb-2 text-xs font-mono text-muted-foreground">
                      <span>P10: ${result.p10.toFixed(2)}</span>
                      <span>P25: ${result.p25.toFixed(2)}</span>
                      <span className="text-primary">Median: ${result.median.toFixed(2)}</span>
                      <span>P75: ${result.p75.toFixed(2)}</span>
                      <span>P90: ${result.p90.toFixed(2)}</span>
                    </div>
                    <div className="w-full h-8 bg-black/40 rounded-full relative overflow-hidden flex">
                      <div className="h-full bg-red-500/20" style={{ width: '10%' }} />
                      <div className="h-full bg-red-500/10 border-l border-white/10" style={{ width: '15%' }} />
                      <div className="h-full bg-primary/20 border-l border-white/20" style={{ width: '25%' }} />
                      <div className="h-full bg-primary/20 border-l border-white/50" style={{ width: '25%' }} />
                      <div className="h-full bg-green-500/10 border-l border-white/20" style={{ width: '15%' }} />
                      <div className="h-full bg-green-500/20 border-l border-white/10" style={{ width: '10%' }} />
                      
                      {/* Current Price Marker */}
                      {selectedPrice && (
                        <div 
                          className="absolute top-0 bottom-0 w-0.5 bg-yellow-500 z-10" 
                          style={{ 
                            left: `${Math.max(0, Math.min(100, ((selectedPrice.price - result.p10) / (result.p90 - result.p10)) * 80 + 10))}%` 
                          }}
                        >
                          <div className="absolute -top-6 -translate-x-1/2 text-[10px] text-yellow-500 whitespace-nowrap bg-black/80 px-1 rounded">
                            Current
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
