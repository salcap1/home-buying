# Supabase adapter (not implemented)

Neon is the active provider. If Auth + RLS is explicitly required later, add `createSupabaseStore(): DataStore` here and register it in `lib/data/index.ts`. Same interface, same mappers. Do not rewrite routes.
