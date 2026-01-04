# JSON✯Atomic Schemas — Blueprint 15

**Base canônica + schemas office.* + schemas media.* para trilhas imutáveis**

---

## 📋 Estrutura

```
schemas/
  atomic.schema.json                    # Base schema (id, ts, kind, scope, actor, refs, data, meta, sig)
  
  # Office events
  ledger.office.tool_call.schema.json
  ledger.office.event.schema.json
  ledger.office.handover.schema.json
  
  # Media events
  ledger.media.upload.presigned.schema.json
  ledger.media.ingest.started.schema.json
  ledger.media.ingest.completed.schema.json
  ledger.media.playback.granted.schema.json
  ledger.media.retention.applied.schema.json
  
  examples/
    office_tool_call.json
    office_event.json
    office_handover.json
    media_upload_presigned.json
    media_ingest_started.json
    media_ingest_completed.json
    media_playback_granted.json
    media_retention_applied.json
  
  cli/
    atomic_canonicalize.ts              # TypeScript canonicalizer
    sign.ts                              # Ed25519 signer (demo)
    verify.ts                            # Ed25519 verifier (demo)
  
  scripts/
    validate.sh                          # AJV validation
    canonicalize.js                      # Node.js canonicalizer (alternative)
```

---

## 🔍 Validação

### Requisitos:
```bash
npm i -g ajv-cli
```

### Validar todos:
```bash
cd schemas
bash scripts/validate.sh
```

### Validar individual:
```bash
npx ajv validate -s schemas/ledger.office.tool_call.schema.json -d examples/office_tool_call.json
npx ajv validate -s schemas/ledger.media.upload.presigned.schema.json -d examples/media_upload_presigned.json
```

---

## 📐 Ordem Canônica

**Top-level ordem obrigatória:**
```
id, ts, kind, scope, actor, refs, data, meta, sig
```

**Por quê?**
- Determinismo: mesma estrutura → mesmo byte string
- Assinatura: Ed25519 sobre bytes canônicos
- Hash: BLAKE3 do JSON canônico → `atomic_hash`

---

## 🔧 Canonicalização

### TypeScript (CLI):
```bash
cd cli
npm init -y >/dev/null 2>&1
npm i tweetnacl @types/node --silent
npx ts-node atomic_canonicalize.ts ../examples/office_tool_call.json > /tmp/canon.txt
npx ts-node sign.ts /tmp/canon.txt > /tmp/sig.json
npx ts-node verify.ts /tmp/sig.json
```

### Node.js (scripts):
```javascript
const { canonicalize } = require('./scripts/canonicalize.js');
const atomic = JSON.parse(fs.readFileSync('examples/media_upload_presigned.json'));
const canon = canonicalize(atomic);
console.log(JSON.stringify(canon, null, 2));
```

### Rust:
```rust
use apps::core_api::atomic::{Atomic, canonicalize};

let json = serde_json::json!({ /* ... */ });
let canon = canonicalize(&json);
let bytes = serde_json::to_vec(&canon)?;
let hash = blake3::hash(&bytes);
```

---

## 📝 Eventos

### Office:
- **`office.tool_call`** — Chamada de ferramenta MCP
- **`office.event`** — Evento interno (brief.updated, etc.)
- **`office.handover`** — Transferência de sessão

### Media:
- **`media.upload.presigned`** — R2 presign URL emitido
- **`media.ingest.started`** — Upload iniciado
- **`media.ingest.completed`** — Upload finalizado e verificado
- **`media.playback.granted`** — Signed URL emitido para playback (Blueprint 13)
- **`media.retention.applied`** — Política de retenção aplicada (Blueprint 13)

---

## 🔗 Integração

### Media API Worker:
- Emite `media.upload.presigned` em `handlePresign()`
- Emite `media.ingest.completed` em `handleCommit()`
- Eventos publicados na Queue `QUEUE_MEDIA_EVENTS`

### Core API (Rust):
- Módulo `apps/core-api/src/atomic/mod.rs`
- Funções: `canonicalize()`, `Atomic::to_canonical_bytes()`, `Atomic::hash()`
- Integração com handlers de eventos

### Gateway MCP:
- Emite `office.tool_call` em `tool_call()`
- Emite `office.event` em `brief_set()`
- Emite `office.handover` em transferências de sessão

---

## ✅ Proof of Done

- [ ] `bash scripts/validate.sh` → OK (todos os schemas)
- [ ] `atomic_canonicalize.ts` → ordem correta (id, ts, kind, ...)
- [ ] `sign.ts` + `verify.ts` → ok:true nos exemplos
- [ ] Eventos emitidos no Worker → Queue recebe JSON✯Atomic
- [ ] Hash BLAKE3 calculado e incluído no ledger

---

## 📚 Referências

- **Blueprint 15** — Data & Schemas (JSON✯Atomic)
- **Blueprint 10** — Media & Video (usa eventos media.*)
- **Blueprint 01** — Edge Gateway (usa eventos office.*)
- **CONSTITUTION.md** — Normas de trilhas imutáveis

---

## 📦 Pacotes Originais

Este repositório consolida:
- `json-atomic-schemas-v1` — Base + office.*
- `json-atomic-schemas-media-pack` — Media v1
- `json-atomic-schemas-media-pack-v2` — Media v2 (playback.granted, retention.applied)
