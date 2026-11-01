# Codebase map

Current code, for agents. The target product is [architecture.md](architecture.md). This file is what exists today. When they disagree, follow this file for where to edit and the architecture doc for what not to hardcode. Sequences (add a listing, fill-in, map, money) are [flows.md](flows.md).

## Request path

```
cookie board_id
  → boardContext(request)     lib/tenancy/board.ts
    → getStore(board.id)        lib/data/index.ts
  → createNeonStore(boardId)  lib/data/neon/store.ts
  → SQL filtered by board_id
```

A signed `board_session` cookie (HMAC of `access_key_id` with `SESSION_SECRET`) unlocks one board. Without an unlock session, `boardContext` returns the empty store.

`getStore()` caches one store per board id. Routes call `boardContext`, then `store.*`. They do not import `@neondatabase/serverless` or `lib/db.ts`.

## What a board is today

One **board** per password/account (not multi-tab).

| Table | Role |
|---|---|
| `home_buying.access_keys` | Unique account password (`password_hash`) |
| `home_buying.boards` | Board: id, name, zip, radius, center, `initial_disabled`, `rules`, `access_key_id` (unique when set) |
| `houses`, `assumptions`, `dismissed` | Rows carry `board_id` |
| `home_buying.board_areas` | Counties selected for that tab |

Seeded ids: `charlotte`, `nova`. There is no `organizations` table and no `org_id` column yet. `BoardContext.orgId` is `DEMO_ORG_ID` (default `demo`).

Do not add a second global `WHERE id = 1` path. New buyer data takes `board_id` through the store.

## Where to change what

| Task | Edit | Leave alone |
|---|---|---|
| List, save, or query buyer rows | `DataStore` in `lib/data/store.ts`, SQL in `lib/data/neon/store.ts`, row mapping in `lib/data/mappers.ts` | `app/api/**` (thin handlers only) |
| Which tab is active | `lib/tenancy/board.ts`, cookie helpers in `lib/auth/session.ts` | Per-route session checks |
| HTTP shape | `app/api/<name>/route.ts` — `export const dynamic = "force-dynamic"`, `boardContext(request)`, `dataErrorResponse` | Neon SQL |
| Money, payment, sell-to-buy | `lib/calc.ts` | Named household constants |
| Domain shapes | `lib/types.ts` | Ad-hoc types in `page.tsx` |
| Module on/off | `lib/modules/catalog.ts`, `NEXT_PUBLIC_MODULES` or the brand theme | `if (org === "acme")` |
| Look and copy | `lib/brand/themes/*` (default theme) | Colors and company names in `page.tsx` |
| Screen behavior | `app/page.tsx` (the board UI) | A second app shell |
| Map drawing | `app/OverviewMap.tsx`, `app/ListingMap.tsx` — they render `{ geoid, label, color, geometry }` and pins | County URLs inside the component |
| School districts | `lib/layers/school-districts.ts` | A new GIS URL in the map component |
| County search area | `lib/layers/counties.ts`, `lib/search-area.ts` | Hardcoded city bounds |
| Polygon math | `lib/layers/geometry.ts` (`pointInGeometry`) | Duplicating point-in-polygon in a route |
| Listing paste / CSV | `lib/listing.ts`, `lib/redfin-csv.ts`. The sequence is [flows.md](flows.md) | Redfin HTML parsing in the UI |
| Schema | next file in `db/migrations/` | Editing an applied migration |

`lib/providers/` does not exist yet. Listing ingest still lives in `lib/listing.ts` and `lib/redfin-csv.ts`. Add a provider there when a second source needs the same interface.

## Map data

`GET /api/areas` and `POST /api/districts` feed the overview map. Districts are Census TIGER school districts (unified, secondary, elementary) for every market, stored on the house as `facts.district` / `facts.districtGeoid` (`sd:` + GEOID). There are no attendance zones.

District and county geometry is shared across boards. The per-board choice is which counties are selected (`board_areas`).

## Auth

Each account has a unique password (`access_keys.password_hash`) and exactly one board. `POST /api/session` with `mode: "sign_in" | "create"` unlocks or creates that board. Locked visitors still see the empty board UI. Share links are still future; see architecture phase 4.

Listing refresh (`/api/houses/refresh`) requires a signed-in board session.

## Board config (not code)

- `boards.rules` / `initial_disabled` — max housing, max drive, excluded schools (`lib/filters.ts`)
- `assumptions.basis_paid` / `basis_improvements` / money fields — sale basis and cash (`lib/calc.ts`)

## Checks

`npm run lint`, `npm run typecheck`, `npm test`. Tests are Vitest in `tests/**/*.test.ts`. Format the files you edited. Do not Prettier the whole app, and do not strip types out of `app/page.tsx` as a side task.
