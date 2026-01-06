#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
cd workers/office-api-worker
# Requires wrangler context set to the right account/environment
wrangler d1 execute office-db --file ../../schemas/d1/schema.sql || true
echo "D1 schema applied (or attempted)."