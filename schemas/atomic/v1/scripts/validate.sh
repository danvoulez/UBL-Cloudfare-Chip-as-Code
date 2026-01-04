#!/usr/bin/env bash
set -euo pipefail
if ! command -v ajv >/dev/null 2>&1; then echo 'npm i -g ajv-cli'; exit 1; fi
ajv validate -s schemas/ledger.office.tool_call.schema.json -d examples/office_tool_call.json
ajv validate -s schemas/ledger.office.event.schema.json -d examples/office_event.json
ajv validate -s schemas/ledger.office.handover.schema.json -d examples/office_handover.json
echo OK
