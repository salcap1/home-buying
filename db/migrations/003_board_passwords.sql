-- Per-board password unlock + board rules + sale basis on assumptions.

ALTER TABLE home_buying.boards
  ADD COLUMN IF NOT EXISTS password_hash text,
  ADD COLUMN IF NOT EXISTS rules jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS boards_password_hash_uidx
  ON home_buying.boards (password_hash)
  WHERE password_hash IS NOT NULL;

ALTER TABLE home_buying.assumptions
  ADD COLUMN IF NOT EXISTS basis_paid numeric,
  ADD COLUMN IF NOT EXISTS basis_improvements numeric;
