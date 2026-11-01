-- One search board per password/account. Extra boards on a key are unlinked.

UPDATE home_buying.boards b
SET access_key_id = NULL
WHERE access_key_id IS NOT NULL
  AND id <> (
    SELECT id
    FROM home_buying.boards
    WHERE access_key_id = b.access_key_id
    ORDER BY created_at
    LIMIT 1
  );

CREATE UNIQUE INDEX IF NOT EXISTS boards_one_per_access_key_uidx
  ON home_buying.boards (access_key_id)
  WHERE access_key_id IS NOT NULL;
