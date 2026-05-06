import React from "react";
import { BottomNav } from "./sidebar";
import { Brain, Wifi } from "lucide-react";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-background/80 backdrop-blur-xl">
        <div className="px-5 py-3 flex items-center justify-between max-w-2xl mx-auto w-full">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className="absolute inset-0 rounded-lg bg-primary/20 blur-md" />
              <div className="relative w-7 h-7 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
                <Brain className="w-3.5 h-3.5 text-primary" />
              </div>
            </div>
            <span className="font-display font-700 text-[15px] tracking-tight text-white">
              Hivemind
            </span>
            <span className="text-[9px] font-mono font-medium text-primary/70 border border-primary/20 rounded px-1.5 py-0.5 bg-primary/5 tracking-widest">
              PRO
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-green-500/8 border border-green-500/20 rounded-full px-2.5 py-1">
              <Wifi className="w-3 h-3 text-green-400" />
              <span className="text-[10px] font-mono text-green-400 tracking-wider">LIVE</span>
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-24">
        <div className="px-4 py-6 max-w-2xl mx-auto">
          {children}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
