# JSON✯Atomic — Media Add-on (v1)

This pack adds **media.*** ledger event schemas and examples to your Atomic set.

## Included
- `schemas/atomic.schema.json` (self-contained copy)
- `schemas/ledger.media.upload.presigned.schema.json`
- `schemas/ledger.media.ingest.started.schema.json`
- `schemas/ledger.media.ingest.completed.schema.json`
- `examples/*.json`

## How to use
1. Merge `schemas/` into your main Atomic `schemas/` folder (or keep as-is and reference relatively).
2. Validate examples with AJV:
   ```bash
   npx ajv validate -s schemas/ledger.media.upload.presigned.schema.json -d examples/media_upload_presigned.json
   npx ajv validate -s schemas/ledger.media.ingest.started.schema.json -d examples/media_ingest_started.json
   npx ajv validate -s schemas/ledger.media.ingest.completed.schema.json -d examples/media_ingest_completed.json
   ```

## Notes
- **Privacy-first**: all events are metadata-only (no plaintext content).
- **Deterministic**: use your canonicalization routine before signing.
- **Scope** is tenant-first; `entity/room/container` are optional.

## Proof of Done
- [ ] AJV pass on the three examples
- [ ] Events serialize with key order: `id, ts, kind, scope, actor, refs, data, meta, sig`
- [ ] Sign + verify succeeds on a canonicalized example
