# Hivemind Predictor

A premium dark-themed predictive analytics web app with live market prices, AI confidence-scored predictions, Monte Carlo event simulation with geo intelligence, Polymarket prediction market feeds with odds delta tracking, and the Hivemind Predictive Lattice (HPL-HPA v2) multi-agent AI engine.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/hivemind run dev` — run the React frontend (dev)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19 + Vite 7, Wouter routing, Recharts, shadcn/ui, Tailwind CSS, date-fns
- API: Express 5 + Pino logging
- DB: PostgreSQL + Drizzle ORM (`lib/db`)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec → React Query hooks + Zod schemas)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/db/src/schema/predictions.ts` — predictions DB schema
- `lib/db/src/schema/lattice.ts` — HPL DB schema (lattice_runs, agent_states)
- `lib/api-spec/openapi.yaml` — OpenAPI contract (source of truth for routes)
- `lib/api-client-react/src/generated/` — Orval-generated React Query hooks + types
- `lib/api-zod/src/generated/` — Orval-generated Zod validation schemas
- `artifacts/api-server/src/routes/` — Express route handlers (lattice.ts, predictions.ts, market.ts, simulator.ts, polymarket.ts)
- `artifacts/api-server/src/lib/lattice/` — full HPL engine (9 files)
- `artifacts/api-server/src/lib/polymarket-cache.ts` — in-memory odds delta tracking + geo market matching
- `artifacts/hivemind/src/pages/` — Dashboard, Lattice, Simulator, Geopolitics pages

## Architecture decisions

- Contract-first: OpenAPI spec → Orval codegen → React Query hooks + Zod schemas (never write hooks by hand)
- Orval zod config uses `mode: "single"` to avoid naming conflicts between Zod schemas and TypeScript types
- All external API calls (Yahoo Finance, CoinGecko, Polymarket) have fallback data on failure
- Self-improving prediction loop: expired predictions are auto-resolved against real prices; past accuracy boosts future confidence scores; `/lattice/train` runs a full Brier-score agent reputation update cycle
- `isNull()` (not `eq(col, null)`) for Drizzle NULL checks — TS enforces this
- HPL engine is stateless per-run; agent reputation persists to `agent_states` table
- Polymarket odds delta tracking: in-memory Map on server, staleness = 5 min; `oddsShift` = current minus last cached yesPrice
- Dynamic ticker lookup: `/market/quote/:symbol` fetches any stock via Yahoo Finance or any known crypto via CoinGecko

## Product

- **Dashboard**: Live price cards (stocks + crypto) with sparklines, Hivemind model accuracy stats, latest predictions with confidence bars and signal breakdowns, one-click "Predict" for any symbol
- **Lattice (HPL-HPA v2)**: Multi-agent AI engine — 4 hypothesis agents + 2 critique rounds + Synthesis + Meta. Polymarket intel feed inline (geo context). Training button triggers self-improvement cycle with agent Brier-score updates. Challenge any agent to inject new information.
- **Event Simulator**: Monte Carlo simulation (GBM + event shock). Market + Geopolitical scenario presets (Black Swan, Taiwan Escalation, Iran Oil Shock, etc.). Dynamic ticker lookup for any symbol. Live Polymarket geo context panel showing relevant markets and odds deltas. Full risk metrics: VaR95, max drawdown, expected return.
- **Geopolitics**: Global Risk Barometer (aggregated from conflict markets). Breaking Intelligence Feed: news items automatically matched with related Polymarket odds and displayed together. Region/category filters, odds delta tracking (↑/↓ arrows showing movement since last fetch).

## User preferences

- Repo-friendly: README.md, CONTRIBUTING.md, LICENSE (MIT), .env.example, .github/ templates all present

## Gotchas

- Yahoo Finance sometimes returns `null` for `previousClose` — sanitize with `isNaN` guard before Zod validation
- Never run `pnpm dev` at workspace root — use workflow restart or individual filters
- Always run `pnpm --filter @workspace/api-spec run codegen` after changing `openapi.yaml`
- Always run `pnpm run typecheck:libs` after changing any `lib/*` package
- `nanoid` is a dependency of `@workspace/api-server` (used in lattice token generation)
- CoinGecko rate-limits (429) are expected in dev — fallback data is used automatically
- `var95`, `maxDrawdown`, `expectedReturn` in MonteCarloResult were previously Zod-stripped (missing from schema) — now fixed

## Pointers

- See `.local/skills/pnpm-workspace` for workspace structure, TypeScript setup, and package details
- See `.local/skills/react-vite` for Vite + React conventions
