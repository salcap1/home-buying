CREATE TABLE IF NOT EXISTS home_buying.board_areas (
  board_id text NOT NULL REFERENCES home_buying.boards (id),
  geoid text NOT NULL,
  name text NOT NULL DEFAULT '',
  PRIMARY KEY (board_id, geoid)
);
