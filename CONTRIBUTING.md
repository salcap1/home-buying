# Contributing

Please read the [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you agree to uphold it.

## Local database

Bring your **own** free [Neon](https://console.neon.tech) project. There is no shared contributor database, and you should never use a maintainer’s production connection string.

```bash
cp .env.example .env.local
# DATABASE_URL=your Neon URL
# SESSION_SECRET=openssl rand -hex 32
npm run db:setup
npm run dev
```

`npm run db:setup` applies [`db/schema.sql`](db/schema.sql) (empty schema only). Create an account in the app to start a board. `npm test` does not need a database.

## Commit messages

This repo uses [Conventional Commits](https://www.conventionalcommits.org/). Husky runs `commitlint` on every commit; PR titles must match the same format (enforced in CI) because we squash-merge.

```
<type>(optional-scope): <description>

[optional body]
```

Allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`.

Examples:

```
feat(auth): reject sessions without SESSION_SECRET
fix(filters): guard skipReasonsForHouse when assumptions are null
chore: add app icon
docs: document conventional commits
```

## Checks

```bash
npm run lint
npm run typecheck
npm test
# or
npm run test:coverage
```

Open a PR against `main`. CI must pass; one approving review from the code owner is required.
