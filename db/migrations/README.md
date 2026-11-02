# `db/migrations`

Numbered SQL for evolving an **existing** Neon database (incremental history).

## Greenfield vs existing

| Path | Use when |
|---|---|
| [`db/schema.sql`](../schema.sql) via `npm run db:setup` | New empty Neon (contributors, fresh projects) |
| Numbered files here (`001` …) | Database already has schema and needs the next change |

Application code talks to Postgres through `getStore()` / `lib/data/neon`. Schema changes belong in SQL files, not as ad-hoc `CREATE` in a route.

Do not add a second database per customer. Do not commit connection strings or live board seeds.

## When you change the schema

1. Add a new numbered migration under this folder (next integer).
2. Update [`db/schema.sql`](../schema.sql) so greenfield stays current.
3. Document any data backfill that only applies to existing rows.

Historical `001`–`006` assume an already-evolved personal database (they `ALTER` legacy tables and may seed demo board ids). New contributors should not run those files; use `schema.sql` instead.
