# Buyer boards

[![CI](https://github.com/salcap1/home-buying/actions/workflows/ci.yml/badge.svg)](https://github.com/salcap1/home-buying/actions/workflows/ci.yml)
![Coverage](.github/badges/coverage.svg)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
![Node](https://img.shields.io/badge/node-22-brightgreen)

A hosted **buyer board** for real-estate shortlists: payments, commute, schools, and map context. Agents (or households) keep private searches behind a password; visitors can still open the app and see the empty board shell.

This is one Next.js app on Vercel + Neon. Branding and market rules are data — not forks.

## Features

- Password-only accounts (no email/username). One password = one board. Need another market? Create another account.
- Create an account from the app: **Create account** → password → empty board.
- Shortlist counseling: payment math, sell-to-buy cash, drive times, school ratings, map overlays.
- Board-scoped data on a shared Neon database (`board_id` / `access_key_id`).

## Quick start

Use **your own** free [Neon](https://console.neon.tech) project. This repo does not ship a shared database; do not reuse a maintainer or production `DATABASE_URL`.

```bash
npm install
cp .env.example .env.local
# set DATABASE_URL to your Neon connection string
# set SESSION_SECRET (e.g. openssl rand -hex 32)
npm run db:setup   # applies db/schema.sql to your empty Neon
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Without signing in you get the empty UI. Create an account with a password to bootstrap a board.

Unit tests (`npm test`) do not need Neon.

## Environment

Copy [`.env.example`](.env.example). Never commit `.env.local` or real Neon credentials.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` / `HOME_BUYING_STORAGE_DATABASE_URL` | **Your** Neon connection string |
| `DATABASE_PROVIDER` | `neon` (default) |
| `SESSION_SECRET` | Signs unlock cookies (required for auth) |

Greenfield setup: [`db/schema.sql`](db/schema.sql) via `npm run db:setup`. Incremental history for existing databases: [`db/migrations/`](db/migrations/).

## Commands

```bash
npm run dev
npm run lint
npm run typecheck
npm test
npm run test:coverage
npm run build
```

Node 22 (see `.nvmrc`).

## Testing

Domain unit tests live under [`tests/`](tests/) and target `lib/` (auth/session, tenancy, payments, filters, data helpers). CI runs `npm run test:coverage`, posts a coverage summary on the job, and uploads the HTML report as an artifact. The coverage badge above is regenerated with `npm run coverage:badge` after a local or CI coverage run — commit the SVG when the percentage moves.

See [`tests/README.md`](tests/README.md). UI (`app/page.tsx`) is intentionally not covered yet.

## Repo layout

| Path | Role |
|---|---|
| `app/` | Board UI and API routes |
| `lib/data/` | `getStore()` + Neon SQL |
| `lib/auth/` | Password hashing + session cookies |
| `lib/brand/` | Themes |
| `lib/tenancy/` | Board session → store |
| `db/schema.sql` | Empty greenfield schema (`npm run db:setup`) |
| `db/migrations/` | Incremental schema history for existing DBs |
| `tests/` | Vitest unit tests |
| `docs/` | Architecture, flows, development notes |

Start with [`docs/codebase.md`](docs/codebase.md) and [`docs/architecture.md`](docs/architecture.md) if you are changing product shape.

## Public / private data

**In git**

- Application code, [`db/schema.sql`](db/schema.sql) (empty greenfield schema), migrations (incremental DDL — no live board seeds), public docs, `.env.example`

**Not in git** (see `.gitignore`)

- `.env.local` and other env files with secrets
- `.cursor/` (local agent rules/skills)
- `docs/private/`, SQL dumps, live board data
- `.vercel` / `.neon`

Live assumptions, listings, and password hashes stay in your Neon project. Account passwords are scrypt hashes on `home_buying.access_keys`.

## Product docs

- [docs/architecture.md](docs/architecture.md) — multi-tenant target model
- [docs/flows.md](docs/flows.md) — how listings, maps, and money move
- [docs/development.md](docs/development.md) — commands and conventions

## Contributing

Commits and PR titles use [Conventional Commits](https://www.conventionalcommits.org/) (`commitlint` + CI). See [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md).

## Security

See [SECURITY.md](SECURITY.md) for how to report vulnerabilities. Dependabot opens weekly npm and Actions update PRs; enable security updates in the repo’s Dependabot settings if they are off.

## License

[MIT](LICENSE)
