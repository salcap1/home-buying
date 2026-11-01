# `tests`

Vitest unit tests for domain logic under `lib/` (payments, auth/session, tenancy, filters, listing helpers).

```bash
npm test
npm run test:watch
npm run test:coverage   # writes coverage/ + refreshes .github/badges/coverage.svg via npm run coverage:badge
```

Coverage thresholds live in `vitest.config.mts` and apply to `lib/**` (themes, map layers, and a few UI helpers are excluded). UI (`app/page.tsx`) is not covered yet — prefer domain tests until the board screen stabilizes. Do not add Playwright until there is a board UI worth smoking.
