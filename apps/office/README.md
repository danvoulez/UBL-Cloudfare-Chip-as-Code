# Office (File Office) — Drop 1 of 10

This is the initial skeleton for the Office (Cloudflare-only) package, aligned with the Universal Historical Specification (Parts I & II).

**What’s included in Drop 1**
- Minimal worker stubs (office-api-worker, office-indexer-worker)
- D1 schema (files, anchors, versions, receipts, handovers, entities)
- JSON Schemas (frame, lens, anchor, handover, ops, receipt)
- Example configs (constitution, lenses, origin allowlist, tenants)
- Basic MCP manifest and tools
- Scripts to apply schema, deploy, seed, and smoke

**Next drops**
- Drop 2: Implement frame_builder, lens_engine, evidence, narrative; flesh out routes
- Drop 3: Version graph + anchors extractor improvements; scheduled indexer jobs
- Drop 4: Evidence Mode responses + receipts signing pipeline
- Drop 5: Sanity Check + Dreaming Cycle scaffolding
- Drop 6: Metrics wiring + Grafana dashboard stub
- Drop 7: Admin endpoints + feature flags per tenant
- Drop 8: Full contract tests; e2e smoke
- Drop 9: Hardening (quotas, compression, cache policy)
- Drop 10: Polish, docs, and examples