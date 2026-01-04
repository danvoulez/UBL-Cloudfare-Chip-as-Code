
-- D1 schema for usage + charges + credits

CREATE TABLE IF NOT EXISTS usage_daily (
  tenant_id TEXT NOT NULL,
  day TEXT NOT NULL,            -- YYYYMMDD
  meter TEXT NOT NULL,
  qty INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, day, meter)
);

CREATE TABLE IF NOT EXISTS charges_monthly (
  tenant_id TEXT NOT NULL,
  month TEXT NOT NULL,          -- YYYYMM
  amount_cents INTEGER NOT NULL DEFAULT 0,
  detail_json TEXT NOT NULL,
  PRIMARY KEY (tenant_id, month)
);

CREATE TABLE IF NOT EXISTS credits_ledger (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  delta_cents INTEGER NOT NULL,
  reason TEXT NOT NULL,
  ts TEXT NOT NULL              -- ISO8601Z
);
