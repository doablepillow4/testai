# Contributing to Hivemind Predictor

Thank you for taking the time to contribute. This document covers how to report issues, propose features, and submit changes.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Reporting Bugs](#reporting-bugs)
- [Requesting Features](#requesting-features)
- [Development Setup](#development-setup)
- [Submitting a Pull Request](#submitting-a-pull-request)
- [Coding Standards](#coding-standards)
- [Architecture Rules](#architecture-rules)

---

## Code of Conduct

Be respectful, constructive, and inclusive. Harassment of any kind will not be tolerated.

---

## Reporting Bugs

1. Search [existing issues](../../issues) first — your bug may already be tracked.
2. Open a new issue using the **Bug Report** template.
3. Include:
   - A clear title and description
   - Steps to reproduce
   - Expected vs actual behavior
   - Browser/Node version and OS if relevant
   - Console errors or log output

---

## Requesting Features

1. Search [existing issues](../../issues) for similar proposals.
2. Open a new issue using the **Feature Request** template.
3. Describe the problem you are solving, not just the solution you have in mind.

---

## Development Setup

See [README.md](README.md#getting-started) for full setup instructions.

Quick summary:

```bash
git clone https://github.com/your-org/hivemind-predictor.git
cd hivemind-predictor
pnpm install
cp .env.example .env
# Set DATABASE_URL in .env
pnpm --filter @workspace/db run push
```

Run the stack:

```bash
# API server
pnpm --filter @workspace/api-server run dev

# Frontend
pnpm --filter @workspace/hivemind run dev
```

---

## Submitting a Pull Request

1. **Fork** the repository and create a branch from `main`:
   ```bash
   git checkout -b feat/your-feature-name
   ```
2. Make your changes, following the [coding standards](#coding-standards) below.
3. Run the full typecheck before opening a PR:
   ```bash
   pnpm run typecheck
   ```
4. If you changed `lib/api-spec/openapi.yaml`, regenerate the client:
   ```bash
   pnpm --filter @workspace/api-spec run codegen
   ```
5. Commit using a descriptive message and open a PR against `main`.
6. Fill in the PR template — describe what changed and why.

---

## Coding Standards

- **TypeScript strictly** — no `any`, no `@ts-ignore` without an explanation comment.
- **No hand-written API hooks** — always modify `openapi.yaml` and run codegen.
- **Prettier** for formatting — run `pnpm prettier --write .` before committing.
- **Drizzle NULL checks** — use `isNull(col)` not `eq(col, null)`.
- **Fallback data required** — every external API call must have a graceful fallback.
- Keep files focused. Split large components and route handlers into smaller modules.

---

## Architecture Rules

| Rule | Reason |
|---|---|
| OpenAPI spec is the single source of truth for all routes | Keeps client and server in sync automatically |
| Orval codegen uses `mode: "single"` for Zod schemas | Prevents naming conflicts between Zod schemas and TS types |
| Never run `pnpm dev` at workspace root | Use per-package scripts or workflow commands |
| All DB null checks use `isNull()` | TypeScript enforces this — `eq(col, null)` is a runtime footgun |
| External API failures must not crash the server | Fallback data keeps the UI usable under network failure |
