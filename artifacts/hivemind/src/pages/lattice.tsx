import React, { useState } from "react";
import {
  useRunLattice,
  useGetLatticeAgents,
  getGetLatticeAgentsQueryKey,
} from "@workspace/api-client-react";
import type { LatticeResult, BeliefToken } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Network, Zap, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, AlertTriangle, Shield, Activity } from "lucide-react";

const SYMBOLS = ["BTC", "ETH", "SOL", "BNB", "NVDA", "TSLA", "AAPL", "MSFT", "AMZN", "META", "GOOGL", "SPY"];

const AGENT_LABELS: Record<string, string> = {
  hive_polymarket: "Hive (Polymarket)",
  hypothesis_momentum: "Momentum",
  hypothesis_meanrevert: "Mean Reversion",
  hypothesis_volregime: "Vol-Regime",
  hypothesis_hive: "Hive Wisdom",
  critique_devil: "Devil's Advocate",
  critique_tailrisk: "Tail Risk",
  synthesis: "Synthesis",
  meta: "Meta",
};

const AGENT_COLORS: Record<string, string> = {
  hive_polymarket: "text-purple-400",
  hypothesis_momentum: "text-blue-400",
  hypothesis_meanrevert: "text-cyan-400",
  hypothesis_volregime: "text-indigo-400",
  hypothesis_hive: "text-violet-400",
  critique_devil: "text-orange-400",
  critique_tailrisk: "text-red-400",
  synthesis: "text-primary",
  meta: "text-amber-400",
};

const AGENT_BG: Record<string, string> = {
  hive_polymarket: "bg-purple-500/10",
  hypothesis_momentum: "bg-blue-500/10",
  hypothesis_meanrevert: "bg-cyan-500/10",
  hypothesis_volregime: "bg-indigo-500/10",
  hypothesis_hive: "bg-violet-500/10",
  critique_devil: "bg-orange-500/10",
  critique_tailrisk: "bg-red-500/10",
  synthesis: "bg-primary/10",
  meta: "bg-amber-500/10",
};

function RegimeBadge({ regime, score }: { regime: string; score: number }) {
  const colors = {
    calm: "bg-emerald-500/10 text-emerald-400 border-emerald-500/25",
    volatile: "bg-amber-500/10 text-amber-400 border-amber-500/25",
    crisis: "bg-red-500/10 text-red-400 border-red-500/25",
  }[regime] ?? "bg-white/5 text-white border-white/10";
  return (
    <span className={`text-[9px] font-mono font-semibold px-2.5 py-1 rounded-full border ${colors} uppercase tracking-widest`}>
      {regime} · {(score * 100).toFixed(0)}
    </span>
  );
}

function DirectionIcon({ dir }: { dir: string }) {
  if (dir === "bullish") return <TrendingUp className="w-5 h-5 text-emerald-400" />;
  if (dir === "bearish") return <TrendingDown className="w-5 h-5 text-red-400" />;
  return <Minus className="w-5 h-5 text-amber-400" />;
}

function HivemindGauge({ score }: { score: number }) {
  const color = score >= 65 ? "#34d399" : score >= 40 ? "#f59e0b" : "#f87171";
  const pct = score / 100;
  const circ = 2 * Math.PI * 36;
  const dash = circ * pct;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg width="88" height="88" viewBox="0 0 96 96">
        <circle cx="48" cy="48" r="36" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
        <circle
          cx="48" cy="48" r="36" fill="none"
          stroke={color} strokeWidth="7"
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
          transform="rotate(-90 48 48)"
          style={{ filter: `drop-shadow(0 0 6px ${color}70)` }}
        />
        <text x="48" y="53" textAnchor="middle" fontSize="18" fontWeight="700" fill="white" fontFamily="JetBrains Mono">
          {score.toFixed(0)}
        </text>
      </svg>
      <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">HPL Score</span>
    </div>
  );
}

function ShapBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <span className="text-[11px] font-mono text-white">{(value * 100).toFixed(0)}%</span>
      </div>
      <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value * 100}%` }} />
      </div>
    </div>
  );
}

function TokenCard({ token }: { token: BeliefToken }) {
  const [open, setOpen] = useState(false);
  const label = AGENT_LABELS[token.agentType] ?? token.agentType;
  const colorClass = AGENT_COLORS[token.agentType] ?? "text-white";
  const bgClass = AGENT_BG[token.agentType] ?? "bg-white/5";
  const dir = token.hypothesis;
  const dirColor = dir === "bullish" ? "text-emerald-400" : dir === "bearish" ? "text-red-400" : "text-amber-400";

  return (
    <div className="bg-black/20 rounded-lg border border-white/[0.05] overflow-hidden">
      <button
        className="w-full flex items-center justify-between gap-2 p-3 hover:bg-white/[0.02] transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className={`text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded ${bgClass} ${colorClass} shrink-0`}>R{token.round}</span>
          <span className="text-[11px] text-white truncate">{label}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[11px] font-mono font-600 ${dirColor}`}>{(token.probability * 100).toFixed(0)}%</span>
          <span className={`text-[9px] font-mono uppercase tracking-widest ${dirColor}`}>{dir}</span>
          {open ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
        </div>
      </button>
      {open && (
        <div className="px-3 pb-3 pt-0 border-t border-white/[0.05] space-y-1.5">
          {token.rationale.map((r, i) => (
            <p key={i} className="text-[11px] text-muted-foreground leading-relaxed">{r}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function LatticeResultView({ result }: { result: LatticeResult }) {
  const [showTokens, setShowTokens] = useState(false);
  const { finalPrediction, shap, debateRounds, causalNarrative, minorityReport, agentConsensus, tokens, regime, regimeScore } = result;

  const directionColor = finalPrediction.direction === "bullish"
    ? "text-emerald-400"
    : finalPrediction.direction === "bearish"
    ? "text-red-400"
    : "text-amber-400";

  return (
    <div className="space-y-4">
      {/* Main result */}
      <Card className="bg-card/60 border-white/[0.07] backdrop-blur-sm overflow-hidden">
        <div className={`h-0.5 w-full ${finalPrediction.direction === "bullish" ? "bg-gradient-to-r from-emerald-500/50 to-transparent" : finalPrediction.direction === "bearish" ? "bg-gradient-to-r from-red-500/50 to-transparent" : "bg-gradient-to-r from-amber-500/50 to-transparent"}`} />
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-4">
            <div className="space-y-2">
              <RegimeBadge regime={regime} score={regimeScore} />
              <div className="flex items-center gap-2">
                <DirectionIcon dir={finalPrediction.direction} />
                <span className={`font-display text-2xl font-800 ${directionColor}`}>
                  {finalPrediction.direction.toUpperCase()}
                </span>
              </div>
              <div className="space-y-0.5">
                <div className="text-[11px] font-mono text-muted-foreground">
                  Target: <span className="text-white font-600">${finalPrediction.targetPrice.toFixed(2)}</span>
                </div>
                <div className="text-[11px] font-mono text-muted-foreground">
                  Confidence: <span className="text-white font-600">{(finalPrediction.confidence * 100).toFixed(0)}%</span>
                </div>
                <div className="text-[11px] font-mono text-muted-foreground">
                  Consensus: <span className="text-primary font-600">{(agentConsensus * 100).toFixed(0)}%</span>
                </div>
              </div>
            </div>
            <HivemindGauge score={finalPrediction.hivemindScore} />
          </div>
        </CardContent>
      </Card>

      {/* SHAP Attribution */}
      <Card className="bg-card/60 border-white/[0.07] backdrop-blur-sm">
        <CardContent className="p-4 space-y-3">
          <div className="data-label mb-1">Signal Attribution (SHAP)</div>
          <ShapBar label="🐝 Hive (Polymarket)" value={shap.hive} color="bg-purple-500" />
          <ShapBar label="🤖 AI Ensemble" value={shap.ai} color="bg-primary" />
          <ShapBar label="🌍 Geopolitical" value={shap.geo} color="bg-orange-500" />
        </CardContent>
      </Card>

      {/* Minority Report */}
      {minorityReport && (
        <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-4 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-[10px] font-semibold text-orange-400 mb-1 tracking-widest uppercase">Minority Report</div>
            <p className="text-[11px] text-orange-200/80 leading-relaxed">{minorityReport}</p>
          </div>
        </div>
      )}

      {/* Debate Rounds */}
      <Card className="bg-card/60 border-white/[0.07] backdrop-blur-sm">
        <CardContent className="p-4">
          <div className="data-label mb-3">Debate Rounds</div>
          <div className="space-y-3">
            {debateRounds.map((round, i) => (
              <div key={i} className="border-l-2 border-white/10 pl-3">
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[11px] font-semibold ${AGENT_COLORS[round.agentType] ?? "text-white"}`}>
                    R{round.round} — {AGENT_LABELS[round.agentType] ?? round.agentType}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-mono ${round.adjustment < 0 ? "text-red-400" : "text-emerald-400"}`}>
                      {round.adjustment >= 0 ? "+" : ""}{(round.adjustment * 100).toFixed(1)}%
                    </span>
                    <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded tracking-widest ${round.accepted ? "bg-emerald-500/10 text-emerald-400" : "bg-white/5 text-muted-foreground"}`}>
                      {round.accepted ? "ACCEPTED" : "REJECTED"}
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-3">{round.challenge}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Causal Narrative */}
      <Card className="bg-card/60 border-white/[0.07] backdrop-blur-sm">
        <CardContent className="p-4">
          <div className="data-label mb-3">Causal Narrative</div>
          <div className="space-y-1.5">
            {causalNarrative.split("\n").filter(l => l.trim()).map((line, i) => (
              <p key={i} className={`text-[11px] leading-relaxed font-mono ${
                line.startsWith("HPL") ? "text-primary font-medium" :
                line.startsWith("Market Regime") || line.startsWith("Signal") || line.startsWith("Price Target")
                  ? "text-white/80 font-medium" : "text-muted-foreground"
              }`}>
                {line}
              </p>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Belief Token DAG */}
      <Card className="bg-card/60 border-white/[0.07] backdrop-blur-sm">
        <CardContent className="p-4">
          <button
            className="w-full flex items-center justify-between hover:opacity-80 transition-opacity"
            onClick={() => setShowTokens(o => !o)}
          >
            <div className="data-label">Belief Token DAG ({tokens.length} nodes)</div>
            {showTokens ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
          {showTokens && (
            <div className="mt-3 space-y-2">
              {tokens.map((token) => (
                <TokenCard key={token.id} token={token} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function Lattice() {
  const [symbol, setSymbol] = useState("");
  const [timeframe, setTimeframe] = useState("7d");
  const runLattice = useRunLattice();
  const { data: agents } = useGetLatticeAgents({
    query: { queryKey: getGetLatticeAgentsQueryKey() },
  });

  const result = runLattice.data;
  const agentList = Array.isArray(agents) ? agents : [];

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h1 className="font-display text-[22px] font-700 text-white tracking-tight leading-none">Predictive Lattice</h1>
        <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1.5 font-mono">
          <Network className="w-3 h-3 text-primary" />
          HPL-HPA v2 · Multi-agent intelligence engine
        </p>
      </div>

      {/* Run controls */}
      <Card className="bg-card/60 border-white/[0.07] backdrop-blur-sm">
        <CardContent className="p-4 space-y-4">
          <div className="data-label">Configure Lattice Run</div>
          <div className="flex gap-2">
            <Select value={symbol} onValueChange={setSymbol}>
              <SelectTrigger className="flex-1 bg-black/30 border-white/10 h-9 text-sm font-mono">
                <SelectValue placeholder="Symbol" />
              </SelectTrigger>
              <SelectContent>
                {SYMBOLS.map((s) => (
                  <SelectItem key={s} value={s} className="font-mono">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={timeframe} onValueChange={setTimeframe}>
              <SelectTrigger className="w-24 bg-black/30 border-white/10 h-9 text-sm font-mono">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1d" className="font-mono">1D</SelectItem>
                <SelectItem value="7d" className="font-mono">7D</SelectItem>
                <SelectItem value="30d" className="font-mono">30D</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            className="w-full gap-2 font-mono"
            onClick={() => { if (symbol) runLattice.mutate({ data: { symbol, timeframe } }); }}
            disabled={!symbol || runLattice.isPending}
          >
            {runLattice.isPending ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Running 6 agents · 2 debate rounds…
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Run HPL Lattice
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {result && <LatticeResultView result={result} />}

      {/* Agent reputation */}
      {agentList.length > 0 && (
        <Card className="bg-card/60 border-white/[0.07] backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-3.5 h-3.5 text-primary" />
              <div className="data-label">Agent Reputation</div>
            </div>
            <div className="space-y-2.5">
              {agentList.map((agent) => (
                <div key={agent.agentId} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Activity className={`w-3 h-3 shrink-0 ${AGENT_COLORS[agent.agentType] ?? "text-white"}`} />
                    <span className="text-[11px] text-muted-foreground truncate">
                      {AGENT_LABELS[agent.agentType] ?? agent.agentType}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="w-16 h-1 bg-white/[0.05] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${AGENT_BG[agent.agentType] ?? "bg-white/20"}`}
                        style={{ width: `${Math.min(100, agent.reputation * 100)}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-mono text-white w-8 text-right">{agent.reputation.toFixed(2)}</span>
                    <span className="text-[10px] font-mono text-muted-foreground w-10 text-right">
                      {agent.totalRuns > 0 ? `${agent.correctRuns}/${agent.totalRuns}` : "—"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
