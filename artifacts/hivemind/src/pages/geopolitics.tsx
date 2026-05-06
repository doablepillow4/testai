import React, { useState, useMemo } from "react";
import { useGetPolymarketMarkets, getGetPolymarketMarketsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Globe, BarChart2, CalendarDays, Search } from "lucide-react";
import { format } from "date-fns";

export default function Geopolitics() {
  const { data: markets, isLoading } = useGetPolymarketMarkets(undefined, {
    query: { queryKey: getGetPolymarketMarketsQueryKey() },
  });
  const [activeTab, setActiveTab] = useState<string>("all");

  const marketList = Array.isArray(markets) ? markets : [];

  const categories = useMemo(() => {
    if (marketList.length === 0) return ["all"];
    const cats = new Set<string>();
    marketList.forEach((m) => { if (m.category) cats.add(m.category.toLowerCase()); });
    return ["all", ...Array.from(cats)].sort();
  }, [marketList]);

  const filteredMarkets = useMemo(() => {
    const filtered = activeTab === "all" ? marketList : marketList.filter((m) => m.category?.toLowerCase() === activeTab);
    return [...filtered].sort((a, b) => (b.volume || 0) - (a.volume || 0));
  }, [marketList, activeTab]);

  return (
    <div className="space-y-6 animate-fade-up">
      <div>
        <h1 className="font-display text-[22px] font-700 text-white tracking-tight leading-none">Geopolitics</h1>
        <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1.5 font-mono">
          <Globe className="w-3 h-3 text-primary" />
          Live odds from global prediction markets
        </p>
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4" style={{ scrollbarWidth: "none" }}>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveTab(cat)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-semibold tracking-widest uppercase transition-all duration-200 ${
              activeTab === cat
                ? "bg-primary text-primary-foreground shadow-[0_0_12px_rgba(0,212,255,0.4)]"
                : "bg-card/60 text-muted-foreground border border-white/[0.07] hover:border-white/20 hover:text-white"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="h-36 rounded-xl bg-card/40 border border-white/[0.05] animate-pulse" />
          ))}
        </div>
      ) : filteredMarkets.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-white/10 rounded-xl">
          <Search className="w-6 h-6 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-[12px] text-muted-foreground">No markets available.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredMarkets.map((market) => (
            <Card key={market.id} className="bg-card/60 border-white/[0.07] card-hover backdrop-blur-sm overflow-hidden">
              <CardContent className="p-4">
                <div className="flex justify-between items-start gap-3 mb-4">
                  <h3 className="font-semibold text-white text-[13px] leading-snug flex-1">{market.question}</h3>
                  {market.category && (
                    <span className="shrink-0 text-[9px] font-mono font-semibold px-2 py-1 rounded bg-white/5 text-muted-foreground uppercase tracking-widest border border-white/[0.06]">
                      {market.category}
                    </span>
                  )}
                </div>

                {/* YES/NO bars */}
                <div className="space-y-2 mb-4">
                  <div className="relative h-8 bg-white/[0.04] rounded-lg overflow-hidden border border-white/[0.04]">
                    <div
                      className="absolute left-0 top-0 bottom-0 bg-emerald-500/20 transition-all duration-500"
                      style={{ width: `${market.yesPrice * 100}%` }}
                    />
                    <div className="relative flex justify-between w-full h-full px-3 items-center z-10">
                      <span className="text-[11px] font-semibold font-mono text-emerald-400">YES</span>
                      <span className="text-[12px] font-mono font-600 text-white">{(market.yesPrice * 100).toFixed(1)}%</span>
                    </div>
                  </div>

                  <div className="relative h-8 bg-white/[0.04] rounded-lg overflow-hidden border border-white/[0.04]">
                    <div
                      className="absolute left-0 top-0 bottom-0 bg-red-500/20 transition-all duration-500"
                      style={{ width: `${market.noPrice * 100}%` }}
                    />
                    <div className="relative flex justify-between w-full h-full px-3 items-center z-10">
                      <span className="text-[11px] font-semibold font-mono text-red-400">NO</span>
                      <span className="text-[12px] font-mono font-600 text-white">{(market.noPrice * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-white/[0.05] pt-3">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
                    <BarChart2 className="w-3 h-3" />
                    <span>${(market.volume || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} vol</span>
                  </div>
                  {market.endDate && (
                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
                      <CalendarDays className="w-3 h-3" />
                      {format(new Date(market.endDate), "MMM d, yyyy")}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
