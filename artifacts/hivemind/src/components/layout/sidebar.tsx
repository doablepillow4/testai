import React from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, LineChart, Telescope, Network } from "lucide-react";

const navItems = [
  { href: "/", label: "Markets", icon: LayoutDashboard },
  { href: "/lattice", label: "Lattice", icon: Network },
  { href: "/simulator", label: "Simulator", icon: LineChart },
  { href: "/intelligence", label: "Intel", icon: Telescope },
];

export function BottomNav() {
  const [location] = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/[0.06] bg-background/90 backdrop-blur-xl">
      <div className="flex max-w-2xl mx-auto">
        {navItems.map((item) => {
          const isActive = location === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 transition-all duration-200 relative ${
                isActive ? "text-primary" : "text-muted-foreground hover:text-white/70"
              }`}
            >
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2px] rounded-b-full bg-primary shadow-[0_0_8px_rgba(0,212,255,0.8)]" />
              )}
              <div
                className={`relative p-1.5 rounded-lg transition-all duration-200 ${isActive ? "bg-primary/10" : ""}`}
              >
                {isActive && <span className="absolute inset-0 rounded-lg bg-primary/10 blur-sm" />}
                <Icon className="relative w-[18px] h-[18px]" />
              </div>
              <span
                className={`text-[9px] font-semibold tracking-widest uppercase transition-colors ${isActive ? "text-primary" : "text-muted-foreground"}`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
