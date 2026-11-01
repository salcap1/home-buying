# `db/migrations`

Numbered SQL for Neon. Application code uses tagged templates in `lib/db.js`; schema changes belong here, not as ad-hoc `CREATE` in a route.

Do not add a second database per customer. Phase 1 (org / board tables) starts with the first file in this folder.
