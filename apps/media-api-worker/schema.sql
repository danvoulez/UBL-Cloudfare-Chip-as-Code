-- D1 Media Database Schema
-- Blueprint 10 — Media & Video

CREATE TABLE IF NOT EXISTS media (
  id TEXT PRIMARY KEY,
  tenant TEXT NOT NULL,
  room_id TEXT,
  r2_key TEXT NOT NULL,
  mime TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  sha256 TEXT,
  thumb_media_id TEXT,
  created_at TEXT NOT NULL,
  committed_at TEXT,
  status TEXT NOT NULL, -- pending, committed, expired
  retention_policy TEXT DEFAULT 'standard' -- ephemeral, standard, archival
);

CREATE INDEX IF NOT EXISTS idx_media_tenant_room ON media(tenant, room_id);
CREATE INDEX IF NOT EXISTS idx_media_status ON media(status);
CREATE INDEX IF NOT EXISTS idx_media_created_at ON media(created_at);

CREATE TABLE IF NOT EXISTS stream_sessions (
  id TEXT PRIMARY KEY,
  tenant TEXT NOT NULL,
  mode TEXT NOT NULL, -- party, duo, circle, roulette, stage
  audience TEXT NOT NULL,
  title TEXT,
  state TEXT NOT NULL, -- prepared, publishing, live, ending, archived
  live BOOLEAN DEFAULT FALSE,
  recording BOOLEAN DEFAULT FALSE,
  playback_type TEXT, -- webrtc, ll-hls
  playback_url TEXT,
  sfu_url TEXT,
  ingest_url TEXT,
  created_at TEXT NOT NULL,
  live_at TEXT,
  ended_at TEXT,
  replay_media_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_stream_tenant_mode ON stream_sessions(tenant, mode);
CREATE INDEX IF NOT EXISTS idx_stream_state ON stream_sessions(state);
CREATE INDEX IF NOT EXISTS idx_stream_live ON stream_sessions(live);
CREATE INDEX IF NOT EXISTS idx_stream_created_at ON stream_sessions(created_at);
