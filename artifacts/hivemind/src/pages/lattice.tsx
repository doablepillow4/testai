import React, { useState, useRef, useEffect } from "react";
import { useRunLattice, useGetLatticeAgents, getGetLatticeAgentsQueryKey, useGetMarketPrices, getGetMarketPricesQueryKey } from "@workspace/api-client-react";
import type { LatticeResult, BeliefToken } from "@workspace/api-client-react";
import { TickerCombobox } from "@/components/ticker-combobox";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Network, Zap, TrendingUp, TrendingDown, Minus, AlertTriangle, Shield,
  ThumbsUp, MessageSquare, Send, ChevronDown, ChevronUp, Search, X, Sparkles,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
  ReferenceLine, Tooltip,
} from "recharts";
import { useAppStore } from "@/store/app-store";

// ─── Agent Personas ──────────────────────────────────────────────────────────
interface AgentPersona {
  name: string;
  emoji: string;
  specialty: string;
  bio: string;
  color: string;
  bgColor: string;
  borderColor: string;
  shapLabel: string;
}

const PERSONAS: Record<string, AgentPersona> = {
  hive_polymarket: {
    name: "HIVEMIND",
    emoji: "🐝",
    specialty: "Crowd Intelligence",
    bio: "Aggregates real-money Polymarket signals. Follows smart money with skin in the game.",
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/25",
    shapLabel: "Crowd Signal",
  },
  hypothesis_momentum: {
    name: "MOMO",
    emoji: "📈",
    specialty: "Trend Following",
    bio: "Chases price action. Believes trends persist until they don't. RSI, MACD, MA crossover devotee.",
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/25",
    shapLabel: "AI Technical",
  },
  hypothesis_meanrevert: {
    name: "REVERTER",
    emoji: "🔄",
    specialty: "Mean Reversion",
    bio: "Fades extremes. Every 2σ deviation is an opportunity. Bollinger Bands specialist.",
    color: "text-cyan-400",
    bgColor: "bg-cyan-500/10",
    borderColor: "border-cyan-500/25",
    shapLabel: "AI Technical",
  },
  hypothesis_volregime: {
    name: "VOLT",
    emoji: "⚡",
    specialty: "Vol-Regime Analysis",
    bio: "Reads the macro environment. Calibrates all signals against calm / volatile / crisis regimes.",
    color: "text-indigo-400",
    bgColor: "bg-indigo-500/10",
    borderColor: "border-indigo-500/25",
    shapLabel: "AI Technical",
  },
  hypothesis_hive: {
    name: "HIVE WISDOM",
    emoji: "🦋",
    specialty: "Crowd Synthesis",
    bio: "Translates Polymarket crowd intelligence into a directional bias. Liquidity-weighted oracle.",
    color: "text-violet-400",
    bgColor: "bg-violet-500/10",
    borderColor: "border-violet-500/25",
    shapLabel: "Crowd Signal",
  },
  critique_devil: {
    name: "SKEPTIC",
    emoji: "😈",
    specialty: "Devil's Advocate",
    bio: "Challenges consensus. Applies overconfidence penalties. The contrarian in the room.",
    color: "text-orange-400",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/25",
    shapLabel: "AI Critique",
  },
  critique_tailrisk: {
    name: "BLACKBIRD",
    emoji: "🦅",
    specialty: "Tail Risk & Geopolitics",
    bio: "Models fat tails. Watches Hormuz, Taiwan, crypto contagion. Kurtosis is always underestimated.",
    color: "text-red-400",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/25",
    shapLabel: "Geo Risk",
  },
  synthesis: {
    name: "ORACLE",
    emoji: "⚖️",
    specialty: "Bayesian Aggregation",
    bio: "Reputation-weighted fusion of all agents. Platt-calibrated probability output.",
    color: "text-primary",
    bgColor: "bg-primary/10",
    borderColor: "border-primary/25",
    shapLabel: "Synthesis",
  },
  meta: {
    name: "ARBITER",
    emoji: "🧠",
    specialty: "Final Verdict",
    bio: "Regime-calibrated final call. Issues the Hivemind Score. The last word.",
    color: "text-amber-400",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-500/25",
    shapLabel: "Meta",
  },
};

// ─── NL Symbol Extractor ──────────────────────────────────────────────────────
const NL_SYMBOLS = ["BTC", "ETH", "SOL", "BNB", "NVDA", "TSLA", "AAPL", "MSFT", "AMZN", "META", "GOOGL", "SPY", "DOGE", "PLTR", "COIN", "AMD", "NFLX"];

const NL_NAME_MAP: [RegExp, string][] = [
  [/bitcoin/i, "BTC"],
  [/ethereum|ether\b/i, "ETH"],
  [/solana/i, "SOL"],
  [/nvidia|gpu|graphics card/i, "NVDA"],
  [/tesla\b/i, "TSLA"],
  [/apple\b|iphone/i, "AAPL"],
  [/microsoft|azure|copilot/i, "MSFT"],
  [/amazon\b|aws\b/i, "AMZN"],
  [/alphabet|google/i, "GOOGL"],
  [/facebook|instagram|zuckerberg/i, "META"],
  [/semiconductor|chipmaker/i, "NVDA"],
  [/s&p\s*500|spy\b/i, "SPY"],
  [/dogecoin/i, "DOGE"],
  [/palantir/i, "PLTR"],
  [/coinbase/i, "COIN"],
];

function extractSymbolFromText(text: string): string | null {
  const upper = text.toUpperCase();
  for (const sym of NL_SYMBOLS) {
    if (new RegExp(`\\b${sym}\\b`).test(upper)) return sym;
  }
  for (const [regex, sym] of NL_NAME_MAP) {
    if (regex.test(text)) return sym;
  }
  const tickerMatch = upper.match(/\b([A-Z]{1,5})\b/g);
  if (tickerMatch && tickerMatch.length > 0) return tickerMatch[0];
  return null;
}

// ─── Challenge Hook ───────────────────────────────────────────────────────────
interface ChallengeResult {
  response: string;
  adjustment: number;
  newProbability: number;
}

function useChallengeAgent(symbol: string) {
  const [results, setResults] = useState<Record<string, ChallengeResult & { loading?: boolean }>>({});

  const challenge = async (agentType: string, text: string, prob: number) => {
    setResults((s) => ({ ...s, [agentType]: { ...s[agentType], loading: true, response: "", adjustment: 0, newProbability: prob } }));
    try {
      const res = await fetch("/api/lattice/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentType, challenge: text, symbol, currentProbability: prob }),
      });
      const data = (await res.json()) as ChallengeResult;
      setResults((s) => ({ ...s, [agentType]: { ...data, loading: false } }));
    } catch {
      setResults((s) => ({
        ...s,
        [agentType]: { loading: false, response: "Challenge failed — API unreachable.", adjustment: 0, newProbability: prob },
      }));
    }
  };

  return { results, challenge };
}

// ─── Convergence Data ─────────────────────────────────────────────────────────
function buildConvergenceData(tokens: BeliefToken[]) {
  const ROUNDS = [
    { round: 0, label: "Hive" },
    { round: 1, label: "Hypothesis" },
    { round: 2, label: "Critique" },
    { round: 3, label: "Synthesis" },
    { round: 4, label: "Final" },
  ];
  return ROUNDS.map(({ round, label }) => {
    const rt = tokens.filter((t) => t.round === round);
    if (rt.length === 0) return null;
    const avg = rt.reduce((s, t) => s + t.probability, 0) / rt.length;
    const entry: Record<string, string | number> = { label };
    rt.forEach((t) => {
      entry[t.agentType] = parseFloat(t.probability.toFixed(3));
    });
    entry.consensus = parseFloat(avg.toFixed(3));
    return entry;
  }).filter(Boolean) as Record<string, string | number>[];
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function DirectionBadge({ dir, prob }: { dir: string; prob: number }) {
  const cfg = dir === "bullish"
    ? { cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25", icon: <TrendingUp className="w-3 h-3" /> }
    : dir === "bearish"
    ? { cls: "bg-red-500/15 text-red-400 border-red-500/25", icon: <TrendingDown className="w-3 h-3" /> }
    : { cls: "bg-amber-500/15 text-amber-400 border-amber-500/25", icon: <Minus className="w-3 h-3" /> };

  return (
    <div className={`flex items-center gap-1 border px-2 py-1 rounded-full ${cfg.cls}`}>
      {cfg.icon}
      <span className="text-[10px] font-mono font-600">{(prob * 100).toFixed(0)}%</span>
      <span className="text-[9px] font-mono uppercase tracking-widest">{dir}</span>
    </div>
  );
}

function ShapFactors({ shapHive, shapAi, shapGeo }: { shapHive: number; shapAi: number; shapGeo: number }) {
  const total = shapHive + shapAi + shapGeo;
  if (total === 0) return null;
  const items = [
    { label: "Crowd", val: shapHive / total, color: "bg-purple-400" },
    { label: "AI", val: shapAi / total, color: "bg-blue-400" },
    { label: "Geo", val: shapGeo / total, color: "bg-orange-400" },
  ].filter((i) => i.val > 0.05);

  return (
    <div className="flex gap-1 flex-wrap">
      {items.map((i) => (
        <span key={i.label} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/[0.05] text-muted-foreground">
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${i.color} mr-1`} />
          {i.label} {(i.val * 100).toFixed(0)}%
        </span>
      ))}
    </div>
  );
}

function AgentRosterCard({
  agentType,
  reputation,
}: {
  agentType: string;
  reputation: number;
}) {
  const p = PERSONAS[agentType] ?? PERSONAS["synthesis"];
  return (
    <div className={`rounded-xl border ${p.borderColor} ${p.bgColor} p-3 flex flex-col gap-2`}>
      <div className="flex items-center gap-2">
        <span className="text-2xl leading-none">{p.emoji}</span>
        <div className="min-w-0">
          <div className={`text-[11px] font-mono font-700 ${p.color} tracking-wide`}>{p.name}</div>
          <div className="text-[9px] text-muted-foreground/70 tracking-wide font-mono">{p.specialty}</div>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2">{p.bio}</p>
      <div className="flex items-center gap-2 mt-auto">
        <div className="flex-1 h-1 bg-white/[0.05] rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${p.bgColor.replace("/10", "")} opacity-80`}
            style={{ width: `${Math.min(100, reputation * 80)}%` }}
          />
        </div>
        <span className="text-[9px] font-mono text-muted-foreground">REP {reputation.toFixed(2)}</span>
      </div>
    </div>
  );
}

function DebateAgentCard({
  token,
  symbol,
  upvotes,
  onUpvote,
  challengeResult,
  onChallenge,
}: {
  token: BeliefToken;
  symbol: string;
  upvotes: number;
  onUpvote: () => void;
  challengeResult?: ChallengeResult & { loading?: boolean };
  onChallenge: (text: string, prob: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showChallenge, setShowChallenge] = useState(false);
  const [challengeText, setChallengeText] = useState("");
  const p = PERSONAS[token.agentType] ?? PERSONAS["synthesis"];

  const displayProb = challengeResult?.newProbability ?? token.probability;
  const displayDir =
    displayProb > 0.54 ? "bullish" : displayProb < 0.46 ? "bearish" : "neutral";

  function submitChallenge() {
    if (!challengeText.trim()) return;
    onChallenge(challengeText, token.probability);
    setChallengeText("");
  }

  return (
    <div className={`rounded-xl border ${p.borderColor} bg-black/20 overflow-hidden`}>
      {/* Header — click to expand/collapse all rationale */}
      <div
        className="p-3.5 flex items-start gap-3 cursor-pointer select-none"
        onClick={() => setExpanded((o) => !o)}
        title="Click to expand full reasoning"
      >
        <span className="text-2xl leading-none mt-0.5">{p.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1.5">
            <div>
              <span className={`text-[12px] font-mono font-700 ${p.color}`}>{p.name}</span>
              <span className="text-[9px] font-mono text-muted-foreground ml-2">{p.specialty}</span>
            </div>
            <div className="flex items-center gap-1.5">
              {challengeResult && (
                <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${challengeResult.adjustment < 0 ? "bg-red-500/10 text-red-400" : challengeResult.adjustment > 0 ? "bg-emerald-500/10 text-emerald-400" : "bg-white/5 text-muted-foreground"}`}>
                  {challengeResult.adjustment >= 0 ? "+" : ""}{(challengeResult.adjustment * 100).toFixed(1)}%
                </span>
              )}
              <DirectionBadge dir={displayDir} prob={displayProb} />
            </div>
          </div>

          {/* Confidence bar */}
          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 h-1 bg-white/[0.05] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  displayDir === "bullish" ? "bg-emerald-500" : displayDir === "bearish" ? "bg-red-500" : "bg-amber-500"
                }`}
                style={{ width: `${token.confidence * 100}%`, boxShadow: displayDir === "bullish" ? "0 0 4px rgba(52,211,153,0.4)" : "none" }}
              />
            </div>
            <span className="text-[9px] font-mono text-muted-foreground shrink-0">
              CONF {(token.confidence * 100).toFixed(0)}%
            </span>
          </div>

          {/* SHAP factors */}
          <ShapFactors shapHive={token.shapHive} shapAi={token.shapAi} shapGeo={token.shapGeo} />
        </div>
      </div>

      {/* Rationale */}
      <div className="px-3.5 pb-1">
        <div className="space-y-1.5">
          {(expanded ? token.rationale : token.rationale.slice(0, 2)).map((r, i) => (
            <p key={i} className="text-[11px] text-muted-foreground leading-relaxed flex gap-1.5">
              <span className="text-primary/50 shrink-0 mt-0.5">›</span>
              {r}
            </p>
          ))}
        </div>
        {token.rationale.length > 2 && (
          <button
            className="text-[10px] font-mono text-muted-foreground/50 hover:text-muted-foreground mt-1.5 flex items-center gap-1"
            onClick={() => setExpanded((o) => !o)}
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? "Show less" : `+${token.rationale.length - 2} more`}
          </button>
        )}
      </div>

      {/* Challenge response */}
      {challengeResult?.response && (
        <div className="mx-3.5 mb-2 mt-1 bg-black/30 rounded-lg p-3 border border-white/[0.06]">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">{p.name} responds:</span>
          </div>
          <p className="text-[11px] text-white/80 leading-relaxed">{challengeResult.response}</p>
        </div>
      )}

      {/* Challenge input */}
      {showChallenge && (
        <div className="mx-3.5 mb-2 mt-1">
          <div className="flex gap-2 items-center bg-black/30 border border-white/10 rounded-lg px-3 py-2">
            <input
              type="text"
              className="flex-1 bg-transparent outline-none text-[12px] font-mono text-white placeholder:text-muted-foreground"
              placeholder="Challenge this agent… (e.g. 'Fed just raised rates 50bps')"
              value={challengeText}
              onChange={(e) => setChallengeText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitChallenge()}
              autoFocus
            />
            <button
              onClick={submitChallenge}
              disabled={!challengeText.trim() || challengeResult?.loading}
              className="text-primary hover:text-white disabled:opacity-40 transition-colors"
            >
              {challengeResult?.loading
                ? <div className="w-4 h-4 border border-current border-t-transparent rounded-full animate-spin" />
                : <Send className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-[9px] text-muted-foreground/50 font-mono mt-1 ml-1">
            Inject new information and see how the agent revises its probability.
          </p>
        </div>
      )}

      {/* Action bar */}
      <div className="px-3.5 py-2.5 border-t border-white/[0.05] flex items-center gap-3">
        <button
          onClick={onUpvote}
          className={`flex items-center gap-1.5 text-[10px] font-mono transition-colors ${
            upvotes > 0 ? "text-primary" : "text-muted-foreground hover:text-white"
          }`}
        >
          <ThumbsUp className="w-3.5 h-3.5" />
          Boost {upvotes > 0 ? `(${upvotes})` : ""}
        </button>
        <button
          onClick={() => setShowChallenge((o) => !o)}
          className={`flex items-center gap-1.5 text-[10px] font-mono transition-colors ${
            showChallenge ? "text-orange-400" : "text-muted-foreground hover:text-white"
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          {showChallenge ? "Cancel" : "Challenge"}
        </button>
        <div className="ml-auto text-[9px] font-mono text-muted-foreground/40">
          R{token.round} · {token.id.slice(0, 6)}
        </div>
      </div>
    </div>
  );
}

function HivemindGauge({ score }: { score: number }) {
  const color = score >= 65 ? "#34d399" : score >= 40 ? "#f59e0b" : "#f87171";
  const circ = 2 * Math.PI * 36;
  const dash = circ * (score / 100);
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
          style={{ filter: `drop-shadow(0 0 6px ${color}80)` }}
        />
        <text x="48" y="53" textAnchor="middle" fontSize="18" fontWeight="700" fill="white" fontFamily="JetBrains Mono">
          {score.toFixed(0)}
        </text>
      </svg>
      <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">HPL Score</span>
    </div>
  );
}

function ConvergenceChart({ tokens }: { tokens: BeliefToken[] }) {
  const data = buildConvergenceData(tokens);
  const agentTypes = [...new Set(tokens.map((t) => t.agentType))];

  const agentColors: Record<string, string> = {
    hive_polymarket: "#a855f7",
    hypothesis_momentum: "#60a5fa",
    hypothesis_meanrevert: "#22d3ee",
    hypothesis_volregime: "#818cf8",
    hypothesis_hive: "#8b5cf6",
    critique_devil: "#f97316",
    critique_tailrisk: "#f87171",
    synthesis: "#00d4ff",
    meta: "#fbbf24",
  };

  return (
    <Card className="bg-card/60 border-white/[0.07] backdrop-blur-sm">
      <CardContent className="p-4">
        <div className="data-label mb-1">Belief Convergence</div>
        <p className="text-[10px] text-muted-foreground/70 font-mono mb-3">
          Probability evolution across debate rounds — bold line = consensus
        </p>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
              <XAxis dataKey="label" stroke="#ffffff30" fontSize={9} fontFamily="JetBrains Mono" />
              <YAxis
                domain={[0, 1]}
                stroke="#ffffff30"
                fontSize={9}
                fontFamily="JetBrains Mono"
                tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                width={36}
              />
              <Tooltip
                contentStyle={{ background: "hsl(222,32%,8%)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, fontFamily: "JetBrains Mono", fontSize: 11 }}
                formatter={(v: number, name: string) => [`${(v * 100).toFixed(1)}%`, PERSONAS[name]?.name ?? name]}
                labelStyle={{ color: "#ffffff80", marginBottom: 4 }}
              />
              <ReferenceLine y={0.5} stroke="rgba(255,255,255,0.12)" strokeDasharray="4 4" />
              {agentTypes.map((type) => (
                <Line
                  key={type}
                  type="monotone"
                  dataKey={type}
                  stroke={agentColors[type] ?? "#ffffff30"}
                  strokeWidth={1}
                  strokeOpacity={0.3}
                  dot={false}
                  connectNulls
                  isAnimationActive={false}
                />
              ))}
              <Line
                type="monotone"
                dataKey="consensus"
                stroke="#00d4ff"
                strokeWidth={2.5}
                dot={{ fill: "#00d4ff", strokeWidth: 0, r: 3 }}
                connectNulls
                isAnimationActive
                style={{ filter: "drop-shadow(0 0 6px rgba(0,212,255,0.5))" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center gap-4 mt-2 justify-center">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-0.5 bg-primary" style={{ boxShadow: "0 0 4px rgba(0,212,255,0.6)" }} />
            <span className="text-[9px] font-mono text-muted-foreground">Consensus</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-0.5 bg-white/20" />
            <span className="text-[9px] font-mono text-muted-foreground">Individual agents</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-0.5 border-t border-dashed border-white/20" />
            <span className="text-[9px] font-mono text-muted-foreground">50% (neutral)</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DebatePhase({
  title,
  subtitle,
  tokens,
  symbol,
  upvotes,
  onUpvote,
  challenges,
  onChallenge,
}: {
  title: string;
  subtitle: string;
  tokens: BeliefToken[];
  symbol: string;
  upvotes: Record<string, number>;
  onUpvote: (type: string) => void;
  challenges: Record<string, ChallengeResult & { loading?: boolean }>;
  onChallenge: (agentType: string, text: string, prob: number) => void;
}) {
  if (tokens.length === 0) return null;
  return (
    <div>
      <div className="flex items-center gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
          </div>
          <div>
            <div className="text-[12px] font-display font-700 text-white">{title}</div>
            <div className="text-[9px] font-mono text-muted-foreground/70">{subtitle}</div>
          </div>
        </div>
        <div className="flex-1 h-px bg-white/[0.05]" />
      </div>
      <div className="space-y-3 pl-2 border-l border-white/[0.05] ml-2">
        {tokens.map((token) => (
          <DebateAgentCard
            key={token.id}
            token={token}
            symbol={symbol}
            upvotes={upvotes[token.agentType] ?? 0}
            onUpvote={() => onUpvote(token.agentType)}
            challengeResult={challenges[token.agentType]}
            onChallenge={(text, prob) => onChallenge(token.agentType, text, prob)}
          />
        ))}
      </div>
    </div>
  );
}

function DebateView({
  result,
  upvotes,
  onUpvote,
}: {
  result: LatticeResult;
  upvotes: Record<string, number>;
  onUpvote: (type: string) => void;
}) {
  const { results: challenges, challenge } = useChallengeAgent(result.symbol);

  const phases = [
    {
      title: "Phase 1 · Crowd Signal",
      subtitle: "Polymarket real-money consensus",
      types: ["hive_polymarket"],
    },
    {
      title: "Phase 2 · Hypothesis Formation",
      subtitle: "4 independent agents present their directional thesis",
      types: ["hypothesis_momentum", "hypothesis_meanrevert", "hypothesis_volregime", "hypothesis_hive"],
    },
    {
      title: "Phase 3 · Critique Round",
      subtitle: "Devil's advocate and tail-risk specialists challenge the consensus",
      types: ["critique_devil", "critique_tailrisk"],
    },
  ];

  const synthToken = result.tokens.find((t) => t.agentType === "synthesis");
  const metaToken = result.tokens.find((t) => t.agentType === "meta");
  const debateTokens = result.tokens.filter((t) => t.agentType !== "synthesis" && t.agentType !== "meta");

  const totalUpvotes = Object.values(upvotes).reduce((a, b) => a + b, 0);
  const upvoteBoost = Math.min(0.05, totalUpvotes * 0.005);
  const boostedConsensus = Math.min(1, result.agentConsensus + upvoteBoost);

  const dir = result.finalPrediction.direction;
  const dirColor = dir === "bullish" ? "text-emerald-400" : dir === "bearish" ? "text-red-400" : "text-amber-400";
  const dirBorder = dir === "bullish" ? "border-emerald-500/30 bg-emerald-500/5" : dir === "bearish" ? "border-red-500/30 bg-red-500/5" : "border-amber-500/30 bg-amber-500/5";

  return (
    <div className="space-y-6">
      {/* Final verdict hero */}
      <Card className={`border ${dirBorder} backdrop-blur-sm overflow-hidden`}>
        <div className={`h-0.5 w-full bg-gradient-to-r ${dir === "bullish" ? "from-emerald-500/60" : dir === "bearish" ? "from-red-500/60" : "from-amber-500/60"} to-transparent`} />
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-white/10 bg-white/[0.03] text-muted-foreground uppercase tracking-widest">
                  {result.regime} · {(result.regimeScore * 100).toFixed(0)}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground">
                  {(boostedConsensus * 100).toFixed(0)}% consensus
                  {totalUpvotes > 0 && <span className="text-primary ml-1">(+{totalUpvotes} boost)</span>}
                </span>
              </div>
              <div className={`font-display text-3xl font-800 ${dirColor}`}>
                {dir === "bullish" ? "↑" : dir === "bearish" ? "↓" : "→"} {dir.toUpperCase()}
              </div>
              <div className="space-y-1 text-[12px] font-mono">
                <div><span className="text-muted-foreground">Target </span><span className="text-white font-600">${result.finalPrediction.targetPrice.toFixed(2)}</span></div>
                <div><span className="text-muted-foreground">Confidence </span><span className="text-white font-600">{(result.finalPrediction.confidence * 100).toFixed(0)}%</span></div>
              </div>
            </div>
            <HivemindGauge score={result.finalPrediction.hivemindScore} />
          </div>
        </CardContent>
      </Card>

      {/* Convergence chart */}
      <ConvergenceChart tokens={result.tokens} />

      {/* Debate phases */}
      <div className="space-y-6">
        {phases.map((phase) => {
          const phaseTokens = debateTokens.filter((t) => phase.types.includes(t.agentType));
          return (
            <DebatePhase
              key={phase.title}
              title={phase.title}
              subtitle={phase.subtitle}
              tokens={phaseTokens}
              symbol={result.symbol}
              upvotes={upvotes}
              onUpvote={onUpvote}
              challenges={challenges}
              onChallenge={challenge}
            />
          );
        })}
      </div>

      {/* Synthesis + Meta system agents */}
      {(synthToken || metaToken) && (
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              </div>
              <div>
                <div className="text-[12px] font-display font-700 text-white">Phase 4 · Verdict</div>
                <div className="text-[9px] font-mono text-muted-foreground/70">Bayesian synthesis + regime-calibrated final call</div>
              </div>
            </div>
            <div className="flex-1 h-px bg-white/[0.05]" />
          </div>
          <div className="space-y-3 pl-2 border-l border-white/[0.05] ml-2">
            {[synthToken, metaToken].filter(Boolean).map((token) => (
              <DebateAgentCard
                key={token!.id}
                token={token!}
                symbol={result.symbol}
                upvotes={0}
                onUpvote={() => {}}
                challengeResult={undefined}
                onChallenge={() => {}}
              />
            ))}
          </div>
        </div>
      )}

      {/* SHAP Attribution */}
      <Card className="bg-card/60 border-white/[0.07] backdrop-blur-sm">
        <CardContent className="p-4 space-y-3">
          <div className="data-label mb-1">Signal Attribution (SHAP)</div>
          {[
            { label: "🐝 Crowd Intelligence (Polymarket)", val: result.shap.hive, color: "bg-purple-500" },
            { label: "🤖 AI Technical Ensemble", val: result.shap.ai, color: "bg-primary" },
            { label: "🌍 Geopolitical Risk", val: result.shap.geo, color: "bg-orange-500" },
          ].map((s) => (
            <div key={s.label} className="space-y-1.5">
              <div className="flex justify-between">
                <span className="text-[11px] text-muted-foreground">{s.label}</span>
                <span className="text-[11px] font-mono text-white">{(s.val * 100).toFixed(0)}%</span>
              </div>
              <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${s.color}`} style={{ width: `${s.val * 100}%` }} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Minority Report */}
      {result.minorityReport && (
        <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-4 flex gap-3">
          <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
          <div>
            <div className="text-[10px] font-semibold text-orange-400 mb-1.5 tracking-widest uppercase">Minority Report</div>
            <p className="text-[11px] text-orange-200/80 leading-relaxed">{result.minorityReport}</p>
          </div>
        </div>
      )}

      {/* Causal Narrative */}
      <Card className="bg-card/60 border-white/[0.07] backdrop-blur-sm">
        <CardContent className="p-4">
          <div className="data-label mb-3">Causal Narrative</div>
          <div className="space-y-1.5">
            {result.causalNarrative.split("\n").filter((l) => l.trim()).map((line, i) => (
              <p
                key={i}
                className={`text-[11px] leading-relaxed font-mono ${
                  line.startsWith("HPL") ? "text-primary font-medium" :
                  line.startsWith("Market Regime") || line.startsWith("Signal") || line.startsWith("Price Target")
                    ? "text-white/80 font-medium" : "text-muted-foreground"
                }`}
              >
                {line}
              </p>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── NL Search Bar ────────────────────────────────────────────────────────────
function NLSearchBar({
  onSearch,
}: {
  onSearch: (symbol: string, question: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [parsed, setParsed] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const sym = extractSymbolFromText(query);
    setParsed(sym);
  }, [query]);

  function handleSubmit() {
    const sym = parsed ?? query.trim().toUpperCase();
    if (!sym) return;
    onSearch(sym, query);
  }

  return (
    <div className="space-y-2">
      <div className="relative flex items-center bg-black/30 border border-primary/20 rounded-xl px-4 h-12 gap-3 focus-within:border-primary/50 focus-within:shadow-[0_0_0_1px_rgba(0,212,255,0.15)] transition-all">
        <Search className="w-4 h-4 text-primary shrink-0" />
        <input
          ref={inputRef}
          type="text"
          className="flex-1 bg-transparent outline-none text-sm text-white placeholder:text-muted-foreground font-mono"
          placeholder='Asset or question… e.g. "Will BTC hit $150k?", "NVDA AI momentum", "TSLA"'
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
        />
        {query && (
          <button onClick={() => { setQuery(""); setParsed(null); }} className="text-muted-foreground hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {query && (
        <div className="flex items-center gap-2 px-1">
          {parsed ? (
            <>
              <Sparkles className="w-3 h-3 text-primary" />
              <span className="text-[11px] font-mono text-muted-foreground">Detected symbol:</span>
              <span className="text-[11px] font-mono font-700 text-primary">{parsed}</span>
              <span className="text-[10px] font-mono text-muted-foreground/50">· Press Enter or Run to analyze</span>
            </>
          ) : (
            <>
              <span className="text-[11px] font-mono text-amber-400/70">No known symbol detected.</span>
              <span className="text-[10px] font-mono text-muted-foreground/50">The query will be used as the symbol directly.</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Lattice() {
  const [symbol, setSymbol] = useState("");
  const [question, setQuestion] = useState("");
  const [timeframe, setTimeframe] = useState("7d");
  const runLattice = useRunLattice();
  const { data: agents } = useGetLatticeAgents({ query: { queryKey: getGetLatticeAgentsQueryKey() } });
  const { data: prices } = useGetMarketPrices({ query: { queryKey: getGetMarketPricesQueryKey() } });

  const { agentUpvotes, upvoteAgent, resetUpvotes, setLastLatticeQuery } = useAppStore();

  const result = runLattice.data;
  const agentList = Array.isArray(agents) ? agents : [];
  const priceList = Array.isArray(prices) ? prices : [];

  function handleNLSearch(sym: string, q: string) {
    setSymbol(sym);
    setQuestion(q);
    setLastLatticeQuery(sym, q);
  }

  function handleRun() {
    if (!symbol) return;
    resetUpvotes();
    runLattice.mutate({ data: { symbol, timeframe } });
  }

  const DEBATE_AGENTS = ["hypothesis_momentum", "hypothesis_meanrevert", "hypothesis_volregime", "hypothesis_hive", "critique_devil", "critique_tailrisk"];
  const TIMEFRAMES = ["15m", "30m", "1h", "6h", "12h", "1d", "7d"];

  return (
    <div className="space-y-6 animate-fade-up">
      {/* Header */}
      <div>
        <h1 className="font-display text-[22px] font-700 text-white tracking-tight leading-none">
          Predictive Lattice
        </h1>
        <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1.5 font-mono">
          <Network className="w-3 h-3 text-primary" />
          HPL-HPA v2 · 6-agent debate engine · 4 rounds
        </p>
      </div>

      {/* NL Search */}
      <NLSearchBar onSearch={handleNLSearch} />

      {/* Question context display */}
      {question && question.length > 6 && (
        <div className="flex items-start gap-2.5 bg-primary/5 border border-primary/15 rounded-xl px-3.5 py-3">
          <Sparkles className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
          <div>
            <div className="text-[9px] font-mono text-primary/70 mb-0.5 tracking-widest uppercase">Question Context</div>
            <p className="text-[12px] text-white/80 font-mono">"{question}"</p>
          </div>
        </div>
      )}

      {/* Symbol + timeframe row */}
      <div className="flex gap-2">
        <TickerCombobox
          value={symbol}
          onChange={(sym) => setSymbol(sym)}
          options={priceList.map((p) => ({ symbol: p.symbol, name: p.name, price: p.price, type: p.type }))}
          placeholder="Any ticker… BTC, NVDA, MSFT, HOOD…"
          className="flex-1"
        />
        <Select value={timeframe} onValueChange={setTimeframe}>
          <SelectTrigger className="w-24 bg-black/30 border-white/10 h-9 text-sm font-mono">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIMEFRAMES.map((t) => (
              <SelectItem key={t} value={t} className="font-mono">{t.toUpperCase()}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Agent roster */}
      {!result && (
        <>
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <div className="data-label">6 Debate Agents</div>
              <div className="text-[9px] font-mono text-muted-foreground/50">reputation scores live</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {DEBATE_AGENTS.map((type) => {
                const agentState = agentList.find((a) => a.agentType === type);
                return (
                  <AgentRosterCard
                    key={type}
                    agentType={type}
                    reputation={agentState?.reputation ?? 1.0}
                  />
                );
              })}
            </div>
          </div>

          <div className="bg-black/20 border border-white/[0.06] rounded-xl p-3.5 text-[11px] font-mono text-muted-foreground leading-relaxed">
            <span className="text-primary font-600">How it works: </span>
            The Hive reads Polymarket crowd signals → 4 hypothesis agents form directional theses → 2 critique agents challenge the consensus → Bayesian synthesis → Meta-agent final verdict. You can challenge any agent mid-debate to inject new information.
          </div>
        </>
      )}

      {/* Run button */}
      <Button
        className="w-full gap-2 h-11 font-mono"
        onClick={handleRun}
        disabled={!symbol || runLattice.isPending}
      >
        {runLattice.isPending ? (
          <>
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            Running 6 agents · 4 debate rounds…
          </>
        ) : (
          <>
            <Zap className="w-4 h-4" />
            {result ? `Re-run HPL Lattice${symbol ? ` · ${symbol}` : ""}` : `Activate Lattice${symbol ? ` · ${symbol}` : ""}`}
          </>
        )}
      </Button>

      {/* Error state */}
      {runLattice.isError && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-[12px] text-red-400 font-mono">
          Lattice run failed. Check API server and try again.
        </div>
      )}

      {/* Results */}
      {result && (
        <DebateView
          result={result}
          upvotes={agentUpvotes}
          onUpvote={upvoteAgent}
        />
      )}

      {/* Agent reputation */}
      {agentList.length > 0 && (
        <Card className="bg-card/60 border-white/[0.07] backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-3.5 h-3.5 text-primary" />
              <div className="data-label">Agent Reputation Board</div>
            </div>
            <div className="space-y-2.5">
              {agentList.map((agent) => {
                const p = PERSONAS[agent.agentType];
                if (!p) return null;
                return (
                  <div key={agent.agentId} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-sm shrink-0">{p.emoji}</span>
                      <div className="min-w-0">
                        <span className={`text-[11px] font-mono ${p.color}`}>{p.name}</span>
                        <span className="text-[9px] text-muted-foreground/50 ml-1.5 font-mono">{p.specialty}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="w-16 h-1 bg-white/[0.05] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${p.bgColor}`}
                          style={{ width: `${Math.min(100, agent.reputation * 80)}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-mono text-white w-8 text-right">{agent.reputation.toFixed(2)}</span>
                      <span className="text-[10px] font-mono text-muted-foreground w-10 text-right">
                        {agent.totalRuns > 0 ? `${agent.correctRuns}/${agent.totalRuns}` : "—"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
