CREATE TABLE IF NOT EXISTS home_buying.boards (
  id text PRIMARY KEY,
  name text NOT NULL,
  zip text NOT NULL DEFAULT '',
  radius_miles numeric NOT NULL DEFAULT 20,
  center_lat double precision,
  center_lng double precision,
  initial_disabled text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE home_buying.houses ADD COLUMN IF NOT EXISTS board_id text;
ALTER TABLE home_buying.assumptions ADD COLUMN IF NOT EXISTS board_id text;
ALTER TABLE home_buying.dismissed ADD COLUMN IF NOT EXISTS board_id text;

INSERT INTO home_buying.boards (id, name, zip, radius_miles, center_lat, center_lng, initial_disabled)
VALUES
  ('charlotte', 'Charlotte area', '28277', 35, 35.054, -80.851, ARRAY['Indian Land', 'Palisades']),
  ('nova', 'Northern Virginia', '22030', 20, 38.846, -77.307, ARRAY[]::text[])
ON CONFLICT (id) DO NOTHING;

UPDATE home_buying.houses SET board_id = 'charlotte' WHERE board_id IS NULL;
UPDATE home_buying.assumptions SET board_id = 'charlotte' WHERE board_id IS NULL;
UPDATE home_buying.dismissed SET board_id = 'charlotte' WHERE board_id IS NULL;

ALTER TABLE home_buying.assumptions DROP CONSTRAINT IF EXISTS assumptions_id_check;

INSERT INTO home_buying.assumptions (
  id, board_id, sale_price, payoff, extra_cash, keep_cash, current_housing, realtor_pct, other_selling_pct,
  closing_pct, term_years, tax_pct, pmi_pct, wife_income, nanny_cost, health_add_on, rate, extra_items, destinations
)
SELECT
  2, 'nova', sale_price, payoff, extra_cash, keep_cash, current_housing, realtor_pct, other_selling_pct,
  closing_pct, term_years, tax_pct, pmi_pct, wife_income, nanny_cost, health_add_on, rate, extra_items, '[]'::jsonb
FROM home_buying.assumptions
WHERE board_id = 'charlotte'
  AND NOT EXISTS (SELECT 1 FROM home_buying.assumptions WHERE board_id = 'nova')
LIMIT 1;

CREATE TABLE IF NOT EXISTS home_buying.board_zones (
  board_id text NOT NULL REFERENCES home_buying.boards (id),
  geoid text NOT NULL,
  name text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT true,
  PRIMARY KEY (board_id, geoid)
);
