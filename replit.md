# Hivemind

A market intelligence dashboard that aggregates real-time financial data, geopolitical news, and AI-powered multi-agent predictions (the "Lattice") for crypto and equity assets.

## Run & Operate

| Command                                       | What it does                                      |
| --------------------------------------------- | ------------------------------------------------- |
| `pnpm install`                                | Install all workspace dependencies                |
| `pnpm --filter @workspace/db run push`        | Apply DB schema to Postgres                       |
| `pnpm --filter @workspace/api-server run dev` | Build + start API server (PORT required)          |
| `pnpm --filter @workspace/hivemind run dev`   | Start Vite dev server (PORT + BASE_PATH required) |

**Required env vars:** `DATABASE_URL`, `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` (all set by Replit DB provisioning — no extra keys needed)

**Workflows:**

- `API Server` → `PORT=8080 pnpm --filter @workspace/api-server run dev` (waitForPort 8080)
- `Start application` → `PORT=22203 BASE_PATH=/ pnpm --filter @workspace/hivemind run dev` (waitForPort 22203)

## Stack

- **Backend:** Node 20, Express 5, Drizzle ORM, PostgreSQL (`pg`), Pino logging
- **Frontend:** React 19, Vite 7, Tailwind CSS v4, Radix UI, TanStack Query, Wouter, Recharts, Framer Motion, Zustand
- **Shared libs:** `@workspace/api-zod` (Zod schemas), `@workspace/api-client-react` (typed React Query hooks), `@workspace/db` (Drizzle client + schema)
- **Code gen:** OpenAPI spec → Orval → typed client

## Where things live

```
artifacts/
  api-server/   Express backend
  hivemind/     React SPA (main UI)
  mockup-sandbox/ Component preview server
lib/
  api-spec/     openapi.yaml + orval.config.ts
  api-zod/      Zod schemas (generated)
  api-client-react/ React Query hooks
  db/           Drizzle schema + client, drizzle.config.ts
scripts/        post-merge.sh (runs pnpm install + db push)
```

- DB schema: `lib/db/src/schema/` (`predictions.ts`, `lattice.ts`)
- API routes: `artifacts/api-server/src/routes/`
- Frontend pages: `artifacts/hivemind/src/`

## Architecture decisions

- **pnpm monorepo** with workspace references — all packages share a single lockfile and catalog for version pinning
- **API proxy via Vite dev server** — frontend proxies `/api` → `http://localhost:8080` so no CORS issues in dev
- **Public APIs only** — market data (CoinGecko, Yahoo Finance), news (RSS feeds), and Polymarket are all public; no API keys required
- **Drizzle push (not migrations)** — schema changes are applied via `drizzle-kit push` rather than migration files
- **Typed HTTP errors** — `HttpError` class (`lib/http-error.ts`) with static helpers; Express error handler returns status-aware JSON
- **Background scheduler** — `lib/scheduler.ts` runs `runTrainingCycle()` every 15 min (configurable via `SCHEDULER_INTERVAL_MS`); also called directly by `POST /lattice/train`. Starts on server boot, stops cleanly on SIGTERM/SIGINT

## Product

- **Dashboard** — live crypto + equity prices with sparklines, geopolitical news feed, Polymarket prediction markets
- **Lattice** — multi-agent debate engine that generates buy/sell/hold predictions with confidence scores, SHAP attribution, and causal narratives
- **HPL-HPA v3** — persistent belief state machine (opt-in via `useV3: true`); tracks delta, momentum, acceleration, and stability across runs per symbol; stored in `belief_states` (latest) + `belief_history` (append-only log)
- **Simulator** — portfolio scenario simulation tool
- **Geopolitics** — emerging threat radar (auto-classifies and ranks breaking news by emergence score), long-term market impact analysis per threat (pandemic, conflict, nuclear, energy, financial, cyber, climate, supply chain), Polymarket odds matched to news with expanded keyword taxonomy (including health/pandemic), Global Risk Barometer with pandemic signal indicator
- **Auto-resolution** — expired predictions are resolved against real prices on a 15-minute schedule; agent Brier scores and reputation update automatically

### Key API endpoints

| Method | Path                                  | Notes                                                                  |
| ------ | ------------------------------------- | ---------------------------------------------------------------------- |
| `POST` | `/api/lattice/run`                    | `{ symbol, timeframe, useV3? }` — v3 adds `beliefDynamics` to response |
| `POST` | `/api/lattice/train`                  | Manually trigger a training cycle (same logic as the scheduler)        |
| `GET`  | `/api/lattice/belief-history/:symbol` | `?limit=N` (default 50, max 200) — chronological conviction history    |
| `GET`  | `/api/healthz`                        | Returns `{ status, db, uptime, timestamp, scheduler }`                 |
| `POST` | `/api/geo-impact`                     | `{ headline, description?, isBreaking? }` — returns full `ThreatClassification` (type, severity, lockdownRisk, economicDisruptionRisk, marketImpactScore, timeHorizon, affectedTickers, narrative) |

## User preferences

_Populate as you build_

## Gotchas

- `vite.config.ts` requires both `PORT` and `BASE_PATH` env vars at startup — missing either throws immediately
- `api-server/src/index.ts` requires `PORT` env var — missing it throws immediately
- The mockup-sandbox is a separate Vite app for component previewing; it is not part of the main app
- `minimumReleaseAge: 1440` in pnpm-workspace.yaml blocks packages < 1 day old (except `@replit/*`)
- Scheduler uses `timer.unref()` so it never prevents the process from exiting; set `SCHEDULER_INTERVAL_MS` (ms) to override the 15-minute default

## Pointers

- Database skill: `.local/skills/database/SKILL.md`
- React+Vite skill: `.local/skills/react-vite/SKILL.md`
- Workflows skill: `.local/skills/workflows/SKILL.md`
