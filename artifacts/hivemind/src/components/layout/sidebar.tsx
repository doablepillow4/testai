import React from "react";
import { Link, useLocation } from "wouter";
import { Brain, LayoutDashboard, LineChart, Globe } from "lucide-react";

export function Sidebar() {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/simulator", label: "Event Simulator", icon: LineChart },
    { href: "/geopolitics", label: "Geopolitics", icon: Globe },
  ];

  return (
    <div className="w-64 bg-card border-r border-border h-full flex flex-col">
      <div className="p-6 flex items-center gap-3 border-b border-border">
        <Brain className="w-8 h-8 text-primary" />
        <h1 className="font-bold text-xl tracking-tight text-white">Hivemind</h1>
      </div>
      
      <div className="flex-1 py-6 px-4 flex flex-col gap-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">
          Intelligence
        </div>
        
        {navItems.map((item) => {
          const isActive = location === item.href;
          const Icon = item.icon;
          
          return (
            <Link 
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                isActive 
                  ? "bg-primary/10 text-primary" 
                  : "text-muted-foreground hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
      
      <div className="p-4 border-t border-border">
        <div className="bg-white/5 rounded-lg p-4">
          <div className="text-xs text-muted-foreground mb-1">System Status</div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
            <div className="text-sm font-mono text-white">Model Active</div>
          </div>
        </div>
      </div>
    </div>
  );
}
