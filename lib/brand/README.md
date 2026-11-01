# Branding

Company look is a **theme file**, not a fork and not a database row (yet).

The app uses the **default** theme. Extra themes can be registered for later host → org wiring.

1. Copy `themes/default.ts`.
2. Register it in `index.ts`.
3. Select it from org/host config when that exists — do not add an env switch.

Do not put logos in `page.tsx`.

When shadcn lands, map these tokens onto its CSS variables (`--paper` → background, `--ink` → foreground, `--a` → primary). Do not keep a second color source of truth.
