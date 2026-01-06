-- UBL ID — Auth P0 Schema (D1)
-- Domínio raiz: ubl.agency
-- IdP: https://id.ubl.agency

-- Users (registro lógico; pode nascer só com id, criado por passkey)
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,   -- ulid() ou uuid v7
  username      TEXT UNIQUE,        -- opcional
  created_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Passkeys (WebAuthn)
CREATE TABLE IF NOT EXISTS passkeys (
  id              TEXT PRIMARY KEY,              -- credentialId (base64url)
  user_id         TEXT NOT NULL,
  public_key_cose BLOB NOT NULL,                 -- COSE key
  sign_count      INTEGER NOT NULL DEFAULT 0,
  transports      TEXT,                          -- csv
  created_at      INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_passkeys_user ON passkeys(user_id);

-- Sessions (cookie sid)
CREATE TABLE IF NOT EXISTS sessions (
  id           TEXT PRIMARY KEY,                 -- ulid()
  user_id      TEXT NOT NULL,
  csrf         TEXT NOT NULL,                    -- anti-CSRF
  ip_hash      TEXT,                             -- opcional, hash(IP||ua)
  expires_at   INTEGER NOT NULL,                 -- unix ts
  created_at   INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY(user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- Refresh tokens (rotating)
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id            TEXT PRIMARY KEY,                -- ulid()
  user_id       TEXT NOT NULL,
  session_id    TEXT NOT NULL,
  token_hash    TEXT NOT NULL,                   -- HMAC-SHA256(token)
  expires_at    INTEGER NOT NULL,
  used_at       INTEGER,                         -- para rotação
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(session_id) REFERENCES sessions(id)
);
CREATE INDEX IF NOT EXISTS idx_refresh_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_expires ON refresh_tokens(expires_at);

-- JWT revocation (por jti)
CREATE TABLE IF NOT EXISTS jwt_revocations (
  jti        TEXT PRIMARY KEY,
  reason     TEXT,
  revoked_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_revocations_revoked_at ON jwt_revocations(revoked_at);

-- ABAC policies (json)
CREATE TABLE IF NOT EXISTS abac_policies (
  id         TEXT PRIMARY KEY,                   -- ex: 'default'
  version    INTEGER NOT NULL,
  blob_json  TEXT NOT NULL,                      -- regras
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Device flow (para voulezvous.tv e outros domínios externos)
CREATE TABLE IF NOT EXISTS device_codes (
  device_code    TEXT PRIMARY KEY,                -- ulid()
  user_code      TEXT NOT NULL UNIQUE,            -- código exibido (8 chars)
  user_id        TEXT,                            -- preenchido após aprovação
  session_id     TEXT,                            -- criado após aprovação
  expires_at     INTEGER NOT NULL,
  approved_at    INTEGER,                         -- timestamp de aprovação
  created_at     INTEGER NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(session_id) REFERENCES sessions(id)
);
CREATE INDEX IF NOT EXISTS idx_device_user_code ON device_codes(user_code);
CREATE INDEX IF NOT EXISTS idx_device_expires ON device_codes(expires_at);

-- Inserir ABAC policy default
INSERT OR IGNORE INTO abac_policies (id, version, blob_json) VALUES (
  'default',
  1,
  '{
    "version": 1,
    "rules": [
      { "effect": "allow", "when": { "group": "ubl-ops" }, "action": "*", "resource": "*" },
      { "effect": "deny",  "when": { "tag:adult": true }, "action": "call:provider", "resource": "openai.*" },
      { "effect": "allow", "when": { "tag:adult": true }, "action": "call:provider", "resource": "lab.*" },
      { "effect": "allow", "when": {}, "action": "read", "resource": "office.*" }
    ]
  }'
);
