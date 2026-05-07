# Hivemind Predictor

A premium dark-themed predictive analytics platform combining live market data, AI-powered predictions, Monte Carlo event simulation with geopolitical intelligence, and a multi-agent reasoning engine (HPL-HPA v2/v3).

---

## Features

- **Live Market Dashboard** — Real-time stock and crypto price cards with sparklines, powered by Yahoo Finance and CoinGecko
- **Hivemind Predictive Lattice (HPL-HPA v2/v3)** — Multi-agent AI engine: 4 hypothesis agents, 2 critique rounds, Synthesis and Meta agents. Self-improving via Brier-score reputation updates. Optional v3 mode adds persistent belief-state tracking (delta, momentum, acceleration, stability)
- **Event Simulator** — Monte Carlo simulation (GBM + event shock) with geopolitical scenario presets (Black Swan, Taiwan Escalation, Iran Oil Shock, etc.) and live Polymarket geo-context
- **Geopolitics Intelligence** — Global Risk Barometer, Breaking Intelligence Feed merging news with live Polymarket prediction market odds and delta tracking
- **Dynamic Ticker Lookup** — Fetch a quote for any stock or crypto symbol on demand
- **Self-Improving Predictions** — Expired predictions auto-resolve against real prices; agent reputation updates each training cycle

---

## Tech Stack

| Layer           | Technology                                                          |
| --------------- | ------------------------------------------------------------------- |
| Runtime         | Node.js 20+, TypeScript 5.9                                         |
| Frontend        | React 19, Vite 7, Tailwind CSS v4, shadcn/ui, Recharts, Zustand     |
| Routing         | Wouter                                                              |
| API             | Express 5, Pino structured logging                                  |
| Database        | PostgreSQL + Drizzle ORM (push-based schema)                        |
| Validation      | Zod v4, drizzle-zod                                                 |
| API Contract    | OpenAPI 3.1 → Orval codegen (React Query hooks + Zod schemas)       |
| Package Manager | pnpm workspaces (monorepo)                                          |
| Build           | esbuild (API), Vite (frontend)                                      |
| Testing         | Vitest + React Testing Library (unit/component), Supertest (API e2e) |
| Code Quality    | ESLint (flat config), Prettier, Husky + lint-staged (pre-commit)    |

---

## Monorepo Structure

```
/
├── artifacts/
│   ├── api-server/          # Express API server
│   │   └── src/
│   │       ├── routes/      # predictions, market, simulator, lattice, polymarket, news, health
│   │       └── lib/
│   │           ├── lattice/ # HPL-HPA v2/v3 multi-agent engine (9 modules)
│   │           ├── http-error.ts      # Typed HTTP error class
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
git clone https://github.com/doablepillow4/testai.git
cd testai
pnpm install
```

### 2. Configure environment

Set `DATABASE_URL` (and optionally the individual `PG*` variables) to point at your Postgres instance:

```bash
export DATABASE_URL="postgresql://user:pass@localhost:5432/hivemind"
```

> On Replit, these are provisioned automatically — no manual setup needed.

### 3. Push the database schema

```bash
pnpm --filter @workspace/db run push
```

### 4. Run in development

Open two terminals (or use a process manager):

```bash
# Terminal 1 — API server (port 8080)
PORT=8080 pnpm --filter @workspace/api-server run dev

# Terminal 2 — Frontend (port 5173)
PORT=5173 BASE_PATH=/ pnpm --filter @workspace/hivemind run dev
```

The frontend proxies `/api` → `http://localhost:8080` automatically. Open `http://localhost:5173` in your browser.

---

## Key Commands

| Command                                         | Description                                    |
| ----------------------------------------------- | ---------------------------------------------- |
| `pnpm install`                                  | Install all workspace dependencies             |
| `PORT=8080 pnpm --filter @workspace/api-server run dev` | Start API server                       |
| `PORT=5173 BASE_PATH=/ pnpm --filter @workspace/hivemind run dev` | Start frontend dev server    |
| `pnpm run typecheck`                            | Full TypeScript check across all packages      |
| `pnpm run build`                                | Typecheck + build all packages                 |
| `pnpm --filter @workspace/db run push`          | Push Drizzle schema to the database            |
| `pnpm --filter @workspace/api-spec run codegen` | Regenerate API hooks from OpenAPI spec         |
| `pnpm test`                                     | Run all test suites                            |
| `pnpm --filter @workspace/api-server run test`  | Run API server tests only                      |
| `pnpm --filter @workspace/hivemind run test`    | Run frontend tests only                        |
| `pnpm --filter @workspace/api-server run test:coverage` | API tests with coverage report         |
| `pnpm run lint`                                 | ESLint across all packages                     |
| `pnpm run format`                               | Prettier format all files                      |

---

## Environment Variables

| Variable       | Required | Description                                                                         |
| -------------- | -------- | ----------------------------------------------------------------------------------- |
| `DATABASE_URL` | Yes      | PostgreSQL connection string, e.g. `postgresql://user:pass@localhost:5432/hivemind` |
| `PORT`         | Yes      | Port for each server (8080 for API, any port for frontend)                          |
| `BASE_PATH`    | Yes (frontend) | Base path for Vite (use `/` for root)                                       |
| `LOG_LEVEL`    | No       | Pino log level (`debug`, `info`, `warn`, `error`). Defaults to `info`               |

> External APIs (Yahoo Finance, CoinGecko, Polymarket) require no keys. All have graceful fallback data so the app works in offline/rate-limited conditions.

---

## API Reference

The full API contract lives in [`lib/api-spec/openapi.yaml`](lib/api-spec/openapi.yaml). Key endpoints:

| Method | Path                            | Description                             |
| ------ | ------------------------------- | --------------------------------------- |
| `GET`  | `/api/healthz`                  | Health check (includes DB status)       |
| `GET`  | `/api/market/prices`            | All tracked stock + crypto prices       |
| `GET`  | `/api/market/quote/:symbol`     | Live quote for any stock or crypto      |
| `GET`  | `/api/market/history/:symbol`   | Historical price data                   |
| `GET`  | `/api/predictions`              | Stored predictions                      |
| `GET`  | `/api/predictions/summary`      | Model accuracy summary                  |
| `POST` | `/api/predictions`              | Generate a new AI prediction            |
| `POST` | `/api/simulator/monte-carlo`    | Run a Monte Carlo simulation            |
| `GET`  | `/api/polymarket/markets`       | Polymarket prediction market data       |
| `GET`  | `/api/news`                     | News feed with Polymarket odds matched  |
| `POST` | `/api/lattice/run`              | Run HPL-HPA v2/v3 multi-agent engine    |
| `POST` | `/api/lattice/challenge`        | Challenge an agent with new information |
| `GET`  | `/api/lattice/agents`           | Agent reputation scores                 |
| `GET`  | `/api/lattice/regime`           | Current market regime                   |
| `POST` | `/api/lattice/train`            | Run a Brier-score training cycle        |
| `GET`  | `/api/lattice/belief-history/:symbol` | v3 conviction history per symbol  |

---

## Architecture Notes

- **Contract-first**: The OpenAPI spec is the single source of truth. Never write API hooks by hand — always modify `openapi.yaml` then run `pnpm --filter @workspace/api-spec run codegen`.
- **Orval codegen** uses `mode: "single"` for Zod schemas to avoid naming conflicts with TypeScript types.
- **Polymarket odds delta**: Tracked in-memory on the server (5-minute staleness). `oddsShift` = current `yesPrice` minus last cached value.
- **Agent reputation**: Persists to the `agent_states` DB table across sessions. The HPL engine is stateless per-run, reputation-weighted per token.
- **Fallback data**: All three external APIs (Yahoo Finance, CoinGecko, Polymarket) have fallback responses — the app degrades gracefully on network failure.
- **Typed HTTP errors**: `HttpError` class (in `lib/http-error.ts`) provides status-code-aware error propagation through Express middleware.
- **Structured logging**: Pino logger with per-phase lattice logging (market load → regime → hypothesis round → critique round → synthesis → meta → belief dynamics). Set `LOG_LEVEL=debug` for full agent-debate traces.

---

## Testing

```bash
# Run all tests
pnpm test

# Watch mode (re-runs on file changes)
pnpm --filter @workspace/api-server run test:watch
pnpm --filter @workspace/hivemind run test:watch

# Coverage report
pnpm --filter @workspace/api-server run test:coverage
pnpm --filter @workspace/hivemind run test:coverage
```

Test suites:
- **API server** (`artifacts/api-server/src/**/*.test.ts`): math functions (RSI, MACD, Bollinger %B), synthesis agent, hypothesis agents, meta agent, Monte Carlo simulator, market/news/predictions/health routes
- **Frontend** (`artifacts/hivemind/src/**/*.test.{ts,tsx}`): error boundary component

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on reporting issues, proposing features, and submitting pull requests.

---

## License

MIT — see [LICENSE](LICENSE) for details.
