Blueprint 12 — Admin & Operações (P0) para api.ubl.agency — duro, seguro, e executável.

1) Objetivo

Ter uma superfície de admin mínima e blindada para operar o sistema sem gambiarra: rotas /admin/**, promoção next→current, rotação de chaves, migrações de KV e toggles — tudo auditável, idempotente e reversível.

⸻

2) Guardrails (não negociáveis)
	•	Zero-Trust + Access obrigatório em /admin/** (grupo Admins).
	•	Browser Isolation ligado para o app de admin (reduz risco de sessão/JS).
	•	Policy bit: P_Is_Admin_Path && Role=admin (nega antes de avaliar qualquer allow).
	•	Métodos permitidos: GET, POST (bloqueie PUT/PATCH/DELETE na borda).
	•	Rate-Limit Admin: 30 req/min por usuário + idempotência com Idempotency-Key.
	•	Log server-blind: evento mínimo admin.event (JSON✯Atomic) sem payload sensível.
	•	Rollback em 1 comando (voltar current), sempre disponível.

⸻

3) Roles de operação
	•	Admin: promove política, roda migração, gira chaves, mexe em toggles.
	•	Operator: lê estado, roda health, inicia drains.
	•	Auditor: leitura de logs e estado, sem mutação.

Mapeie isso em Cloudflare Access (Applications → app “api.ubl.agency /admin/*”) com 3 grupos.

⸻

4) Superfície de Admin (rotas)

GET  /admin/health                 # estado runtime (sem segredos)
POST /admin/policy/promote         # body: {"from":"next","to":"current","op_id": "..."}
POST /admin/policy/reload          # body: {"stage":"next|current"}
POST /admin/keys/rotate            # body: {"kind":"policy_signing","op_id":"..."}
POST /admin/kv/migrate             # body: {"plan_id":"...", "op_id":"..."}
POST /admin/feature/enable         # body: {"tenant":"ubl","flag":"media.vod","op_id":"..."}
POST /admin/feature/disable        # body: {"tenant":"ubl","flag":"media.vod","op_id":"..."}
POST /admin/drain/start            # trafic gradual 5%/min
POST /admin/drain/stop

Todas aceitam:
	•	Idempotency-Key: <uuid>
	•	X-Correlation-Id: <uuid>
	•	retornam error_token padronizado em falhas.

⸻

5) Layout de KV (padrão)

policy_yaml_current
policy_pack_current
policy_yaml_next
policy_pack_next
policy_stage          # "current" | "next"

flags::<tenant>       # JSON {"media.vod":true,"omni.stage":false,...}

migrations::<plan>    # JSON de controle {"status":"pending|running|done","at":"ISO",...}
migrations:lock       # ephem (DO coordena lock)

audit::<day>::...     # (opcional) ponteiros de eventos admin.event em UBL


⸻

6) Promoção de política (next→current)

Fluxo canônico
	1.	Publicar policy_yaml_next e policy_pack_next (assinada).
	2.	Dry-run:
POST https://api.ubl.agency/admin/policy/reload
{"stage":"next"}
	3.	Smoke (3 checks) contra stage=next.
	4.	Promover:
POST https://api.ubl.agency/admin/policy/promote
{"from":"next","to":"current","op_id":"<ulid>"}
	•	Atomiza: copia next→current, troca policy_stage, grava admin.event.
	5.	Rollback (se preciso, 1 clique):
mesma rota com {"from":"current","to":"current_backup"} (ou comando de restauração rápida pré-gravado).

Contrato de sucesso

{"ok":true,"from":"next","to":"current","ts":"...","audit_id":"01H..."}


⸻

7) Rotação de chaves (Ed25519 — policy signing)

Gatilhos de rotação
	•	90 dias, comprometimento suspeito, ou troca organizacional.

Passo a passo
	1.	Gerar par offline (LAB 256):

openssl genpkey -algorithm Ed25519 -out /etc/ubl/nova/keys/policy_signing_v4.pem
openssl pkey -in /etc/ubl/nova/keys/policy_signing_v4.pem -pubout \
  -out /etc/ubl/nova/keys/policy_signing_v4.pub

	2.	Assinar política com v4 → gerar pack_v4.json.
	3.	Publicar como next:

wrangler kv key put --binding UBL_KV policy_pack_next  "$(cat /tmp/pack_v4.json)"
wrangler kv key put --binding UBL_KV policy_yaml_next  "$(cat policies/ubl_core_v4.yaml)"

	4.	Dry-run reload(next) + smoke.
	5.	Promover (rota admin acima).
	6.	Arquivar v3, revogar acesso do arquivo privado antigo (permissões filesystem).
	7.	Registrar admin.event (keys.rotated → v4).

⸻

8) Migrações de KV (seguras e idempotentes)

Coordenador: AdminCoordinator DO (lock + journaling).
Plano de migração (exemplo):

{
  "plan_id": "kv-2026-01-10-rename-flags",
  "steps": [
    {"op":"copy_prefix","from":"flags:","to":"flags_v2:"},
    {"op":"verify_sample","sample":100},
    {"op":"switch_pointer","key":"flags_pointer","to":"v2"},
    {"op":"cleanup_prefix","prefix":"flags:"}
  ]
}

Executar:

curl -sS -X POST https://api.ubl.agency/admin/kv/migrate \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"plan_id":"kv-2026-01-10-rename-flags","op_id":"01H..."}'

Garantias: lock DO, reentrância por op_id, métricas migrate.step.ok/error.

⸻

9) Feature toggles (por tenant)

Schema (KV flags::<tenant>)

{
  "media.vod": true,
  "omni.stage": false,
  "office.mcp.v2": true
}

CLI rápido

curl -sS -X POST https://api.ubl.agency/admin/feature/enable \
  -d '{"tenant":"ubl","flag":"omni.stage","op_id":"01H..."}'

→ responde {ok:true, previous:false, now:true}
Tudo auditado em admin.event.

⸻

10) Hardening de /admin/**
	•	Cloudflare Access: app “api.ubl.agency (Admin)”
	•	Include: grupo Admins
	•	Isolate application: ON
	•	Sessão curta (30 min), MFA obrigatório.
	•	WAF/Firewall:
	•	Allow apenas GET/POST.
	•	Rate limit por IP/usuário (30 req/min).
	•	Bloquear UA anômalo.
	•	Headers: HSTS, CSP estrita, X-Content-Type-Options, Referrer-Policy.
	•	Backoffice: /admin/* nunca serve UI rica; somente JSON.

⸻

11) Auditoria mínima (JSON✯Atomic)

Evento admin.event (sem payload sensível):

{
  "id":"01HADM...",
  "ts":"2026-01-03T23:59:00Z",
  "kind":"admin.event",
  "scope":{"tenant":"ubl"},
  "actor":"admin@voulezvous.co",
  "data":{"action":"policy.promote","from":"next","to":"current"},
  "meta":{"corr":"01H..."},
  "sig":null
}


⸻

12) Runbooks (prontos)

Incidente — rollback de política (2 min)
	1.	Checar /admin/health (Edge/LAB OK?).
	2.	POST /admin/policy/promote {"from":"current_backup","to":"current","op_id":"..."}
	3.	Ver métricas p99/error; registrar incident.log.

Chave comprometida
	1.	Desligar promoção (flag ops.freeze=true).
	2.	Gera vN+1, assina política, promove.
	3.	Revoga permissão do PEM antigo; registra admin.event.

Migração travada
	1.	migrations:lock expirada? AdminCoordinator faz unlock_safe.
	2.	Relançar com mesmo op_id (idempotente).
	3.	Abrir ticket “MIG-####”.

⸻

13) Proof of Done (checklist)
	•	/admin/health responde 200 sob Access + Isolation.
	•	reload(next) funciona e mede p99 em Analytics.
	•	promote next→current retorna {ok:true,...} e gera admin.event.
	•	feature.enable muda flags::<tenant> e reflete no runtime.
	•	kv.migrate roda um plano “no-op” (copy→verify) e registra steps.
	•	Rate-limit e Idempotency-Key visíveis no log server-blind.

⸻

Uma decisão (única) para eu congelar:

Quer dupla aprovação para policy.promote (two-person rule: 2 admins distintos em ≤15 min) já no P0, ou deixamos para P1?