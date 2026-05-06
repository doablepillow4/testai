# Hivemind Predictor

A premium dark-themed predictive analytics platform combining live market data, AI-powered predictions, Monte Carlo event simulation with geopolitical intelligence, and a multi-agent reasoning engine (HPL-HPA v2).

---

## Features

- **Live Market Dashboard** — Real-time stock and crypto price cards with sparklines, powered by Yahoo Finance and CoinGecko
- **Hivemind Predictive Lattice (HPL-HPA v2)** — Multi-agent AI engine: 4 hypothesis agents, 2 critique rounds, Synthesis and Meta agents. Self-improving via Brier-score reputation updates
- **Event Simulator** — Monte Carlo simulation (GBM + event shock) with geopolitical scenario presets (Black Swan, Taiwan Escalation, Iran Oil Shock, etc.) and live Polymarket geo-context
- **Geopolitics Intelligence** — Global Risk Barometer, Breaking Intelligence Feed merging news with live Polymarket prediction market odds and delta tracking
- **Dynamic Ticker Lookup** — Fetch a quote for any stock or crypto symbol on demand
- **Self-Improving Predictions** — Expired predictions auto-resolve against real prices; agent reputation updates each training cycle

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 24, TypeScript 5.9 |
| Frontend | React 19, Vite 7, Tailwind CSS v4, shadcn/ui, Recharts, Zustand |
| Routing | Wouter |
| API | Express 5, Pino logging |
| Database | PostgreSQL + Drizzle ORM |
| Validation | Zod v4, drizzle-zod |
| API Contract | OpenAPI 3.1 → Orval codegen (React Query hooks + Zod schemas) |
| Package Manager | pnpm workspaces |
| Build | esbuild (API), Vite (frontend) |

---

## Monorepo Structure

```
/
├── artifacts/
│   ├── api-server/          # Express API server
│   │   └── src/
│   │       ├── routes/      # predictions, market, simulator, lattice, polymarket
│   │       └── lib/
│   │           ├── lattice/ # HPL-HPA v2 multi-agent engine (9 modules)
│   │           ├── market-data.ts
│   │           ├── predictions-engine.ts
│   │           └── polymarket-cache.ts
│   └── hivemind/            # React + Vite frontend
│       └── src/
│           ├── pages/       # Dashboard, Lattice, Simulator, Geopolitics
│           ├── components/  # shadcn/ui + custom components
│           └── store/       # Zustand app store
├── lib/
│   ├── api-spec/            # OpenAPI 3.1 spec (source of truth)
│   ├── api-client-react/    # Orval-generated React Query hooks
│   ├── api-zod/             # Orval-generated Zod schemas
│   └── db/                  # Drizzle ORM schema + client
└── scripts/                 # Workspace-level scripts
```

---

## Getting Started

### Prerequisites

- **Node.js** v20+ (v24 recommended)
- **pnpm** v10+ — [install here](https://pnpm.io/installation)
- **PostgreSQL** — local instance or connection string

### 1. Clone and install

```bash
git clone https://github.com/your-org/hivemind-predictor.git
cd hivemind-predictor
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env and set DATABASE_URL to your Postgres connection string
```

### 3. Push the database schema

```bash
pnpm --filter @workspace/db run push
```

### 4. Run in development

Open two terminals (or use a process manager):

```bash
# Terminal 1 — API server (port 8080)
pnpm --filter @workspace/api-server run dev

# Terminal 2 — Frontend (port 5173 by default)
pnpm --filter @workspace/hivemind run dev
```

The frontend expects the API at `http://localhost:8080`. Open `http://localhost:5173` in your browser.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string, e.g. `postgresql://user:pass@localhost:5432/hivemind` |

See `.env.example` for a template.

> External APIs (Yahoo Finance, CoinGecko, Polymarket) are called directly with no key required. All have fallback data on failure so the app remains usable in offline/rate-limited conditions.

---

## Key Commands

| Command | Description |
|---|---|
| `pnpm install` | Install all workspace dependencies |
| `pnpm --filter @workspace/api-server run dev` | Start API server (port 8080) |
| `pnpm --filter @workspace/hivemind run dev` | Start frontend dev server |
| `pnpm run typecheck` | Full TypeScript check across all packages |
| `pnpm run build` | Typecheck + build all packages |
| `pnpm --filter @workspace/db run push` | Push Drizzle schema to the database |
| `pnpm --filter @workspace/api-spec run codegen` | Regenerate API hooks from OpenAPI spec |

---

## API Reference

The full API contract lives in [`lib/api-spec/openapi.yaml`](lib/api-spec/openapi.yaml). Key endpoints:

| Method | Path | Description |
|---|---|---|
| `GET` | `/healthz` | Health check |
| `GET` | `/market/prices` | All tracked stock + crypto prices |
| `GET` | `/market/quote/:symbol` | Live quote for any stock or crypto |
| `GET` | `/market/history/:symbol` | Historical price data |
| `GET` | `/predictions` | Stored predictions |
| `GET` | `/predictions/summary` | Model accuracy summary |
| `POST` | `/predictions` | Generate a new AI prediction |
| `POST` | `/simulator/monte-carlo` | Run a Monte Carlo simulation |
| `GET` | `/polymarket/markets` | Polymarket prediction market data |
| `GET` | `/news` | News feed with Polymarket odds matched |
| `POST` | `/lattice/run` | Run the HPL-HPA v2 multi-agent engine |
| `POST` | `/lattice/challenge` | Challenge an agent with new information |
| `GET` | `/lattice/agents` | Agent reputation scores |
| `GET` | `/lattice/regime` | Current market regime |
| `POST` | `/lattice/train` | Run a Brier-score training cycle |

---

## Architecture Notes

- **Contract-first**: The OpenAPI spec is the single source of truth. Never write API hooks by hand — always modify `openapi.yaml` then run codegen.
- **Orval codegen** uses `mode: "single"` for Zod schemas to avoid naming conflicts with TypeScript types.
- **Polymarket odds delta**: Tracked in-memory on the server (5-minute staleness). `oddsShift` = current `yesPrice` minus last cached value.
- **Agent reputation**: Persists to the `agent_states` DB table across sessions. The HPL engine is stateless per-run.
- **Fallback data**: All three external APIs (Yahoo Finance, CoinGecko, Polymarket) have fallback responses — the app degrades gracefully on network failure.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on reporting issues, proposing features, and submitting pull requests.

---

## License

MIT — see [LICENSE](LICENSE) for details.
