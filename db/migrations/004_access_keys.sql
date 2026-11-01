-- One password unlocks a workspace (all linked search tabs), not each tab.

CREATE TABLE IF NOT EXISTS home_buying.access_keys (
  id text PRIMARY KEY,
  password_hash text NOT NULL,
  label text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS access_keys_password_hash_uidx
  ON home_buying.access_keys (password_hash);

ALTER TABLE home_buying.boards
  ADD COLUMN IF NOT EXISTS access_key_id text REFERENCES home_buying.access_keys (id);

-- Move any existing per-board password onto a shared personal key and link both tabs.
INSERT INTO home_buying.access_keys (id, password_hash, label)
SELECT 'personal', password_hash, 'Personal boards'
FROM home_buying.boards
WHERE id = 'charlotte' AND password_hash IS NOT NULL
ON CONFLICT (id) DO UPDATE SET password_hash = EXCLUDED.password_hash;

UPDATE home_buying.boards
SET access_key_id = 'personal'
WHERE id IN ('charlotte', 'nova')
  AND EXISTS (SELECT 1 FROM home_buying.access_keys WHERE id = 'personal');

DROP INDEX IF EXISTS home_buying.boards_password_hash_uidx;
ALTER TABLE home_buying.boards DROP COLUMN IF EXISTS password_hash;
