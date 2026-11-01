# AGENTS.md

Multi-tenant **buyer board** product: shortlists with payments, commute, schools, and map context. Build as if a thousand brokerages will share this repo.

## Read first

- [docs/codebase.md](docs/codebase.md) — request path, boards, which file owns a change
- [docs/flows.md](docs/flows.md) — listing, map, and payment flows
- [docs/architecture.md](docs/architecture.md) — tenancy, data model, modules, map layers, hosting, MLS
- [docs/development.md](docs/development.md) — commands, folder map, lint/format/CI
- [docs/foundation.md](docs/foundation.md) — TS, Lucide, brand, data SDK, UI/test decisions

Local Cursor rules/skills live under `.cursor/` (gitignored). `docs/codebase.md` wins for where to edit; `docs/architecture.md` wins for what must stay data (no per-customer forks, no hardcoded markets).

## What this product is

A shortlist counseling tool that can grow into a **client-facing buyer platform**. Agents share a private board. Password-only accounts unlock one board each. You host (Vercel + Neon); customers rent a tenant.

It is **not** an IDX search portal, a Zillow clone, or something that mounts inside a brokerage IDX map.

## Stack

- Next.js App Router (`app/`), React, Leaflet, TypeScript, Lucide
- New UI: shadcn/ui + Tailwind, themed by `lib/brand`. Do not add MUI/Chakra. Do not rewrite `page.tsx` to adopt it.
- Neon behind `getStore()` in `lib/data`. Do not add SQL in routes. Do not implement Supabase unless a paying customer needs Auth + RLS and the user asks.
- Branding is `lib/brand` + `NEXT_PUBLIC_BRAND`. Do not hardcode a company look in `page.tsx`.
- Vercel (`vercel.json` crons). You own this project; customers CNAME to it.

`npm run dev` / `npm run lint` / `npm run typecheck` / `npm test` / `npm run build`. Env: copy `.env.example` to `.env.local`. Node 22 (`.nvmrc`). New files are `.ts` / `.tsx`. Shared types: `lib/types.ts`. Platform folders: `lib/brand`, `lib/data`, `lib/tenancy`, `lib/auth`, `lib/providers`, `lib/layers`, `db/migrations`. Do not mass-run Prettier on the current app. Do not strip `// @ts-nocheck` from the demo UI as busywork.

## How to change things

1. Prefer config and tables over new `if` branches for a person, town, or brokerage.
2. New buyer data belongs on an **org → board**. Do not extend singleton `assumptions` rows as the long-term model.
3. Map overlays go through a layer registry, not another hardcoded GIS URL in a component.
4. Listing ingest goes through a provider shape (`url` / `csv` / later `mls`). Do not couple UI to Redfin HTML.
5. Keep customers as **data**: brand theme, enabled layers, module flags. No forks, no logo hardcoded in `page.tsx`.
6. Database access goes through `getStore()`. New queries live in `lib/data/neon`, not in `app/api`.
7. Match existing style in `app/` and `lib/`. Do not add a new framework or rewrite `page.tsx` unless the task is that rewrite.
8. Do not implement MLS live search, agent org auth, or an iframe widget unless the task explicitly asks. Shape new code so those can attach later.

## Current landmines

When you touch these, generalize or isolate:

- Filter thresholds belong on `boards.rules` / `initial_disabled`, not named regexes in `lib/filters.ts`
- Money defaults belong on assumptions, not calc hardcodes
- APIs must stay board-scoped via `boardContext`
- One password unlocks one board; do not list boards without a session

## Website integration

Default: branded subdomain + share URL. Marketing site gets a link. Full dashboard is not an iframe. See architecture doc.

## Don’t

- Hardcode a customer name, city, or school into UI or filters
- Create a per-tenant database or repo, or a personal-vs-commercial fork
- Migrate to Supabase “to be ready”
- Scrape more listing sites as a “product” MLS
- Replace or embed into a brokerage IDX map
