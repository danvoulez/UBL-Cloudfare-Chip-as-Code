-- Office D1 schema (SQLite)
CREATE TABLE IF NOT EXISTS entities (
  id TEXT PRIMARY KEY,
  created_at TEXT DEFAULT (datetime('now')),
  display_name TEXT,
  constitution_md TEXT
);

-- FILES (canônico)
CREATE TABLE IF NOT EXISTS files (
  id          TEXT PRIMARY KEY,
  path        TEXT NOT NULL,
  kind        TEXT NOT NULL DEFAULT 'blob',         -- ex: 'blob' | mime | 'pdf' | 'slide'
  canonical   INTEGER NOT NULL DEFAULT 0 CHECK (canonical IN (0,1)),
  size        INTEGER DEFAULT 0,                    -- em bytes (opcional)
  hash        TEXT,                                 -- sha256/etag opcional
  created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS anchors (
  id TEXT PRIMARY KEY,
  file_id TEXT,
  type TEXT, -- text|table|figure|slide|image
  location TEXT, -- e.g. "p12#t4-9" or "slide:9"
  preview TEXT,
  context TEXT,
  FOREIGN KEY(file_id) REFERENCES files(id)
);

CREATE TABLE IF NOT EXISTS versions (
  id TEXT PRIMARY KEY,
  family_id TEXT,
  file_id TEXT,
  parent_version_id TEXT,
  similarity REAL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(file_id) REFERENCES files(id)
);

CREATE TABLE IF NOT EXISTS receipts (
  id TEXT PRIMARY KEY,
  actor_id TEXT,
  op TEXT,
  payload_json TEXT,
  state_hash TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS handovers (
  id TEXT PRIMARY KEY,
  entity_id TEXT,
  summary TEXT, -- free-form narrative
  bookmarks_json TEXT, -- anchors/bookmarks
  claims_json TEXT, -- claims extracted (optional)
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(entity_id) REFERENCES entities(id)
);

-- Índices úteis
CREATE INDEX IF NOT EXISTS idx_files_path      ON files(path);
CREATE INDEX IF NOT EXISTS idx_files_canonical ON files(canonical);
CREATE UNIQUE INDEX IF NOT EXISTS ux_files_path ON files(path);
CREATE INDEX IF NOT EXISTS idx_anchors_file ON anchors(file_id);
CREATE INDEX IF NOT EXISTS idx_versions_family ON versions(family_id);

-- Versão do schema (controle de migrações)
PRAGMA user_version = 1;