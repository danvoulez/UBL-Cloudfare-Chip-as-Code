# Media & Video Contracts — UBL default (api.ubl.agency)

This pack presets `BASE_URL=https://api.ubl.agency` so you can run the smoke tests without editing.

## Files
- `http/stream_stage_smoke.http` — one‑screen low‑latency Stage flow (Prepare → Go Live → Snapshot → End).
- `http/stream_media_contract.http` — full contract sampler (presign, commit, descriptors, tokens).
- `scripts/smoke_stage.sh` — curl version of the Stage smoke test (idempotent).
- `mcp/examples/stream_mcp_examples.json` — JSON‑RPC frames for MCP testing against `/mcp` if you bridge to REST.

## Quick start
1) export your short‑lived API token:
   ```bash
   export TOKEN="REPLACE_ME"
   ```
2) Run the shell smoke (uses https://api.ubl.agency by default):
   ```bash
   bash scripts/smoke_stage.sh
   ```
3) Or open the `.http` files in VS Code/Insomnia and send in order.

You can override the URL at runtime:
```bash
BASE_URL="https://staging.api.ubl.agency" bash scripts/smoke_stage.sh
```
