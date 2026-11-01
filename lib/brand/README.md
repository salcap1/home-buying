# Branding

Company look is a **theme file**, not a fork and not a database row (yet).

1. Copy `themes/default.ts` (see `themes/south32.ts`).
2. Register it in `index.ts`.
3. Set `NEXT_PUBLIC_BRAND=<id>`.

Later, host → org can pick the same `BrandTheme`. Do not put logos in `page.tsx`.

When shadcn lands, map these tokens onto its CSS variables (`--paper` → background, `--ink` → foreground, `--a` → primary). Do not keep a second color source of truth.
