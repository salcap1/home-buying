# Data SDK

Routes and jobs talk to `getStore()`, not Neon SQL.

```
getStore()
  .houses | .assumptions | .dismissed | .ratings
```

- `lib/data/store.ts` — provider-agnostic interface
- `lib/data/neon/` — current Postgres implementation
- `lib/data/supabase/` — placeholder only; do not implement until a paying customer needs Auth + RLS
- `lib/data/errors.ts` — `DataError` + `dataErrorResponse`

Set `DATABASE_PROVIDER=neon` (default). Switching later means a new adapter that implements `DataStore`, not new queries in `app/api`.
