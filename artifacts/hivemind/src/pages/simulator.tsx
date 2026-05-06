import React, { useState } from "react";
import { useGetMarketPrices, useRunMonteCarlo } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { Activity, Play, BarChart2 } from "lucide-react";

export default function Simulator() {
  const { data: prices } = useGetMarketPrices();
  const runMonteCarlo = useRunMonteCarlo();

  const [selectedSymbol, setSelectedSymbol] = useState<string>("");
  const [volatility, setVolatility] = useState<number>(20);
  const [eventImpact, setEventImpact] = useState<number>(0);
  const [timeHorizon, setTimeHorizon] = useState<number>(30);
  const [simulations, setSimulations] = useState<number>(1000);

  const priceList = Array.isArray(prices) ? prices : [];
  const selectedPrice = priceList.find((p) => p.symbol === selectedSymbol);

  const handleRun = () => {
    if (!selectedSymbol || !selectedPrice) return;
    runMonteCarlo.mutate({
      data: {
        symbol: selectedSymbol,
        currentPrice: selectedPrice.price,
        volatility,
        eventImpact,
        timeHorizon,
        simulations,
      },
    });
  };

  const result = runMonteCarlo.data;

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h1 className="font-display text-[22px] font-700 text-white tracking-tight leading-none">Event Simulator</h1>
        <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1.5 font-mono">
          <Activity className="w-3 h-3 text-primary" />
          Monte Carlo Forecasting Engine
        </p>
      </div>

      {/* Controls */}
      <Card className="bg-card/60 border-white/[0.07] backdrop-blur-sm">
        <CardContent className="p-5 space-y-5">
          <div className="space-y-1.5">
            <label className="data-label">Target Asset</label>
            <Select value={selectedSymbol} onValueChange={setSelectedSymbol}>
              <SelectTrigger className="w-full bg-black/30 border-white/10 h-9 text-sm font-mono">
                <SelectValue placeholder="Select Asset" />
              </SelectTrigger>
              <SelectContent>
                {priceList.map((p) => (
                  <SelectItem key={p.symbol} value={p.symbol} className="font-mono">
                    {p.symbol} — ${p.price.toFixed(2)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2.5">
            <div className="flex justify-between items-center">
              <label className="data-label">Volatility</label>
              <span className="text-[12px] font-mono text-white">{volatility}%</span>
            </div>
            <Slider value={[volatility]} onValueChange={(v) => setVolatility(v[0])} max={100} min={1} step={1} />
          </div>

          <div className="space-y-2.5">
            <div className="flex justify-between items-center">
              <label className="data-label">Event Impact</label>
              <span className={`text-[12px] font-mono ${eventImpact > 0 ? "text-emerald-400" : eventImpact < 0 ? "text-red-400" : "text-white"}`}>
                {eventImpact > 0 ? "+" : ""}{eventImpact}%
              </span>
            </div>
            <Slider value={[eventImpact]} onValueChange={(v) => setEventImpact(v[0])} max={50} min={-50} step={1} />
          </div>

          <div className="space-y-2.5">
            <div className="flex justify-between items-center">
              <label className="data-label">Time Horizon</label>
              <span className="text-[12px] font-mono text-white">{timeHorizon}d</span>
            </div>
            <Slider value={[timeHorizon]} onValueChange={(v) => setTimeHorizon(v[0])} max={365} min={1} step={1} />
          </div>

          <div className="space-y-1.5">
            <label className="data-label">Simulation Paths</label>
            <Select value={simulations.toString()} onValueChange={(v) => setSimulations(parseInt(v))}>
              <SelectTrigger className="w-full bg-black/30 border-white/10 h-9 text-sm font-mono">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="500" className="font-mono">500 Paths</SelectItem>
                <SelectItem value="1000" className="font-mono">1,000 Paths</SelectItem>
                <SelectItem value="2000" className="font-mono">2,000 Paths</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            className="w-full gap-2 h-10 font-mono"
            onClick={handleRun}
            disabled={!selectedSymbol || runMonteCarlo.isPending}
          >
            {runMonteCarlo.isPending ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Computing {simulations.toLocaleString()} paths...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                Run Simulation
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Empty state */}
      {!result && !runMonteCarlo.isPending && (
        <div className="text-center py-12 border border-dashed border-white/10 rounded-xl">
          <BarChart2 className="w-7 h-7 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-[12px] text-muted-foreground">Select an asset and run a simulation.</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Key stats */}
          <div className="grid grid-cols-2 gap-3">
            <Card className="bg-card/60 border-white/[0.07] backdrop-blur-sm">
              <CardContent className="p-4">
                <div className="data-label mb-2">Median Forecast</div>
                <div className="stat-number text-white">${result.median.toFixed(2)}</div>
              </CardContent>
            </Card>
            <Card className="bg-card/60 border-white/[0.07] backdrop-blur-sm">
              <CardContent className="p-4">
                <div className="data-label mb-2">Bull / Bear Split</div>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-[20px] font-mono font-600 text-emerald-400">{(result.bullishProbability * 100).toFixed(0)}%</span>
                  <span className="text-muted-foreground font-mono text-sm">/</span>
                  <span className="text-[20px] font-mono font-600 text-red-400">{(result.bearishProbability * 100).toFixed(0)}%</span>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card/60 border-white/[0.07] backdrop-blur-sm col-span-2">
              <CardContent className="p-4">
                <div className="data-label mb-2">P10 — P90 Range</div>
                <div className="flex items-center gap-3">
                  <span className="text-[18px] font-mono font-600 text-red-400/80">${result.p10.toFixed(0)}</span>
                  <div className="flex-1 h-1 bg-gradient-to-r from-red-500/30 via-primary/40 to-emerald-500/30 rounded-full" />
                  <span className="text-[18px] font-mono font-600 text-emerald-400/80">${result.p90.toFixed(0)}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Fan Chart */}
          <Card className="bg-card/60 border-white/[0.07] backdrop-blur-sm">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-[12px] font-display font-700 text-white tracking-tight">Price Path Forecast</CardTitle>
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
                      tickFormatter={(v) => `$${v}`}
                      width={52}
                    />
                    {result.paths.slice(0, 40).map((path, i) => (
                      <Line
                        key={i}
                        data={path.map((val, day) => ({ day, val }))}
                        type="monotone"
                        dataKey="val"
                        stroke="#00d4ff"
                        strokeWidth={1}
                        strokeOpacity={0.12}
                        dot={false}
                        isAnimationActive={false}
                      />
                    ))}
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
                    <div className={`text-[9px] font-mono font-semibold tracking-widest ${p.color} mb-1`}>{p.label}</div>
                    <div className={`text-[10px] font-mono text-white`}>${p.value.toFixed(0)}</div>
                  </div>
                ))}
              </div>
              <div className="w-full h-5 bg-black/40 rounded-full overflow-hidden flex relative">
                <div className="h-full bg-red-500/25" style={{ width: "10%" }} />
                <div className="h-full bg-red-500/10 border-l border-white/5" style={{ width: "15%" }} />
                <div className="h-full bg-primary/20 border-l border-white/10" style={{ width: "25%" }} />
                <div className="h-full bg-primary/20 border-l border-white/30" style={{ width: "25%" }} />
                <div className="h-full bg-emerald-500/10 border-l border-white/10" style={{ width: "15%" }} />
                <div className="h-full bg-emerald-500/25 border-l border-white/5" style={{ width: "10%" }} />
                {selectedPrice && (
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-10"
                    style={{
                      left: `${Math.max(2, Math.min(98, ((selectedPrice.price - result.p10) / (result.p90 - result.p10)) * 80 + 10))}%`,
                      boxShadow: "0 0 6px rgba(251,191,36,0.8)",
                    }}
                  />
                )}
              </div>
              {selectedPrice && (
                <div className="text-[9px] font-mono text-amber-400 text-center mt-1.5">
                  ▲ Current: ${selectedPrice.price.toFixed(2)}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
