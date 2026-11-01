# `lib/tenancy`

Resolve the current **organization** and **board** for a request (custom host, `/o/:org/b/:board`, or the unlocked board cookie).

Do not put `WHERE id = 1` in new routes. When phase 1 starts, the first real file here is something like `resolveBoard.js`. See [docs/architecture.md](../../docs/architecture.md).
