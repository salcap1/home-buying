# Buyer boards

A hosted **buyer board** for real-estate shortlists: payments, commute, schools, and map context. Agents (or households) keep private searches behind a password; visitors can still open the app and see the empty board shell.

This is one Next.js app on Vercel + Neon. Branding and market rules are data — not forks.

## Features

- Password-only accounts (no email/username). One password = one board. Need another market? Create another account.
- Create an account from the app: **Create account** → password → empty board.
- Shortlist counseling: payment math, sell-to-buy cash, drive times, school ratings, map overlays.
- Board-scoped data on a shared Neon database (`board_id` / `access_key_id`).

## Quick start

```bash
npm install
cp .env.example .env.local
# set DATABASE_URL (or HOME_BUYING_STORAGE_DATABASE_URL) and SESSION_SECRET
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Without signing in you get the empty UI. Sign in or create a workspace with a password.

Optional ops script (attach a password to an existing board):

```bash
node scripts/set-workspace-password.mjs personal 'your-password' charlotte
```

## Environment

Copy [`.env.example`](.env.example). Never commit `.env.local` or real Neon credentials.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` / `HOME_BUYING_STORAGE_DATABASE_URL` | Neon connection string |
| `DATABASE_PROVIDER` | `neon` (default) |
| `SESSION_SECRET` | Signs unlock cookies (required for auth) |
| `CRON_SECRET` | Bearer token for listing refresh cron |
| `NEXT_PUBLIC_BRAND` | Theme id (`default`, `south32`, …) |

Apply SQL under [`db/migrations/`](db/migrations/) to your Neon database before first run of new features.

## Scripts

```bash
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
```

Node 22 (see `.nvmrc`).

## Repo layout

| Path | Role |
|---|---|
| `app/` | Board UI and API routes |
| `lib/data/` | `getStore()` + Neon SQL |
| `lib/auth/` | Password hashing + session cookies |
| `lib/brand/` | Themes |
| `db/migrations/` | Schema changes |
| `docs/` | Architecture, flows, development notes |

Start with [`docs/codebase.md`](docs/codebase.md) and [`docs/architecture.md`](docs/architecture.md) if you are changing product shape.

## Public / private data

**In git**

- Application code, migrations (schema only — no household dollar seeds), public docs, `.env.example`

**Not in git** (see `.gitignore`)

- `.env.local` and other env files with secrets
- `.cursor/` (local agent rules/skills)
- `docs/broker-discussions.md` and `docs/private/` (deal notes)
- `.vercel` / `.neon`, SQL dumps, live board data

Live assumptions, listings, and password hashes stay in your Neon project. Account passwords are scrypt hashes on `home_buying.access_keys`.

Before flipping a GitHub repo to public: confirm `SESSION_SECRET` and DB URLs are only in Vercel/host env, run `git status` for untracked secrets, and remember old commits may still contain prior hardcodes unless you rewrite history.

## Product docs

- [docs/architecture.md](docs/architecture.md) — multi-tenant target model
- [docs/flows.md](docs/flows.md) — how listings, maps, and money move
- [docs/development.md](docs/development.md) — commands and conventions

## License

[MIT](LICENSE)
