# `lib/layers`

Map-layer catalog and adapters. `OverviewMap` / `ListingMap` should only consume `{ geoid, label, color, geometry }`.

School district boundaries come from Census TIGER (`school-districts.ts`), so they work in every market. New layers (Charleston schools, flood) become layer records + an adapter here — not `if (charleston)` in `page.tsx`.
