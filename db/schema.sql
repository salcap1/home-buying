-- Greenfield empty schema for a fresh Neon project.
-- Contributors: run `npm run db:setup` after setting your own DATABASE_URL.
-- No demo boards or live data. Create an account in the app to bootstrap a workspace.
-- When changing DDL, update this file and add a numbered migration under db/migrations/.

CREATE SCHEMA IF NOT EXISTS home_buying;

CREATE TABLE IF NOT EXISTS home_buying.access_keys (
  id text PRIMARY KEY,
  password_hash text NOT NULL,
  label text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS access_keys_password_hash_uidx
  ON home_buying.access_keys (password_hash);

CREATE TABLE IF NOT EXISTS home_buying.boards (
  id text PRIMARY KEY,
  name text NOT NULL,
  zip text NOT NULL DEFAULT '',
  radius_miles numeric NOT NULL DEFAULT 20,
  center_lat double precision,
  center_lng double precision,
  initial_disabled text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  access_key_id text REFERENCES home_buying.access_keys (id)
);

CREATE UNIQUE INDEX IF NOT EXISTS boards_one_per_access_key_uidx
  ON home_buying.boards (access_key_id)
  WHERE access_key_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS home_buying.board_areas (
  board_id text NOT NULL REFERENCES home_buying.boards (id),
  geoid text NOT NULL,
  name text NOT NULL DEFAULT '',
  PRIMARY KEY (board_id, geoid)
);

CREATE TABLE IF NOT EXISTS home_buying.houses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  url text,
  price numeric NOT NULL DEFAULT 0,
  down_dollars numeric NOT NULL DEFAULT 0,
  rate numeric NOT NULL DEFAULT 6.5,
  insurance_monthly numeric NOT NULL DEFAULT 0,
  hoa numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  update_cash numeric NOT NULL DEFAULT 0,
  extra_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  tax_monthly numeric,
  lat numeric,
  lng numeric,
  schools jsonb DEFAULT '{}'::jsonb,
  facts jsonb DEFAULT '{}'::jsonb,
  photo text,
  hearted boolean NOT NULL DEFAULT false,
  notes text NOT NULL DEFAULT '',
  board_id text
);

CREATE TABLE IF NOT EXISTS home_buying.assumptions (
  id integer PRIMARY KEY,
  sale_price numeric NOT NULL DEFAULT 0,
  payoff numeric NOT NULL DEFAULT 0,
  extra_cash numeric NOT NULL DEFAULT 0,
  current_housing numeric NOT NULL DEFAULT 0,
  realtor_pct numeric NOT NULL DEFAULT 0,
  other_selling_pct numeric NOT NULL DEFAULT 0,
  closing_pct numeric NOT NULL DEFAULT 0,
  term_years integer NOT NULL DEFAULT 30,
  tax_pct numeric NOT NULL DEFAULT 0,
  pmi_pct numeric NOT NULL DEFAULT 0,
  wife_income numeric NOT NULL DEFAULT 0,
  nanny_cost numeric NOT NULL DEFAULT 0,
  health_add_on numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  rate numeric DEFAULT 6.5,
  extra_items jsonb DEFAULT '[]'::jsonb,
  destinations jsonb DEFAULT '[]'::jsonb,
  keep_cash numeric NOT NULL DEFAULT 0,
  board_id text,
  basis_paid numeric,
  basis_improvements numeric,
  other_selling_fees numeric NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS home_buying.dismissed (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url_key text,
  address_key text,
  name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  board_id text
);

CREATE TABLE IF NOT EXISTS home_buying.school_ratings (
  name_key text NOT NULL,
  level text NOT NULL,
  state text NOT NULL DEFAULT '',
  name text NOT NULL,
  rating integer,
  url text,
  source text NOT NULL DEFAULT 'GreatSchools',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (name_key, level, state)
);
