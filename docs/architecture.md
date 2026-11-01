# Multi-tenant architecture

Treat every change as if many organizations will share one codebase, one Vercel project, and one Neon database. Branding, markets, filters, and map layers are **data**, not forks.

The product is a **buyer board**: a shortlist with payment math, commute, schools, and map context. One board per buyer search — not a second app, not an IDX search portal, and not something that mounts inside a brokerage IDX map.

Read this before adding tables, routes, or market-specific logic. Also see [foundation.md](foundation.md) and [development.md](development.md).

## Current state

| Area | Today | Gap |
|---|---|---|
| Data | Board-scoped `assumptions` / `houses` on Neon | No org table yet |
| Filters | `boards.rules` + `initial_disabled` | Richer rule UI |
| Money | Basis and cash on assumptions | Legacy column names remain |
| Maps | Census school districts + counties | Market layers still thin |
| Ingest | Listing URL scrape + Redfin CSV | Not a live MLS feed |
| App | Password-only unlock (one board per password) | No agent accounts or share tokens yet |
| Hosting | Vercel + Neon | Single deployment |

Orgs get a **workspace** (data), never a branch of this repo.

## Target shape

```
Organization          any real-estate org
  members             agents / admin
  branding            name, logo, colors, custom hostname
  modules[]           which product slices are on
  layer_ids[]         which map layers this market may use
    Board             one buyer search
      share_token     client can view, no account
      assumptions     money + destinations for that buyer
      rules[]         max payment, max drive, exclude schools
      listings[]      the shortlist
```

Clients do not log in. They get a private board URL. Agents see that board (favorites, notes, budget, which homes). Agent login is later. A marketing site gets a **link**, not the full dashboard in an iframe. Optional later: a small `/embed/*` widget. Never inject into a vendor IDX map.

Keep personal and commercial boards as tenants on the **same** platform once orgs exist. Do not maintain a personal fork and a commercial fork.

## Data model

Row-level tenancy. Every query that reads or writes buyer data includes `org_id` and, when relevant, `board_id`. Do not create a Postgres schema or Neon project per customer.

```sql
-- Shared catalog (not tenant-owned)
map_layers (
  id, label, kind,           -- school_district | flood | custom
  source_type,               -- arcgis | geojson | function
  source_url, field_map,
  region                     -- market id, not hardcoded in UI
)

listing_cache (              -- shared enrichment; do not re-scrape per org
  cache_key,                 -- address or mls id
  payload,                   -- facts, schools, geo, photo
  source, fetched_at
)

-- Tenant
organizations (
  id, slug, name,
  logo_url, theme jsonb,
  custom_host,
  enabled_modules jsonb,     -- ["payments","commute","schools","sell_to_buy"]
  enabled_layer_ids text[],
  created_at
)

members (
  id, org_id, email, role,   -- owner | agent | admin
  unique (org_id, email)
)

boards (
  id, org_id, name,
  created_by,
  share_token,               -- unguessable; client read
  share_mode,                -- read | comment
  created_at
)

board_assumptions (
  board_id primary key,
  rate, term_years, tax_pct, pmi_pct, closing_pct,
  current_housing, keep_cash,
  sale jsonb,                -- optional sell-to-buy module
  household jsonb,           -- optional cash-flow lines
  destinations jsonb,
  extra_items jsonb
)

board_rules (
  board_id,
  kind,                      -- max_housing | max_drive | exclude_school | ...
  config jsonb               -- { amount: 4300 } | { destination_id, minutes }
)

listings (
  id, org_id, board_id,
  source,                    -- url | csv | mls
  external_id,
  name, url, price, ...
  notes,
  hearted, sort_order
)

dismissed (
  org_id, board_id,
  url_key, address_key
)
```

Do not keep a special `WHERE id = 1` path for any board.

## Modules

Ship features as **optional modules** on the org or board. Default on: payments, commute destinations, schools, agent notes. Default off: household expense lines, sell-to-buy tax math.

- `lib/calc.ts` stays generic mortgage + housing cost.
- Sell-to-buy fees and tax are inputs on the board, not constants in calc.
- Expense labels are the names typed on the board.

## Filters and map layers

Rules are rows, not named regexes. A commute limit is `{ kind: "max_drive", destination_id, minutes: 40 }`.

Map layers are a **registry**:

1. Layer records (what can be drawn).
2. Adapters that fetch polygons / point-in-polygon.
3. Org or board **enabled** layer ids.

New markets get new layer rows, not forks of the map component. `OverviewMap` and `ListingMap` only consume `{ geoid, label, color, geometry }`.

Cache polygons and school ratings globally.

## Listing ingest

UI and boards talk to a provider interface, not to Redfin HTML.

```
ListingProvider
  lookup(ref) -> listing
  refresh(listing) -> listing
```

Adapters: `url` (current scrape), `redfin_csv` (current import), `mls` (later RESO / vendor feed). Do not build the UI as if scrape is forever.

Shared `listing_cache` means two orgs looking at the same address share enrichment.

## Hosting and website integration

One Next.js app you host. Orgs rent a tenant (data + branding), not the repo or their own Vercel/Neon.

Resolve the org from, in order:

1. Custom host (CNAME → Vercel)
2. Path (`/o/:org/b/:board`)
3. Local / preview default

Website integration:

- **v1:** link + branded subdomain. Agents share board URLs.
- **v2:** `/embed/...` only for a small public widget. Set `frame-ancestors` to that org’s marketing origin.
- **Never:** iframe the full board into WordPress or a vendor IDX map.

Do not put org logos or copy in source. Put them on the org row.

## Database: stay on Neon

Neon is enough long term. App code uses `getStore()` (`lib/data`). The Neon adapter holds tagged SQL. No Prisma/Drizzle. Scale is tenancy and indexing, not a new vendor.

Add a Supabase adapter only if Auth + RLS is explicitly required later, and keep the same `DataStore` interface. Do not migrate “to prepare.”

Until org tables exist, the store still talks to board-scoped tables. New queries go in the adapter, not in `app/api`.

## Auth (when you add it)

- Agent: real auth, org-scoped session.
- Client: `share_token` on the board. No password.
- Every API that can edit listings or assumptions requires an agent session. Share-token routes are read-only (or comments only).
- Today: password-only board unlock. New write routes should be shaped so a session check can be added in one place (`lib/auth`), not copied into each file.

## API shape to grow toward

```
GET/PUT  /api/orgs/:org
GET/POST /api/orgs/:org/boards
GET/PUT  /api/boards/:board/assumptions
GET/POST /api/boards/:board/listings
GET      /api/share/:token
```

Do not add more global `/api/houses` or `/api/assumptions` that imply one row in the world. When touching those routes, prefer “the current board” behind a resolver.

## Phased build

0. **Repo foundation** ([foundation.md](foundation.md): lint, CI, Lucide, brand tokens, data SDK, shadcn/Tailwind + Vitest).
1. **Board + org tables on Neon.** Keep the current UI working.
2. **Config:** rules, destinations, modules on the board — not hardcodes in filters/calc.
3. **Layer registry.** Market adapters become catalog entries.
4. **Share links + branding + custom host.**
5. **Agent auth.**
6. **MLS adapter** when a real feed is available.
7. **Embed widget** only if a public homepage tool is needed.

Do the smallest slice of the current phase that fits this model. Do not special-case a market in `page.tsx`.
