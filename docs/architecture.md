# Multi-tenant architecture

This app started as one family's house hunt. Treat every new change as if **32 South is customer one of a thousand**, not a one-off fork. One codebase, one Vercel project you own, one Neon database you own. Branding, markets, filters, and map layers are data.

The product is a **buyer board**: a shortlist with payment math, commute, schools, and map context. If 32 South says “every buyer gets their own version,” that is this model — not a second app. It is not an IDX search portal and it does not replace `search.32south.com`.

Read this file before adding tables, routes, or market-specific logic. Foundation already in the repo: [foundation.md](foundation.md), [development.md](development.md). Deal / pricing notes stay out of git (`docs/private/` or local only).

## Current state (single tenant)

| Area | Today | Problem |
|---|---|---|
| Data | Board-scoped `assumptions` / `houses` on Neon | No org table yet |
| Filters | `boards.rules` + `initial_disabled` | Still need richer rule UI |
| Money | Basis and cash on assumptions | Legacy column names remain |
| Maps | Census school districts + counties | Market layers still thin |
| Ingest | Listing URL scrape + Redfin CSV | Not a sellable MLS path |
| App | Password-only account unlock (one board per password) | No agent accounts or share tokens yet |
| Hosting | Vercel + Neon | Fine as a demo; not a company host |

32 South (or any later org) should never get a branch of this repo. They get a **workspace**.

## Target shape

```
Organization          32 South, later any brokerage
  members             agents / broker admin
  branding            name, logo, colors, custom hostname
  modules[]           which product slices are on
  layer_ids[]         which map layers this market may use
    Board             one buyer (the Millers)
      share_token     client can view, no account
      assumptions     money + destinations for that buyer
      rules[]         max payment, max drive, exclude schools
      listings[]      the shortlist
```

Clients do not log in. They get a private board URL. Agents see that board (favorites, notes, budget, which homes). Agents log in later. The public website gets a **link**, not the full dashboard in an iframe. Optional later: a tiny `/embed/*` widget on `32south.com`. Never inject into their IDX vendor map.

Keep any personal hunt as a tenant on the **same** platform once orgs exist. Do not maintain a personal fork and a commercial fork.

## Data model

Row-level tenancy. Every query that reads or writes buyer data includes `org_id` and, when relevant, `board_id`. Do not create a Postgres schema or Neon project per customer.

```sql
-- Shared catalog (not tenant-owned)
map_layers (
  id, label, kind,           -- school_district | flood | custom
  source_type,               -- arcgis | geojson | function
  source_url, field_map,
  region                     -- charleston | charlotte | ...
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
  custom_host,               -- boards.32south.com
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
  -- generic money; no wife_ / nanny_ column names
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
  notes,                     -- agent notes on this card
  hearted, sort_order
)

dismissed (
  org_id, board_id,
  url_key, address_key
)
```

A personal hunt becomes a normal org + board. Do not keep a special `WHERE id = 1` path.

## Modules

Ship features as **optional modules** on the org or board. Default on: payments, commute destinations, schools, agent notes. Default off: expense lines (each house's gap is these lines plus today's housing, minus the new monthly payment, from a $0 baseline), sell-to-buy tax math.

- `lib/calc.js` stays generic mortgage + housing cost.
- Sell-to-buy fees and tax are inputs on the board, not household constants in calc.
- Expense labels are the names typed on the board.

## Filters and map layers

Rules are rows, not named regexes. A commute limit is `{ kind: "max_drive", destination_id, minutes: 40 }`.

Map layers are a **registry**. `lib/districts.js` today is one Charlotte adapter. Split that into:

1. Layer records (what can be drawn).
2. Adapters that fetch polygons / point-in-polygon.
3. Org or board **enabled** layer ids.

Charleston gets Charleston County / Berkeley / Dorchester (and later flood) by adding layers, not by forking the map component. `OverviewMap` and `ListingMap` only consume `{ geoid, label, color, geometry }`.

Cache polygons and school ratings globally. GreatSchools and county GIS will not survive 1000 orgs scraping the same shape.

## Listing ingest

UI and boards talk to a provider interface, not to Redfin HTML.

```
ListingProvider
  lookup(ref) -> listing
  refresh(listing) -> listing
```

Adapters: `url` (current scrape), `redfin_csv` (current import), `mls` (later RESO / vendor feed). MLS is a second quote and a broker contract. Do not build the UI as if scrape is forever, and do not block a first customer on MLS.

Shared `listing_cache` means two orgs looking at the same address share enrichment.

## Hosting and “their website”

You run a small SaaS. 32 South (and later orgs) rent a tenant.

You own: GitHub, the Vercel project, Neon, the app domain, later Stripe and API keys. They may CNAME `buyers.32south.com` (or `boards.32south.com`) at you. They do not get the repo or their own Vercel/Neon.

One Next.js app. Resolve the org from, in order:

1. Custom host (`buyers.32south.com` CNAME → Vercel)
2. Path (`/o/32south/b/<board>`)
3. Local / preview default org

Early infra should stay cheap (Vercel + Neon + domain). MLS/IDX vendor fees are the cost that can jump; do not take them on before a broker-sponsored feed.

Website integration:

- **v1:** link + branded subdomain. Agents text share URLs.
- **v2:** `/embed/...` only for a small public widget. Set `frame-ancestors` to that org’s marketing origin.
- **Never:** iframe `app/page.js` into WordPress, or try to mount inside `search.32south.com`.

## Database: stay on Neon

Neon is enough long term. App code uses `getStore()` (`lib/data`). The Neon adapter holds tagged SQL. No Prisma/Drizzle. 1000 small brokerages is tenancy and indexing, not a new vendor.

**Do not migrate to Supabase** because a conversation got interesting. Both are Postgres. Add `lib/data/supabase` only after a paying customer needs Auth + RLS, and keep the same `DataStore` interface.

Until org tables exist, the store still talks to board-scoped tables. New queries go in the adapter, not in `app/api`.

## Auth (when you add it)

- Agent / broker: real auth, org-scoped session.
- Client: `share_token` on the board. No password.
- Every API that can edit listings or assumptions requires an agent session. Share-token routes are read-only (or comments only).
- Today there is no auth. New write routes should be shaped so a session check can be added in one place (`lib/auth.js` or equivalent), not copied into each file.

## API shape to grow toward

```
GET/PUT  /api/orgs/:org
GET/POST /api/orgs/:org/boards
GET/PUT  /api/boards/:board/assumptions
GET/POST /api/boards/:board/listings
GET      /api/share/:token
```

Do not add more global `/api/houses` or `/api/assumptions` that imply one row in the world. When touching those existing routes, prefer wrapping them as “the current board” behind a resolver rather than extending the singleton.

## What 32 South pays for vs what you keep

- They get a workspace, branding, Charleston layers, support, optional custom host.
- You keep the repo, Vercel, Neon, the layer catalog, and the right to sell the same app again.
- A feature they pay you to build defaults onto the platform unless they pay for a time-boxed exclusive.
- Do not put their logo or copy in source. Put it on the org row.
- Do not let a first invoice become a source sale.

## Phased build (do not jump ahead)

0. **This doc + agent rules + repo foundation** ([foundation.md](foundation.md): lint, CI, Lucide, brand tokens, data SDK, shadcn/Tailwind + Vitest). No product rewrite until a customer scope exists.
1. **Board + org tables on Neon.** Keep the current UI working. No Supabase.
2. **Config:** rules, destinations, modules on the board — not hardcodes in filters/calc.
3. **Layer registry.** Charlotte adapters become catalog entries; add Charleston the same way.
4. **Share links + branding + custom host.**
5. **Agent auth.**
6. **MLS adapter** only after a broker can actually sponsor a feed.
7. **Embed widget** only if they want a public homepage tool.

When a request is “just make it work for 32 South,” do the smallest slice of the current phase that fits the model above. Do not special-case Charleston in `page.js`.
