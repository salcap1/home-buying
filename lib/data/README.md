# Data

All database access goes through `getStore(boardId)` / `catalogStore()`.

- `lib/data/neon/` — current adapter (tagged SQL)
- `lib/data/empty.ts` — locked/empty store for signed-out visitors
- `lib/data/mappers.ts` — row → domain types
- `lib/data/supabase/` — placeholder only; implement only if Auth + RLS is explicitly required later

Routes must not import `@neondatabase/serverless` or run SQL.
