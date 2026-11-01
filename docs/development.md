# Development

How this repo is run as a product you host. Product shape: [architecture.md](architecture.md). What we have already stood up: [foundation.md](foundation.md).

## Commands

```bash
npm install
cp .env.example .env.local   # then put the Neon URL in
npm run dev
```

| Script | What |
|---|---|
| `npm run dev` | Next.js locally |
| `npm run build` / `npm start` | Production server |
| `npm run lint` | ESLint (`eslint-config-next` 15 + TypeScript). The current UI has hook/`<img>` warnings; do not “fix” them in a drive-by. |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest (`tests/**/*.test.ts`) |
| `npm run test:watch` | Vitest watch |
| `npm run format` | Prettier write — **do not mass-format the existing app** unless that is the task |
| `npm run format:check` | Prettier check |

Node 22 (`.nvmrc`). CI on `main` and PRs: lint, typecheck, test, build. Husky runs lint-staged + tests on commit.

## Layout

App code is TypeScript (`app/page.tsx`, `lib/*.ts`). Shared domain types live in `lib/types.ts`. Type **new** files. Tenancy, SQL, and GIS URLs stay out of `page.tsx`. The working map is [codebase.md](codebase.md).

| Path | Role |
|---|---|
| `app/` | Board UI (`page.tsx`, map components) and thin API routes. |
| `lib/` | Domain code. Start with `lib/types.ts` and `lib/calc.ts`. |
| `lib/brand/` | Company themes (default theme in use). |
| `lib/data/` | Database SDK (`getStore(boardId)`). Neon SQL lives in `lib/data/neon`. |
| `lib/tenancy/` | `boardContext` / `resolveBoard` from the session cookie. |
| `lib/auth/` | Password hashing (scrypt) + HMAC session cookies. One password = one board. |
| `lib/layers/` | School districts, counties, polygon helpers, basemap tiles. |
| `lib/modules/` | Optional product slices from env or the brand theme. |
| `lib/providers/` | Not created yet. Listing ingest is `lib/listing.ts` and `lib/redfin-csv.ts`. |
| `components/ui/` | shadcn/ui primitives. Theme from `lib/brand`. |
| `db/migrations/` | Neon SQL. Boards are search tabs (`001`, `002`), not org tables yet. |
| `tests/` | Vitest (`tests/**/*.test.ts`). |
| `data/` | Static geo (Union high schools). New overlays go through `lib/layers`. |
| `docs/` | Architecture (target), codebase map and flows (today), broker, this file. |
| `AGENTS.md` | Contributor / agent conventions. Local Cursor rules live in gitignored `.cursor/`. |

## Rules of the road

- You own Vercel + Neon. Customers get a tenant and maybe `buyers.example.com`.
- Stay on Neon. Talk to `getStore()`, not `@neondatabase/serverless`, from app code. A Supabase adapter is a later file, not a rewrite.
- Branding is a theme file. Do not hardcode a company name or color in `page.tsx`.
- New UI is **shadcn/ui + Tailwind + Lucide**, tokens from `lib/brand`. Do not add MUI/Chakra/Mantine. Do not rewrite `page.tsx` or `globals.css` in one pass.
- Icons come from `lucide-react`.
- Tests are Vitest.
- Do not rewrite `page.tsx` to “look like a SaaS” without a deal shape.
- New files are TypeScript. Do not add `.js` sources.
- Format and lint **new** files. Do not prettier-bomb the demo UI unless asked. Do not strip `// @ts-nocheck` from `page.tsx` as busywork.
- Env names belong in `.env.example`. Never commit `.env.local`.
