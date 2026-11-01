# Foundation log

What we have set up so this can become a hosted product. Product shape: [architecture.md](architecture.md). How to run: [development.md](development.md).

## Done

1. **Repo tooling** — TypeScript, ESLint, Prettier, Vitest, Husky, CI, `.env.example`, Node 22.
2. **Lucide** — UI icons (`Heart`, `ExternalLink`, `X`, sort chevrons, school pin). Do not add more inline SVGs for chrome.
3. **Brand tokens** — `lib/brand`. A company is a theme file + `NEXT_PUBLIC_BRAND`. CSS variables on `<html>` (`--paper`, `--a`, `--font-body`, …). Example tenant theme: `south32`. No org table yet.
4. **Data SDK** — `getStore()` in `lib/data`. Routes do not run Neon SQL. Errors are `DataError`. `DATABASE_PROVIDER=neon`. Supabase is a documented empty adapter, not a migration.
5. **UI system (decision)** — **shadcn/ui + Tailwind + Radix**, themed by `lib/brand`. **Vitest**, not Jest. Not installed yet except Vitest. Do not rewrite `page.tsx` or `globals.css` to get there.

## In progress

- **Boards** — `home_buying.boards` plus `board_id` on houses, assumptions, and dismissed. Zones and counties are per board. See [codebase.md](codebase.md). No `organizations` table yet.
- **Gate** — password-only accounts. One password unlocks one board (`access_keys` + HMAC session cookie via `SESSION_SECRET`). Locked visitors still see the empty board shell. Not agent/org SSO yet.
- **shadcn/ui** — primitives in `components/ui/`. `app/page.tsx` already uses some of them. Do not restyle the whole screen to match the kit.

## Not yet (wait for a defined product)

- Org tables, custom host → brand, share links
- Per-agent auth
- MLS adapter
- Listing provider interface (`lib/providers/`)

## UI system

We are not adopting a themed kit (MUI, Chakra, Mantine, Ant). Those ship their own look and fight per-company paint.

**Use:** shadcn/ui on Radix, styled with Tailwind, icons from Lucide (already in the repo). Components are source we own under `components/ui/`. Tenant look stays in `lib/brand`: map `--paper` → background, `--ink` → foreground, `--a` → primary, `--font-display` / `--font-body` → fonts. Do not ship shadcn’s default zinc + Geist as the product.

**Tailwind: yes, for new UI.** Existing `globals.css` and `app/page.tsx` stay as-is until a screen is being rebuilt. Do not mass-convert class names.

**Not Tailwind-only, not Radix-only.** Utilities without a component kit will drift. Primitives without Tailwind leave every dialog looking different.

## Tests

**Vitest**, not Jest. Same `describe` / `it` / `expect` API, native ESM/TS, faster. We switched while the suite was eight unit tests. Do not add Playwright until there is a board UI worth smoking.

## How to add a company look

1. Copy `lib/brand/themes/default.ts`.
2. Register it in `lib/brand/index.ts`.
3. `NEXT_PUBLIC_BRAND=<id>`.

## How to add a database provider

1. Implement `DataStore` under `lib/data/<provider>/`.
2. Register it in `getStore()`.
3. Do not put provider SQL in `app/api`.
