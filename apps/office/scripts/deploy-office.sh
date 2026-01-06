#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
( cd workers/office-api-worker && wrangler deploy )
( cd workers/office-indexer-worker && wrangler deploy )