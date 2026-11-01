# `lib/auth`

Account unlock is a unique password per access key (`access_keys.password_hash`), bound to one board. Visitors can create a password-only account from the UI. Session cookies are signed with `SESSION_SECRET`.

Later agent/broker accounts and client `share_token` links also belong here. Stay on Neon; do not add Supabase Auth unless a paying customer needs it and we decide to migrate.
