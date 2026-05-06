import React, { useState, useMemo } from "react";
import { useGetPolymarketMarkets, getGetPolymarketMarketsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Globe, BarChart2, CalendarDays } from "lucide-react";
import { format } from "date-fns";

export default function Geopolitics() {
  const { data: markets, isLoading } = useGetPolymarketMarkets(undefined, { query: { queryKey: getGetPolymarketMarketsQueryKey() } });
  const [activeTab, setActiveTab] = useState<string>("all");

  const categories = useMemo(() => {
    if (!markets) return ["all"];
    const cats = new Set<string>();
    markets.forEach(m => {
      if (m.category) cats.add(m.category.toLowerCase());
    });
    return ["all", ...Array.from(cats)].sort();
  }, [markets]);

  const filteredMarkets = useMemo(() => {
    if (!markets) return [];
    let filtered = markets;
    if (activeTab !== "all") {
      filtered = markets.filter(m => m.category?.toLowerCase() === activeTab);
    }
    return filtered.sort((a, b) => (b.volume || 0) - (a.volume || 0));
  }, [markets, activeTab]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight">Geopolitics & Prediction Markets</h1>
        <p className="text-muted-foreground mt-1 flex items-center gap-2">
          <Globe className="w-4 h-4 text-primary" />
          Live probability odds from global prediction markets
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveTab(cat)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              activeTab === cat 
                ? "bg-primary text-primary-foreground" 
                : "bg-card/50 text-muted-foreground hover:text-white hover:bg-card border border-white/5"
            }`}
          >
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>

      {/* Markets Grid */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredMarkets.map(market => (
            <Card key={market.id} className="bg-card/30 border-white/5 hover:border-primary/30 transition-colors flex flex-col">
              <CardContent className="p-6 flex flex-col flex-1">
                <div className="flex justify-between items-start mb-4 gap-4">
                  <h3 className="font-semibold text-white leading-snug">
                    {market.question}
                  </h3>
                  {market.category && (
                    <span className="text-[10px] px-2 py-1 rounded bg-white/5 text-muted-foreground uppercase tracking-wider shrink-0">
                      {market.category}
                    </span>
                  )}
                </div>

                <div className="mt-auto space-y-4">
                  {/* Probability Bars */}
                  <div className="space-y-3">
                    <div className="relative h-10 bg-white/5 rounded-md overflow-hidden flex items-center group">
                      <div 
                        className="absolute left-0 top-0 bottom-0 bg-green-500/20 group-hover:bg-green-500/30 transition-colors" 
                        style={{ width: `${market.yesPrice * 100}%` }}
                      />
                      <div className="relative flex justify-between w-full px-3 z-10">
                        <span className="font-bold text-green-400">YES</span>
                        <span className="font-mono text-white">{(market.yesPrice * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                    
                    <div className="relative h-10 bg-white/5 rounded-md overflow-hidden flex items-center group">
                      <div 
                        className="absolute left-0 top-0 bottom-0 bg-red-500/20 group-hover:bg-red-500/30 transition-colors" 
                        style={{ width: `${market.noPrice * 100}%` }}
                      />
                      <div className="relative flex justify-between w-full px-3 z-10">
                        <span className="font-bold text-red-400">NO</span>
                        <span className="font-mono text-white">{(market.noPrice * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-4 border-t border-white/5">
                    <div className="flex items-center gap-1.5">
                      <BarChart2 className="w-3.5 h-3.5" />
                      ${(market.volume || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                    {market.endDate && (
                      <div className="flex items-center gap-1.5">
                        <CalendarDays className="w-3.5 h-3.5" />
                        {format(new Date(market.endDate), "MMM d, yyyy")}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
