# Ledgerline (production app)

The production build of Ledgerline — a web-based, professional trial balance &
engagement platform for CPA firms. See [`../docs/PLAN.md`](../docs/PLAN.md) for the
full product plan and phased roadmap.

This directory is the Phase 0/1 rebuild of the original single-file prototype
(`../index.html`), on a real, typed, testable stack.

## Stack

- **Vite + React 18 + TypeScript** (strict)
- **Supabase** — Postgres, Auth, Storage, Row-Level Security (schema in
  [`../supabase/migrations`](../supabase/migrations))
- **Vitest** for the money & trial-balance engine

## What's built (Phase 1)

- **Multi-column Working Trial Balance** — Unadjusted → Reclass → Adjusting →
  Adjusted → Tax → Tax Basis, grouped into leadsheets with subtotals and a
  balance check. Engine: `src/domain/trialBalance.ts`.
- **Chart-of-Accounts standardization** — firm-standard leadsheet groups,
  auto-grouping heuristics, grouped leadsheet rendering. `src/domain/coa.ts`.
- **Integer-cents money handling** — no floating-point drift. `src/domain/money.ts`.
- **Multi-tenant schema + RLS** — firms → clients → engagements → binder, every
  row isolated by firm. `../supabase/migrations`.

All domain math is covered by tests (`npm test`).

## Getting started

```bash
npm install
npm run dev      # runs in demo mode against a bundled sample engagement
```

To connect a real backend, copy `.env.example` to `.env.local`, fill in your
Supabase URL + anon key, and apply the SQL in `../supabase/migrations`.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck (`tsc -b`) + production build |
| `npm test` | Run the Vitest domain suite |
| `npm run typecheck` | Types only |

## Demo mode

With no Supabase configured, the app renders a realistic, balanced sample
engagement (Northwind Trading Co., FY2025) so the full Working Trial Balance is
explorable offline.
