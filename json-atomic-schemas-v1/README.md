# JSON✯Atomic — Blueprint 15 (Data & Schemas)

Canonical schemas + examples + tiny reference canonicalizers for **JSON✯Atomic** events used by UBL/Office/Apps.

## Canonical field order (for signing)
1. id
2. ts
3. kind
4. scope
5. actor
6. refs
7. data
8. meta
9. sig

> JSON Schema cannot enforce order. Use the included canonicalizers to emit deterministic bytes before signing.

## Contents
- schemas/*.json — base envelope and office.* event schemas
- examples/*.json — ready-to-validate samples
- cli/*.ts — TypeScript canonicalize/sign/verify (tweetnacl)
- rust/lib.rs — minimal Rust canonicalizer
- scripts/validate.sh — AJV helper

## Quick start (TS)
```bash
cd cli
npm init -y >/dev/null 2>&1
npm i tweetnacl @types/node --silent
npx ts-node atomic_canonicalize.ts ../examples/office_tool_call.json > /tmp/canon.txt
npx ts-node sign.ts /tmp/canon.txt > /tmp/sig.json
# attach /tmp/sig.json as the event's `sig` and verify:
npx ts-node verify.ts /tmp/sig.json
```

## Proof-of-Done
- Validate examples against schemas.
- Canonicalize → sign → verify an example.
- Confirm field order in canonical output.
