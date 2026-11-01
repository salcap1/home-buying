# `scripts`

One-off maintenance: import a CSV, backfill a board, apply a migration. Keep product logic in `lib/`.

```bash
# One password = one board (requires DATABASE_URL)
node scripts/set-workspace-password.mjs personal 'your-password' charlotte
```
