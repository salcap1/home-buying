import { verifyPassword } from "@/lib/auth/password";
import type { BoardRule } from "@/lib/types";
import { findDismissed, houseKeys } from "@/lib/redfin-csv";
import { DataError, withData } from "../errors";
import { mapAssumptions, mapHouse } from "../mappers";
import type { BoardArea, DataStore, DismissedKey, HouseSummary, SchoolRating, SearchTab } from "../store";
import { neonSql } from "./client";

export const DEFAULT_DOWN = 0;

function mapRules(value: unknown): BoardRule[] {
  let items = value;
  if (typeof items === "string") {
    try {
      items = JSON.parse(items);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(items)) return [];
  return items.filter(
    (item): item is BoardRule =>
      item &&
      typeof item === "object" &&
      (item.kind === "max_housing" || item.kind === "max_drive" || item.kind === "exclude_school")
  );
}

function mapBoard(row: any): SearchTab {
  return {
    id: row.id,
    name: row.name,
    zip: row.zip || "",
    radiusMiles: Number(row.radius_miles) || 0,
    centerLat: row.center_lat == null ? null : Number(row.center_lat),
    centerLng: row.center_lng == null ? null : Number(row.center_lng),
    excludeSchools: Array.isArray(row.initial_disabled) ? row.initial_disabled.map(String) : [],
    rules: mapRules(row.rules),
  };
}

export function createNeonStore(boardId = "charlotte"): DataStore {
  const db = neonSql();
  const board = boardId;

  return {
    provider: "neon",
    houses: {
      list: () =>
        withData("list houses", async () => {
          const rows = await db`SELECT * FROM home_buying.houses WHERE board_id = ${board} ORDER BY sort_order, created_at`;
          return rows.map(mapHouse);
        }),
      get: (id) =>
        withData("get house", async () => {
          const rows = await db`SELECT * FROM home_buying.houses WHERE id = ${id} AND board_id = ${board}`;
          return rows[0] ? mapHouse(rows[0]) : null;
        }),
      create: (input, down) =>
        withData("create house", async () => {
          const rows = await db`
            INSERT INTO home_buying.houses (board_id, name, url, price, down_dollars, rate, insurance_monthly, tax_monthly, hoa, update_cash, extra_items, lat, lng, schools, facts, photo, notes, sort_order, hearted)
            VALUES (
              ${board},
              ${input.name || "New house"},
              ${input.url || null},
              ${input.price || 0},
              ${down || DEFAULT_DOWN},
              ${input.rate || 6.5},
              ${input.insuranceMonthly || 0},
              ${input.taxMonthly == null || input.taxMonthly === "" ? null : input.taxMonthly},
              ${input.hoa || 0},
              ${input.updateCash || 0},
              ${JSON.stringify(input.extraItems || [])}::jsonb,
              ${input.lat == null || input.lat === "" ? null : input.lat},
              ${input.lng == null || input.lng === "" ? null : input.lng},
              ${JSON.stringify(input.schools || {})}::jsonb,
              ${JSON.stringify(input.facts || {})}::jsonb,
              ${input.photo || null},
              ${input.notes || ""},
              COALESCE((SELECT max(sort_order) + 1 FROM home_buying.houses WHERE board_id = ${board}), 0),
              ${Boolean(input.hearted)}
            )
            RETURNING *
          `;
          return mapHouse(rows[0]);
        }),
      update: (id, input) =>
        withData("update house", async () => {
          const rows = await db`
            UPDATE home_buying.houses SET
              name = ${input.name},
              url = ${input.url || null},
              price = ${input.price},
              down_dollars = ${input.downDollars},
              rate = ${input.rate},
              insurance_monthly = ${input.insuranceMonthly},
              tax_monthly = ${input.taxMonthly == null || input.taxMonthly === "" ? null : input.taxMonthly},
              hoa = ${input.hoa},
              update_cash = ${input.updateCash || 0},
              extra_items = ${JSON.stringify(input.extraItems || [])}::jsonb,
              lat = ${input.lat == null || input.lat === "" ? null : input.lat},
              lng = ${input.lng == null || input.lng === "" ? null : input.lng},
              schools = ${JSON.stringify(input.schools || {})}::jsonb,
              facts = ${JSON.stringify(input.facts || {})}::jsonb,
              photo = ${input.photo || null},
              notes = ${input.notes || ""},
              hearted = ${Boolean(input.hearted)},
              updated_at = now()
            WHERE id = ${id} AND board_id = ${board}
            RETURNING *
          `;
          return rows[0] ? mapHouse(rows[0]) : null;
        }),
      setHearted: (id, hearted) =>
        withData("set hearted", async () => {
          const rows = await db`
            UPDATE home_buying.houses
            SET hearted = ${Boolean(hearted)}, updated_at = now()
            WHERE id = ${id} AND board_id = ${board}
            RETURNING *
          `;
          return rows[0] ? mapHouse(rows[0]) : null;
        }),
      remove: (id) =>
        withData("remove house", async () => {
          await db`DELETE FROM home_buying.houses WHERE id = ${id} AND board_id = ${board}`;
        }),
      touch: (id) =>
        withData("touch house", async () => {
          await db`UPDATE home_buying.houses SET updated_at = now() WHERE id = ${id} AND board_id = ${board}`;
        }),
      mergeDistrict: (id, district, districtGeoid) =>
        withData("merge district", async () => {
          await db`
            UPDATE home_buying.houses
            SET
              facts = COALESCE(facts, '{}'::jsonb) || ${JSON.stringify({ district, districtGeoid })}::jsonb,
              updated_at = now()
            WHERE id = ${id} AND board_id = ${board}
          `;
        }),
      updateFactsAndSchools: (id, facts, schools) =>
        withData("update facts", async () => {
          const rows = await db`
            UPDATE home_buying.houses
            SET
              facts = ${JSON.stringify(facts)}::jsonb,
              schools = ${JSON.stringify(schools)}::jsonb,
              updated_at = now()
            WHERE id = ${id} AND board_id = ${board}
            RETURNING *
          `;
          return rows[0] ? mapHouse(rows[0]) : null;
        }),
      updatePhoto: (id, photo) =>
        withData("update photo", async () => {
          const rows = await db`
            UPDATE home_buying.houses
            SET photo = ${photo}, updated_at = now()
            WHERE id = ${id} AND board_id = ${board}
            RETURNING *
          `;
          return rows[0] ? mapHouse(rows[0]) : null;
        }),
      updateCosts: (id, taxMonthly, insuranceMonthly) =>
        withData("update costs", async () => {
          const rows = await db`
            UPDATE home_buying.houses
            SET
              tax_monthly = ${taxMonthly},
              insurance_monthly = ${insuranceMonthly},
              updated_at = now()
            WHERE id = ${id} AND board_id = ${board}
            RETURNING *
          `;
          return rows[0] ? mapHouse(rows[0]) : null;
        }),
      updatePriceUrl: (id, price, down, priceChanged, url) =>
        withData("update price", async () => {
          const rows = await db`
            UPDATE home_buying.houses
            SET
              price = ${price},
              down_dollars = CASE WHEN ${priceChanged} THEN ${down} ELSE down_dollars END,
              url = ${url},
              updated_at = now()
            WHERE id = ${id} AND board_id = ${board}
            RETURNING *
          `;
          return rows[0] ? mapHouse(rows[0]) : null;
        }),
      updateImportMatch: (id, price, down, priceChanged, community) =>
        withData("update import match", async () => {
          const rows = await db`
            UPDATE home_buying.houses
            SET
              price = ${price},
              down_dollars = CASE WHEN ${priceChanged} THEN ${down} ELSE down_dollars END,
              facts = CASE
                WHEN ${community} = '' THEN facts
                ELSE jsonb_set(COALESCE(facts, '{}'::jsonb), '{community}', ${JSON.stringify(community)}::jsonb)
              END,
              updated_at = now()
            WHERE id = ${id} AND board_id = ${board}
            RETURNING *
          `;
          if (!rows[0]) throw new DataError("House not found", "NOT_FOUND");
          return mapHouse(rows[0]);
        }),
      insertImported: (input, down) =>
        withData("insert imported house", async () => {
          const rows = await db`
            INSERT INTO home_buying.houses (board_id, name, url, price, down_dollars, rate, insurance_monthly, tax_monthly, hoa, update_cash, extra_items, lat, lng, schools, facts, sort_order)
            VALUES (
              ${board},
              ${input.name},
              ${input.url || null},
              ${input.price || 0},
              ${down || DEFAULT_DOWN},
              ${6.5},
              ${0},
              ${null},
              ${input.hoa || 0},
              ${0},
              ${JSON.stringify([])}::jsonb,
              ${input.lat},
              ${input.lng},
              ${JSON.stringify({})}::jsonb,
              ${JSON.stringify(input.facts || {})}::jsonb,
              COALESCE((SELECT max(sort_order) + 1 FROM home_buying.houses WHERE board_id = ${board}), 0)
            )
            RETURNING *
          `;
          return mapHouse(rows[0]);
        }),
      listSummaries: () =>
        withData("list house summaries", async () => {
          const rows = await db`SELECT id, name, url, price, update_cash FROM home_buying.houses WHERE board_id = ${board}`;
          return rows as HouseSummary[];
        }),
      listRefreshTargets: () =>
        withData("list refresh targets", async () => {
          const rows = await db`
            SELECT id, name, url, price, update_cash
            FROM home_buying.houses
            WHERE board_id = ${board}
            ORDER BY sort_order, created_at
          `;
          return rows as HouseSummary[];
        }),
      listNeedingPhotos: () =>
        withData("list houses needing photos", async () => {
          return (await db`
            SELECT id, url FROM home_buying.houses
            WHERE board_id = ${board} AND url IS NOT NULL AND coalesce(photo, '') = ''
            ORDER BY updated_at
            LIMIT 8
          `) as { id: string; url: string }[];
        }),
      countNeedingPhotos: () =>
        withData("count houses needing photos", async () => {
          const left = await db`
            SELECT count(*)::int AS remaining
            FROM home_buying.houses
            WHERE board_id = ${board} AND url IS NOT NULL AND coalesce(photo, '') = ''
          `;
          return left[0]?.remaining || 0;
        }),
      listNeedingCosts: () =>
        withData("list houses needing costs", async () => {
          return await db`
            SELECT id, url, name, tax_monthly, insurance_monthly
            FROM home_buying.houses
            WHERE board_id = ${board}
              AND url IS NOT NULL
              AND (
                tax_monthly IS NULL
                OR insurance_monthly IS NULL
                OR insurance_monthly = 0
              )
            ORDER BY updated_at
            LIMIT 4
          `;
        }),
      countNeedingCosts: () =>
        withData("count houses needing costs", async () => {
          const left = await db`
            SELECT count(*)::int AS remaining
            FROM home_buying.houses
            WHERE board_id = ${board}
              AND url IS NOT NULL
              AND (
                tax_monthly IS NULL
                OR insurance_monthly IS NULL
                OR insurance_monthly = 0
              )
          `;
          return left[0]?.remaining || 0;
        }),
      listFactSources: () =>
        withData("list fact sources", async () => {
          return await db`
            SELECT id, name, url, facts, schools
            FROM home_buying.houses
            WHERE board_id = ${board}
              AND (url IS NOT NULL OR name IS NOT NULL)
            ORDER BY updated_at
          `;
        }),
      listAllFactSources: () =>
        withData("list all fact sources", async () => {
          return await db`SELECT id, facts, schools FROM home_buying.houses WHERE board_id = ${board}`;
        }),
      findNeighborSchools: (id, community) =>
        withData("find neighbor schools", async () => {
          const neighbors = await db`
            SELECT schools
            FROM home_buying.houses
            WHERE board_id = ${board}
              AND id <> ${id}
              AND facts->>'community' = ${community}
              AND coalesce(schools->'high'->>'name', '') <> ''
            LIMIT 1
          `;
          return neighbors[0]?.schools ?? null;
        }),
      saveSchools: (id, schools) =>
        withData("save house schools", async () => {
          const saved = await db`
            UPDATE home_buying.houses
            SET schools = ${JSON.stringify(schools)}::jsonb, updated_at = now()
            WHERE id = ${id} AND board_id = ${board}
            RETURNING *
          `;
          if (!saved[0]) throw new DataError("House not found", "NOT_FOUND");
          return mapHouse(saved[0]);
        }),
    },
    assumptions: {
      get: () =>
        withData("get assumptions", async () => {
          const rows = await db`SELECT * FROM home_buying.assumptions WHERE board_id = ${board} ORDER BY id LIMIT 1`;
          if (!rows[0]) throw new DataError("Assumptions not found", "NOT_FOUND");
          return mapAssumptions(rows[0]);
        }),
      update: (input) =>
        withData("update assumptions", async () => {
          const before = await db`SELECT * FROM home_buying.assumptions WHERE board_id = ${board} ORDER BY id LIMIT 1`;
          const prev = mapAssumptions(before[0]);
          const extraItems = JSON.stringify(input.extraItems || []);
          const rows = await db`
            UPDATE home_buying.assumptions SET
              sale_price = ${input.salePrice},
              payoff = ${input.payoff},
              extra_cash = ${input.extraCash},
              keep_cash = ${input.keepCash ?? prev.keepCash},
              current_housing = ${input.currentHousing},
              realtor_pct = ${input.listingAgentPct},
              other_selling_pct = ${input.buyerAgentPct},
              other_selling_fees = ${input.otherSellingFees ?? prev.otherSellingFees},
              closing_pct = ${input.closingPct},
              term_years = ${input.termYears},
              tax_pct = ${input.taxPct},
              pmi_pct = ${input.pmiPct},
              rate = ${input.rate ?? 6.5},
              extra_items = ${extraItems}::jsonb,
              destinations = ${JSON.stringify(input.destinations || [])}::jsonb,
              basis_paid = ${input.basisPaid ?? prev.basisPaid ?? null},
              basis_improvements = ${input.basisImprovements ?? prev.basisImprovements ?? null},
              updated_at = now()
            WHERE board_id = ${board}
            RETURNING *
          `;
          return mapAssumptions(rows[0]);
        }),
      applyCashToDownPayments: (cashAvailable, closingPct) =>
        withData("apply cash to down payments", async () => {
          await db`
            UPDATE home_buying.houses
            SET
              down_dollars = GREATEST(
                0,
                LEAST(
                  price,
                  ROUND(${cashAvailable} - price * (${closingPct} / 100.0) - COALESCE(update_cash, 0))
                )
              ),
              updated_at = now()
            WHERE board_id = ${board}
          `;
        }),
    },
    dismissed: {
      remember: (house) =>
        withData("remember dismissed", async () => {
          const keys = houseKeys(house);
          if (!keys.url && !keys.address) return;
          await db`
            INSERT INTO home_buying.dismissed (board_id, url_key, address_key, name)
            VALUES (${board}, ${keys.url || null}, ${keys.address || null}, ${house.name || null})
          `;
        }),
      listKeys: () =>
        withData("list dismissed keys", async () => {
          return (await db`SELECT url_key, address_key, name FROM home_buying.dismissed WHERE board_id = ${board}`) as DismissedKey[];
        }),
      forget: (house) =>
        withData("forget dismissed", async () => {
          const rows = (await db`
            SELECT url_key, address_key, name FROM home_buying.dismissed WHERE board_id = ${board}
          `) as DismissedKey[];
          const matches = rows.filter((row) => findDismissed(house, [row]));
          for (const match of matches) {
            if (match.url_key) {
              await db`DELETE FROM home_buying.dismissed WHERE board_id = ${board} AND url_key = ${match.url_key}`;
            }
            if (match.address_key) {
              await db`DELETE FROM home_buying.dismissed WHERE board_id = ${board} AND address_key = ${match.address_key}`;
            }
          }
        }),
    },
    boards: {
      list: () =>
        withData("list boards", async () => {
          const rows = await db`
            SELECT id, name, zip, radius_miles, center_lat, center_lng, initial_disabled, rules
            FROM home_buying.boards
            ORDER BY created_at
          `;
          return rows.map(mapBoard);
        }),
      listByAccessKey: (accessKeyId) =>
        withData("list boards by access key", async () => {
          if (!accessKeyId) return [];
          const rows = await db`
            SELECT id, name, zip, radius_miles, center_lat, center_lng, initial_disabled, rules
            FROM home_buying.boards
            WHERE access_key_id = ${accessKeyId}
            ORDER BY created_at
          `;
          return rows.map(mapBoard);
        }),
      get: (id) =>
        withData("get board", async () => {
          const rows = await db`
            SELECT id, name, zip, radius_miles, center_lat, center_lng, initial_disabled, rules, access_key_id
            FROM home_buying.boards
            WHERE id = ${id}
          `;
          return rows[0] ? mapBoard(rows[0]) : null;
        }),
      rename: (id, name) =>
        withData("rename board", async () => {
          const rows = await db`
            UPDATE home_buying.boards
            SET name = ${name}
            WHERE id = ${id}
            RETURNING id, name, zip, radius_miles, center_lat, center_lng, initial_disabled, rules
          `;
          return rows[0] ? mapBoard(rows[0]) : null;
        }),
      unlockByPassword: (password) =>
        withData("unlock workspace by password", async () => {
          if (!password) return null;
          const keys = await db`
            SELECT id, password_hash
            FROM home_buying.access_keys
          `;
          let accessKeyId = "";
          for (const key of keys) {
            if (verifyPassword(password, key.password_hash)) {
              accessKeyId = key.id;
              break;
            }
          }
          if (!accessKeyId) return null;
          // One board per password/account.
          const rows = await db`
            SELECT id, name, zip, radius_miles, center_lat, center_lng, initial_disabled, rules
            FROM home_buying.boards
            WHERE access_key_id = ${accessKeyId}
            ORDER BY created_at
            LIMIT 1
          `;
          return { accessKeyId, boards: rows.map(mapBoard) };
        }),
      createWorkspace: (passwordHash) =>
        withData("create workspace", async () => {
          const accessKeyId = crypto.randomUUID();
          const boardId = crypto.randomUUID();
          await db`
            INSERT INTO home_buying.access_keys (id, password_hash, label)
            VALUES (${accessKeyId}, ${passwordHash}, 'Workspace')
          `;
          await db`
            INSERT INTO home_buying.boards (id, name, zip, radius_miles, center_lat, center_lng, initial_disabled, rules, access_key_id)
            VALUES (
              ${boardId},
              'My search',
              '',
              20,
              null,
              null,
              ${[] as string[]},
              '[]'::jsonb,
              ${accessKeyId}
            )
          `;
          const nextId = await db`SELECT COALESCE(MAX(id), 0) + 1 AS id FROM home_buying.assumptions`;
          const assumptionsId = Number(nextId[0]?.id) || 1;
          await db`
            INSERT INTO home_buying.assumptions (
              id, board_id, sale_price, payoff, extra_cash, keep_cash, current_housing,
              realtor_pct, other_selling_pct, other_selling_fees, closing_pct, term_years, tax_pct, pmi_pct,
              wife_income, nanny_cost, health_add_on, rate, extra_items, destinations,
              basis_paid, basis_improvements
            ) VALUES (
              ${assumptionsId}, ${boardId},
              0, 0, 0, 0, 0,
              0, 0, 0, 0, 30, 0, 0,
              0, 0, 0, 6.5, '[]'::jsonb, '[]'::jsonb,
              null, null
            )
          `;
          const rows = await db`
            SELECT id, name, zip, radius_miles, center_lat, center_lng, initial_disabled, rules
            FROM home_buying.boards
            WHERE id = ${boardId}
          `;
          return { accessKeyId, boards: rows.map(mapBoard) };
        }),
      setAccessPassword: (accessKeyId, passwordHash, boardIds) =>
        withData("set access password", async () => {
          await db`
            INSERT INTO home_buying.access_keys (id, password_hash, label)
            VALUES (${accessKeyId}, ${passwordHash}, ${accessKeyId})
            ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash
          `;
          if (boardIds.length) {
            await db`
              UPDATE home_buying.boards
              SET access_key_id = ${accessKeyId}
              WHERE id = ANY(${boardIds})
            `;
          }
        }),
    },
    areas: {
      list: (id) =>
        withData("list areas", async () => {
          const rows = await db`
            SELECT geoid, name
            FROM home_buying.board_areas
            WHERE board_id = ${id}
            ORDER BY name
          `;
          return rows.map((row) => ({ geoid: row.geoid, name: row.name || "" }) as BoardArea);
        }),
      setSelected: (id, geoid, name, selected) =>
        withData("set area", async () => {
          if (!selected) {
            await db`DELETE FROM home_buying.board_areas WHERE board_id = ${id} AND geoid = ${geoid}`;
            return;
          }
          await db`
            INSERT INTO home_buying.board_areas (board_id, geoid, name)
            VALUES (${id}, ${geoid}, ${name})
            ON CONFLICT (board_id, geoid) DO UPDATE SET name = excluded.name
          `;
        }),
    },
    ratings: {
      find: (nameKey, level, state) =>
        withData("find school rating", async () => {
          const rows = await db`
            SELECT name, rating, url, source
            FROM home_buying.school_ratings
            WHERE name_key = ${nameKey} AND level = ${level} AND (state = ${state || ""} OR state = '')
            ORDER BY CASE WHEN state = ${state || ""} THEN 0 ELSE 1 END
            LIMIT 1
          `;
          const row = rows[0];
          if (!row || row.rating == null) return null;
          return {
            name: row.name,
            rating: Number(row.rating),
            url: row.url || "",
            source: row.source || "GreatSchools",
          } as SchoolRating;
        }),
      save: (nameKey, level, state, rated) =>
        withData("save school rating", async () => {
          await db`
            INSERT INTO home_buying.school_ratings (name_key, level, state, name, rating, url, source)
            VALUES (${nameKey}, ${level}, ${state || ""}, ${rated.name}, ${rated.rating}, ${rated.url || ""}, ${rated.source || "GreatSchools"})
            ON CONFLICT (name_key, level, state)
            DO UPDATE SET
              name = excluded.name,
              rating = excluded.rating,
              url = excluded.url,
              source = excluded.source,
              updated_at = now()
          `;
        }),
    },
  };
}
