/**
 * Blueprint 15 — JSON✯Atomic Canonicalizer
 * Ensures deterministic order: id, ts, kind, scope, actor, refs, data, meta, sig
 */

function canonicalize(atomic) {
  // Enforce order: id, ts, kind, scope, actor, refs, data, meta, sig
  return {
    id: atomic.id,
    ts: atomic.ts,
    kind: atomic.kind,
    scope: atomic.scope,
    actor: atomic.actor,
    refs: atomic.refs,
    data: atomic.data,
    meta: atomic.meta,
    sig: atomic.sig || null, // Always include sig (null if not signed)
  };
}

// CLI usage
if (require.main === module) {
  const fs = require('fs');
  const path = process.argv[2];
  
  if (!path) {
    console.error('Usage: node canonicalize.js <json-file>');
    process.exit(1);
  }
  
  const json = JSON.parse(fs.readFileSync(path, 'utf8'));
  const canon = canonicalize(json);
  console.log(JSON.stringify(canon, null, 2));
}

module.exports = { canonicalize };
