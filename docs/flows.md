# Flows

How the board screen moves data today. File ownership is [codebase.md](codebase.md). Read the section you are changing, then open that function.

`app/page.tsx` is one client component. `activeId === "overview"` is the shortlist. Any other id is the open house. Draft rows exist only in React until the first save (`isDraft`).

## Boot

`GET /api/session` (`app/api/session/route.ts`).

- Without a signed unlock cookie the response is `{ unlocked: false }`. The app shows a sign-in / create-account splash and does not render the board.
- `POST /api/session` with `{ password, mode: "sign_in" | "create" }` unlocks or creates one board (password only; unique among accounts).
- Then `GET /api/assumptions` and `GET /api/houses` for that board. `PATCH` renames it. `DELETE /api/session` signs out.

`GET /api/areas` loads counties for the tab. `POST /api/districts` returns the Census school district boundary for each house pin.

## Add a listing

Paste URL → `pullUrl` in `page.tsx`.

1. `POST /api/listing` calls `pullListing` in `lib/listing.ts`. It fetches the page, then mirror pages when price, tax, HOA, or insurance is missing. Carolinas also try Palmetto Park. Virginia, Maryland, and DC also try the Long & Foster city search, up to eight pages. A Coldwell city result is used only when the street matches. It does not write the database.
2. `listingPatch` copies price, facts, schools, and photo onto the draft. Missing coordinates go through `POST /api/geo` (`geocodeAddress` in `lib/geo.ts`), limited to the tab's selected counties.
3. A draft is `POST /api/houses`. A remembered dismissal returns `409` with `reason: "dismissed"` until the client sends `restore: true`, which forgets that dismissal and adds the house. The route sets the down payment with `defaultDown` from `lib/calc.ts`.
4. An existing house is `PUT /api/houses/:id` through `updateHouse`, which debounces the save.

Redfin CSV → `importCsv` → `POST /api/houses/import`.

The import route parses with `lib/redfin-csv.ts`, skips dismissed rows unless `restoreDismissed` is set, drops unavailable matches, and skips coordinates outside selected counties. Matches update price and community. New rows are inserted, then the client calls `POST /api/listing` once per created URL and patches the house. An unavailable pull deletes with `?remember=0` so it is not remembered as a dismissal.

`DELETE /api/houses/:id` remembers the house in `dismissed` unless `remember=0`.

## Fill-in after the shortlist is showing

These start when the overview is open. Each loops while `remaining` is non-zero. Do not add another scraper in `page.tsx`. Extend the route's library call.

| Loop | Route | What it fills | Library |
|---|---|---|---|
| Photos | `POST /api/houses/photos` | `og:image` on houses with a URL and no photo | HTML read in the route |
| Costs | `POST /api/houses/costs` | Monthly tax and insurance | `pullListing` |
| Facts | `POST /api/houses/facts` | Beds, baths, sqft, lot, DOM, community, school names. Three houses per call | `pullListing`, then `findSchools`, then a neighbor in the same community |
| School pins | `POST /api/schools/locate` | Lat/lng for named schools. Four schools per call | `locateHouseSchools` in `lib/schools.ts` |
| Ratings | `POST /api/schools/refresh` | GreatSchools rating when a name has no rating. Once per overview visit | `refreshHouseSchools` |

Opening one house calls `POST /api/schools` when names or ratings are missing. That route decorates schools already on the house, otherwise `pullListing`, otherwise `findSchools`. Ratings are cached on the store (`store.ratings`), shared across boards.

`GET /api/houses/refresh` refreshes listing prices for the **signed-in** board. `refreshRedfinListing` updates price or removes an unavailable listing. It is not the paste path and is not a scheduled cron.

## Map and commute

| Screen need | Call | Module |
|---|---|---|
| Drive times for the open house | `POST /api/geo` with `origin` and `destinations` | `lib/geo.ts` |
| Drive time from each shortlist pin to the first saved place | One `POST /api/geo` with `origins` and `destinations` | `driveMatrix` in `lib/geo.ts` |
| School district boundary for each pin | `POST /api/districts` | `lib/layers/school-districts.ts` |
| County on/off | `PATCH /api/areas` | `store.areas`, geometry from `lib/layers/counties.ts` |

`OverviewMap` and `ListingMap` draw the geometries and pins they are given.

## Money

`analyzeHouse(house, assumptions)` in `lib/calc.ts` is the only payment figure. The overview memo uses it per row. Down payment defaults from sale proceeds (`saleFigures` → `defaultDown`). Sale basis and keep-cash come from board assumptions. `lib/filters.ts` `skipReasons` reads `boards.rules` and `initial_disabled` (max housing, max drive, excluded schools).

## `page.tsx` landmarks

Jump here instead of reading the file.

| Where | What |
|---|---|
| Helpers above `Page` | Sort, draft rows, school tips, field chrome |
| Boot `useEffect` | Session, then assumptions and houses |
| Memos after that | `analysis`, hidden rows, map pins |
| Geo and district effects | Geocode, commute, destination drive times, district polygons |
| Area and district effects | Counties, then school districts |
| Fill-in effects | Photos, costs, facts, school locate, ratings |
| `updateHouse` / `persistAssumptions` | Debounced `PUT` |
| `pullUrl` / `importCsv` | Add paths above |
| `unlockBoard` / `lockBoard` | Password session cookies |
| Return JSX | Tab switcher, overview table, house editor |
