# `lib/providers`

Listing ingest adapters. The UI should call a provider, not Redfin HTML.

Planned: `url` (current scrape in `lib/listing.js`), `redfin_csv` (`lib/redfin-csv.js`), later `mls`. Do not move those files here until a provider interface exists. Do not add more scrapers as a stand-in for MLS.
