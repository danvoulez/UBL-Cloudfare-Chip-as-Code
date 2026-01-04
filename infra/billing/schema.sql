CREATE TABLE IF NOT EXISTS usage_daily (
  id TEXT PRIMARY KEY,
  tenant TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  quantity INTEGER NOT NULL DEFAULT 0,
  date TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_usage_tenant_date ON usage_daily (tenant, date);
CREATE INDEX IF NOT EXISTS idx_usage_resource ON usage_daily (resource_type, resource_id);
CREATE TABLE IF NOT EXISTS quotas (
  id TEXT PRIMARY KEY,
  tenant TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  limit_value INTEGER NOT NULL,
  period TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_quotas_tenant ON quotas (tenant, resource_type);
