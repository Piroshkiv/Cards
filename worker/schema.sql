CREATE TABLE IF NOT EXISTS packs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  cards TEXT NOT NULL DEFAULT '[]',
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  created_by TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS pack_owners (
  pack_id TEXT NOT NULL REFERENCES packs(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  PRIMARY KEY (pack_id, username)
);
