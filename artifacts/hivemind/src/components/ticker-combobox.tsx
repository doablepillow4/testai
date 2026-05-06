import React, { useState, useRef, useEffect } from "react";
import { Search, X, ChevronDown } from "lucide-react";

export interface TickerOption {
  symbol: string;
  name: string;
  price: number;
  type: string;
}

interface TickerComboboxProps {
  value: string;
  onChange: (symbol: string, price?: number) => void;
  options: TickerOption[];
  placeholder?: string;
  className?: string;
}

const CRYPTO_ALIASES: Record<string, string> = {
  BITCOIN: "BTC", BTC: "BTC",
  ETHEREUM: "ETH", ETHER: "ETH", ETH: "ETH",
  SOLANA: "SOL", SOL: "SOL",
  CARDANO: "ADA", ADA: "ADA",
  RIPPLE: "XRP", XRP: "XRP",
  DOGECOIN: "DOGE", DOGE: "DOGE",
  AVALANCHE: "AVAX", AVAX: "AVAX",
  POLKADOT: "DOT", DOT: "DOT",
  CHAINLINK: "LINK", LINK: "LINK",
  POLYGON: "MATIC", MATIC: "MATIC",
  UNISWAP: "UNI", UNI: "UNI",
  LITECOIN: "LTC", LTC: "LTC",
  SHIBA: "SHIB", SHIBAINU: "SHIB", SHIB: "SHIB",
  BINANCE: "BNB", BNB: "BNB",
  NEAR: "NEAR",
  ATOM: "ATOM", COSMOS: "ATOM",
  STELLAR: "XLM", XLM: "XLM",
  APTOS: "APT", APT: "APT",
  ARBITRUM: "ARB", ARB: "ARB",
  OPTIMISM: "OP", OP: "OP",
  TON: "TON",
  PEPE: "PEPE",
  WORLDCOIN: "WLD", WLD: "WLD",
};

function resolveAlias(query: string): string | null {
  const up = query.trim().toUpperCase().replace(/\s+/g, "");
  return CRYPTO_ALIASES[up] ?? null;
}

export function TickerCombobox({
  value,
  onChange,
  options,
  placeholder = "Any ticker or name… BTC, ADA, NVDA, TSLA",
  className = "",
}: TickerComboboxProps) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!value) setQuery("");
    else setQuery(value);
  }, [value]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const q = query.trim().toUpperCase();
  const aliasResolved = q ? resolveAlias(q) : null;

  const filtered = q
    ? options.filter(
        (o) =>
          o.symbol.includes(q) ||
          o.name.toUpperCase().includes(q) ||
          (aliasResolved && o.symbol === aliasResolved)
      )
    : options;

  const exactMatch = options.find((o) => o.symbol === q || (aliasResolved && o.symbol === aliasResolved));
  const customSymbol = aliasResolved ?? q;
  const isCustom = q.length > 0 && !exactMatch;

  function select(symbol: string, price?: number) {
    setQuery(symbol);
    setOpen(false);
    onChange(symbol, price);
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation();
    setQuery("");
    onChange("", undefined);
    inputRef.current?.focus();
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div
        className={`flex items-center gap-2 bg-black/30 border rounded-lg px-3 h-10 transition-colors cursor-text ${
          open
            ? "border-primary/50 shadow-[0_0_0_1px_rgba(0,212,255,0.15)]"
            : "border-white/10 hover:border-white/20"
        }`}
        onClick={() => { setOpen(true); inputRef.current?.focus(); }}
      >
        <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        <input
          ref={inputRef}
          type="text"
          className="flex-1 bg-transparent outline-none text-sm font-mono text-white placeholder:text-muted-foreground min-w-0"
          placeholder={placeholder}
          value={query}
          onChange={(e) => { setQuery(e.target.value.toUpperCase()); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") { setOpen(false); }
            if (e.key === "Enter") {
              if (aliasResolved) {
                const match = options.find((o) => o.symbol === aliasResolved);
                select(aliasResolved, match?.price);
              } else if (filtered.length > 0) {
                select(filtered[0].symbol, filtered[0].price);
              } else if (q.length > 0) {
                select(q);
              }
            }
          }}
        />
        {query ? (
          <button onClick={clear} className="text-muted-foreground hover:text-white transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        )}
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1.5 z-50 bg-[hsl(222,32%,8%)] border border-white/10 rounded-xl shadow-2xl overflow-hidden max-h-64 overflow-y-auto">
          {/* Custom/alias option always first when typed */}
          {isCustom && (
            <div className="border-b border-white/[0.06]">
              <button
                className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-primary/10 transition-colors text-left"
                onMouseDown={(e) => {
                  e.preventDefault();
                  const match = options.find((o) => o.symbol === customSymbol);
                  select(customSymbol, match?.price);
                }}
              >
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-primary/30 text-primary bg-primary/5">
                  {aliasResolved ? "ALIAS" : "CUSTOM"}
                </span>
                <span className="text-sm font-mono text-white font-semibold">{customSymbol}</span>
                {aliasResolved && q !== aliasResolved && (
                  <span className="text-[10px] text-muted-foreground font-mono">← {q}</span>
                )}
                <span className="text-[10px] text-muted-foreground ml-auto">Press Enter ↵</span>
              </button>
            </div>
          )}

          {filtered.length > 0 ? (
            filtered.map((opt) => (
              <button
                key={opt.symbol}
                className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-white/[0.05] transition-colors text-left"
                onMouseDown={(e) => { e.preventDefault(); select(opt.symbol, opt.price); }}
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-white/10 text-muted-foreground bg-white/[0.03]">
                    {opt.type === "crypto" ? "CRYPTO" : "STOCK"}
                  </span>
                  <div>
                    <div className="text-sm font-mono font-600 text-white">{opt.symbol}</div>
                    <div className="text-[10px] text-muted-foreground">{opt.name}</div>
                  </div>
                </div>
                <div className="text-[11px] font-mono text-primary">
                  ${opt.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </button>
            ))
          ) : q.length === 0 ? (
            <div className="px-3 py-3 text-center text-[11px] text-muted-foreground">Start typing to search</div>
          ) : !isCustom ? (
            <div className="px-3 py-3 text-center text-[11px] text-muted-foreground">No matches found</div>
          ) : null}
        </div>
      )}
    </div>
  );
}
