Blueprint 03 — Core API (Axum)

03) Core API (Axum) — negócio + presign R2 + átomos

1) Propósito

Serviço simples que:
	•	expõe endpoints de negócio (clients, projects, contracts);
	•	gera Átomos JSON✯Atomic para toda escrita (com atomic_hash);
	•	faz presign de uploads/downloads no R2;
	•	não implementa autorização: o chip decide antes (Edge/Proxy).

⸻

2) Interfaces (fase A → base funcional)
	•	GET /healthz → { ok:true }
	•	GET /whoami → ecoa identidade vinda do Access (Cf-Access-*)
	•	POST /files/presign/upload { key, content_type } → { url, headers, expires_in }
	•	POST /files/presign/download { key } → { url, expires_in }

2.1 Interfaces (fase B → domínio)
	•	POST /core/clients { name, email } → 201 { id, atomic_hash }
	•	GET  /core/clients/:id → { id, name, email, created_at, created_by, atomic_hash }
	•	POST /core/projects { client_id, name } → 201 { id, atomic_hash }
	•	POST /core/contracts { project_id, terms } → 201 { id, atomic_hash }
	•	GET  /core/projects/:id, GET /core/contracts/:id → idem

Toda escrita devolve atomic_hash. Leitura nunca vaza segredo.

⸻

3) Política (o que o chip já garantiu)
	•	ZeroTrust: TLS 1.3 + mTLS + Passkey
	•	Admin para /admin/** (grupo ubl-ops)
	•	Rate-limit leve e webhooks assinados (se aplicável)

A Core assume cabeçalhos confiáveis: Cf-Access-*, X-Policy-*.

⸻

4) JSON✯Atomic (forma canônica)

Campos ordenados:
id, ts, kind, scope, actor, refs, data, meta, sig

Exemplo (client-created):

{
  "id": "cl_01JABC...",
  "ts": "2026-01-03T13:45:12.345Z",
  "kind": "client.created",
  "scope": { "tenant": "ubl" },
  "actor": { "email": "dan@ubl.agency", "groups": ["ubl-ops"] },
  "refs": {},
  "data": { "name": "ACME", "email": "ops@acme.com" },
  "meta": { "service": "core-api@1.0.0" },
  "sig": null
}

	•	Hash: BLAKE3 do JSON canônico → atomic_hash.
	•	Assinatura: pode ser feita pelo Proxy/ledger (recomendado). A Core apenas calcula e retorna atomic_hash.

⸻

5) Dados/Estado (Postgres + R2)

5.1 Postgres (DDL mínima)

create table clients (
  id           text primary key,
  name         text not null,
  email        text not null,
  created_at   timestamptz not null default now(),
  created_by   text not null,              -- email do actor
  atomic_hash  text not null unique        -- BLAKE3 do átomo de criação
);

create table projects (
  id           text primary key,
  client_id    text not null references clients(id),
  name         text not null,
  created_at   timestamptz not null default now(),
  created_by   text not null,
  atomic_hash  text not null unique
);

create table contracts (
  id           text primary key,
  project_id   text not null references projects(id),
  terms        jsonb not null,
  created_at   timestamptz not null default now(),
  created_by   text not null,
  atomic_hash  text not null unique
);

-- eventos append-only (opcional, além do ledger em arquivo)
create table facts (
  seq          bigserial primary key,
  atomic_hash  text not null unique,
  kind         text not null,
  ts           timestamptz not null,
  actor_email  text not null,
  payload      jsonb not null
);
create index facts_ts_idx on facts(ts);

5.2 R2
	•	Bucket ubl-files com prefixos tenant/kind/id/...
	•	Presign feito pelo serviço (sem proxy de blobs pela API)

⸻

6) Contratos (OpenAPI esqueleto)
	•	Respostas sempre com traceId, atomic_hash (se escrita) e cache-control sensato.
	•	Erros canônicos: { code, message, cause?, action? } (sem plaintext sensível).

⸻

7) Esqueleto Axum (pontos-chave)
	•	middleware captura: Cf-Access-Authenticated-User-Email, Cf-Access-Groups, X-Request-Id
	•	gera actor, traceId e átomo canônico; computa BLAKE3; grava DB; emite fact (arquivo ou Proxy)

7.1 Funções utilitárias (pseudo-Rust curto)

fn canonical_json(value: &serde_json::Value) -> Vec<u8> {
    // usar serializer determinístico (ordem estável); pode usar serde_json::to_vec
    // se chavear manualmente a ordem dos campos do Atomic antes
    serde_json::to_vec(value).unwrap()
}

fn blake3_hash(bytes: &[u8]) -> String {
    use blake3::Hasher;
    let mut h = Hasher::new();
    h.update(bytes);
    h.finalize().to_hex().to_string()
}

fn make_atomic(kind: &str, actor: &Actor, scope: &Scope, refs: serde_json::Value, data: serde_json::Value) -> (serde_json::Value, String) {
    let atomic = serde_json::json!({
        "id": new_ulid(),                    // ULID curto ajuda ordenação humana
        "ts": chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
        "kind": kind,
        "scope": scope, "actor": actor, "refs": refs,
        "data": data,
        "meta": { "service": "core-api@1.0.0" },
        "sig": null
    });
    let bytes = canonical_json(&atomic);
    let hash  = blake3_hash(&bytes);
    (atomic, hash)
}

7.2 Handler (ex.: criar client) — fluxo
	1.	montar actor a partir dos headers do Access
	2.	construir átomo client.created com {name,email}
	3.	calcular atomic_hash
	4.	INSERT na tabela clients (usa o atomic_hash);
	5.	emitir o átomo (a) escreve em /var/log/ubl/ledger/business.ndjson ou (b) POST local http://127.0.0.1:9456/_ledger/append (se habilitado no Proxy)
	6.	responder 201 { id, atomic_hash }

⸻

8) Configuração/Env

PORT=9458
DATABASE_URL=postgres://ubl_ops:*****@127.0.0.1:5432/ubl
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=ubl-files
LEDGER_BUSINESS_PATH=/var/log/ubl/ledger/business.ndjson   # opção A
LEDGER_PROXY_APPEND_URL=http://127.0.0.1:9456/_ledger/append # opção B


⸻

9) Deploy (CLI enxuto)

tar -xzf ubl_core_api_rs.tar.gz && cd ubl_core_api_rs

# deps (Ubuntu): libssl-dev pkg-config build-essential
cargo build --release

sudo install -d -m 0755 /opt/ubl/core/bin /etc/ubl/core /var/log/ubl/ledger
sudo install -m 0755 target/release/ubl-core-api /opt/ubl/core/bin/ubl-core-api
sudo touch /var/log/ubl/ledger/business.ndjson && sudo chmod 0640 /var/log/ubl/ledger/business.ndjson

sudo tee /etc/systemd/system/ubl-core-api.service >/dev/null <<'EOF'
[Unit]
Description=UBL Core API
After=network.target

[Service]
Environment=PORT=9458
Environment=DATABASE_URL=postgres://ubl_ops:REDACTED@127.0.0.1:5432/ubl
Environment=R2_ACCOUNT_ID=REDACTED
Environment=R2_ACCESS_KEY_ID=REDACTED
Environment=R2_SECRET_ACCESS_KEY=REDACTED
Environment=R2_BUCKET=ubl-files
Environment=LEDGER_BUSINESS_PATH=/var/log/ubl/ledger/business.ndjson
# Environment=LEDGER_PROXY_APPEND_URL=http://127.0.0.1:9456/_ledger/append
ExecStart=/opt/ubl/core/bin/ubl-core-api
Restart=always
RestartSec=2
LimitNOFILE=65536
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now ubl-core-api
curl -sf http://127.0.0.1:9458/healthz


⸻

10) Proof of Done (objetivo e mensurável)
	•	GET /core/whoami → retorna email/grupos do Access corretos.
	•	POST /core/clients com {name,email} → 201 { id, atomic_hash }.
	•	SELECT * FROM clients WHERE id=... → linha presente com mesmo atomic_hash.
	•	Uma nova linha no business.ndjson (ou aceitação 204 do Proxy em /_ledger/append).
	•	POST /files/presign/upload → executar curl -X PUT na URL retornada e depois baixar com download.

⸻

11) Runbook (3 falhas comuns)
	1.	403 vindo “de dentro”: a Core não deveria negar — cheque o Proxy (chip) e headers do Access; a Core só valida schema/dados.
	2.	hash não bate: verifique se o JSON é canônico (ordem) antes do BLAKE3; não inclua campos voláteis adicionais.
	3.	presign falha: conferir credenciais R2 e relógio do host (expiração baseada em hora).

⸻

12) Próximos incrementos
	•	Idempotência por Idempotency-Key (janela 24h tabela idempotency_keys).
	•	Quotas diárias (contagem em KV via Edge; a Core apenas ecoa cabeçalho X-Quota-Remaining).
	•	Search leve: GET /core/clients?query=acme com índice gin_trgm_ops (opcional).

⸻

se estiver ok, na próxima te entrego o Blueprint 04 — Files/R2 (lifecycle + presign seguro + layout de chaves) ou preferes Webhooks antes?