#!/bin/bash
# Blueprint 15 — JSON✯Atomic Schema Validation
# Validates all schemas and examples

set -euo pipefail

SCHEMAS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXAMPLES_DIR="${SCHEMAS_DIR}/examples"

if ! command -v ajv &> /dev/null; then
  echo "❌ ajv-cli not found. Install with: npm i -g ajv-cli"
  exit 1
fi

echo "🔍 Validating JSON✯Atomic schemas..."
echo ""

# Office events
echo "📋 Validating office.tool_call..."
ajv validate -s "${SCHEMAS_DIR}/ledger.office.tool_call.schema.json" -d "${EXAMPLES_DIR}/office_tool_call.json" || exit 1

echo "📋 Validating office.event..."
ajv validate -s "${SCHEMAS_DIR}/ledger.office.event.schema.json" -d "${EXAMPLES_DIR}/office_event.json" || exit 1

echo "📋 Validating office.handover..."
ajv validate -s "${SCHEMAS_DIR}/ledger.office.handover.schema.json" -d "${EXAMPLES_DIR}/office_handover.json" || exit 1

# Media events
echo "📋 Validating media.upload.presigned..."
ajv validate -s "${SCHEMAS_DIR}/ledger.media.upload.presigned.schema.json" -d "${EXAMPLES_DIR}/media_upload_presigned.json" || exit 1

echo "📋 Validating media.ingest.started..."
ajv validate -s "${SCHEMAS_DIR}/ledger.media.ingest.started.schema.json" -d "${EXAMPLES_DIR}/media_ingest_started.json" || exit 1

echo "📋 Validating media.ingest.completed..."
ajv validate -s "${SCHEMAS_DIR}/ledger.media.ingest.completed.schema.json" -d "${EXAMPLES_DIR}/media_ingest_completed.json" || exit 1

echo "📋 Validating media.playback.granted..."
ajv validate -s "${SCHEMAS_DIR}/ledger.media.playback.granted.schema.json" -d "${EXAMPLES_DIR}/media_playback_granted.json" || exit 1

echo "📋 Validating media.retention.applied..."
ajv validate -s "${SCHEMAS_DIR}/ledger.media.retention.applied.schema.json" -d "${EXAMPLES_DIR}/media_retention_applied.json" || exit 1

echo ""
echo "✅✅✅ All schemas validated successfully!"
