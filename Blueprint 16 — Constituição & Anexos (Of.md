Blueprint 16 — Constituição & Anexos (Oficial)

Versão: v1.0 • Data: 2026-01-04 • Status: Canônico

Fontes consolidadas: CONSTITUTION.md v2.0 (2026-01-03), ADR-001 (versionamento de política), políticas ubl_core_v3.yaml (tdln-chip/0.3), App Dev Kit v5, Blueprints 01–08.

⸻

0) Propósito e escopo

Este Blueprint consolida a Constituição (normativa superior) e o Anexo de Diretrizes Práticas em um documento operacional. Ele fixa invariantes, hierarquia normativa, contratos mínimos e o pipeline Chip‑as‑Code (assinatura, publicação, promoção) que rege Edge, Policy‑Proxy, Core API, Office e Apps.

Fora de escopo: decisões específicas de UI do Messenger/OMNI (cobertas em seus próprios blueprints), lógica de negócio de parceiros e armazenamento de conteúdo em claro.

⸻

1) Hierarquia normativa (precedência)
	1.	Constituição — fonte única de verdade (imutável salvo nova versão explícita)
	2.	ADRs (docs/ADR-*.md) — decisões irreversíveis, pequenas e auditáveis
	3.	Blueprints — arquitetura por componente (este documento é o #16)
	4.	Contratos & Schemas — OpenAPI/MCP, JSON Atomic, ABAC, ErrorToken
	5.	Implementações — código (Edge Worker, Policy‑Proxy, Core, Office, Apps)

Qualquer conflito é resolvido “de cima para baixo”.

⸻

2) Invariantes constitucionais (resumo)
	•	MCP‑first: Office expõe/consome apenas MCP (WebSocket JSON‑RPC).
	•	Server‑blind: nenhum plaintext sensível em logs/índices/snapshots.
	•	ABAC forte: ordem estrita — deny explícito > allow específico > allow genérico > deny default.
	•	Idempotência dupla: client_id + op_id (sessão) e Idempotency‑Key (Gateway).
	•	Backpressure/Rate: token‑bucket por session_type, com Retry‑After propagado.
	•	JSON Atomic: materializações (ex.: trilhas office.*) obedecem ordem canônica de chaves.
	•	ErrorToken: erros padronizados (-32602, -32001, -32003, -32004, -32009, -32097, -32098) com vocabulário fechado.
	•	Chip‑as‑Code: políticas/artefatos versionados, assinados e publicáveis via pipeline blue/green.

⸻

3) Autenticação, chaves e tokens (decisão canônica)
	•	Algoritmo de assinatura padrão: ES256 (ECDSA P‑256)
	•	JWKS: publicado pelo Core API (kid ativo e kid next) e consumido por Edge/Office.
	•	Tokens: JWT curto (15–30 min) com aud específica; verificação no Edge (WebCrypto) e Core (Rust).
	•	Rotação: estratégia blue/green com convivência ≥ TTL máximo.
	•	Compatibilidade: verificador pode aceitar EdDSA (verify‑only) quando declarado; emissor assina sempre ES256.

⸻

4) Politicas executáveis (v3) e bits de contexto

Política: policies/ubl_core_v3.yaml (tdln‑chip/0.3)

Novos bits suportados pelo engine:
	•	context.rate.ok → P_Rate_Bucket_OK
	•	context.webhook.verified → P_Webhook_Verified
	•	context.legacy_jwt.{valid,expires_at} → P_Legacy_JWT

Novos wirings:
	•	W_Webhook_Trusted (gateia webhooks por origem/assinatura)
	•	W_Public_Warmup (permite warmup público controlado)

Novos outputs:
	•	deny_rate_limit, allow_webhook, allow_public_warmup

⸻

5) Contratos mínimos (normativos)

5.1 MCP (Office)
	•	Métodos: tools/list, tool/call, session.brief.get|set, session.note.add, session.cancel, ping.
	•	Meta obrigatório em tool/call: { version, client_id, op_id, correlation_id, session_type, mode, scope{tenant, entity?, room?, container?} }.
	•	Erros: sempre com ErrorToken { token, remediation[], retry_after_ms? }.

5.2 ABAC (Gateway)

{
  "effect": "deny|allow",
  "scope": {"tenant":"ubl","entity":"cust_*","room":"*"},
  "tools": ["messenger@v1.send","ubl@v1.*"],
  "where": {"session_type":["work","assist"]}
}

Avaliação: deny explícito > allow específico > allow genérico > deny default.

5.3 Perfis de quota por session_type

session_type	calls/min	burst	daily cap	backpressure
work	60	120	3k	1.2s
assist	30	60	1k	0.8s
deliberate	20	40	800	1.5s
research	120	240	10k	2.0s


⸻

6) Chip‑as‑Code (pipeline oficial)

Artefatos: policy_yaml, policy_pack (JSON assinado), policy_*_next (staged), PUBKEY_B64.

Blue/Green:
	1.	Assinar

policy-signer \
  --id ubl_access_chip_v3 \
  --version 3 \
  --yaml policies/ubl_core_v3.yaml \
  --privkey_pem /etc/ubl/nova/keys/policy_signing_private.pem \
  --out /tmp/pack_v3.json

	2.	Publicar candidato: policy_yaml_next ← ubl_core_v3.yaml; policy_pack_next ← pack_v3.json
	3.	Carregar: /_reload?stage=next
	4.	Validar: smoke/contratos (Edge, Proxy, Core, Office)
	5.	Promover: policy_yaml ← policy_yaml_next; policy_pack ← policy_pack_next
	6.	Reverter: chave policy_*_prev guardada por N horas (rollback imediato)

Garantias:
	•	Não há deploy sem assinatura válida.
	•	Não há promoção sem smoke/contratos PASS.
	•	Todo estágio gera evento de auditoria (JSON Atomic).

⸻

7) Observabilidade e SLOs
	•	SLOs: p99 tool/call < 300ms (edge); reconnect WS < 500ms; erro de verificação JWT < 5ms (cache JWKS).
	•	Métricas: mcp.call.{count,latency,error_rate}, session.active, idempotency.hit/miss, rate_limited.count, backpressure.count.
	•	Logs server‑blind (lista fechada): session_id, correlation_id, tool, ok, err(token), latency_ms, cost.calls, ts.

⸻

8) Trilhas (opt‑in) em JSON Atomic
	•	Tipos: office.tool_call, office.event, office.handover.
	•	args_min obrigatório (IDs/tipos/contadores apenas — sem payload sensível).
	•	Chaves canônicas: id, ts, kind, scope, actor, refs, data, meta, sig.

⸻

9) Segurança e Zero‑Trust
	•	Humanos: Passkey/WebAuthn no Gateway; cookie sid seguro.
	•	Agentes/IDE: POST /tokens/mint → JWT curto e escopado.
	•	Headers/AppSec: HSTS, CSP estrita, cookies HttpOnly/Secure.
	•	Segredos: nunca em artefatos; chaves privadas fora do repositório.

⸻

10) Compatibilidade e migração
	•	v1/v2: suportadas por compat layer do engine (bits herdados mapeados).
	•	P_Legacy_JWT: aceitar legacy_jwt.valid=true por janela controlada.
	•	Remoção: qualquer deprecação exige ADR + período de convivência.

⸻

11) DoD (Definition of Done) — conformidade
	1.	Auth/Keys: /auth/jwks.json expõe ES256 com kid active/next.
	2.	Mint/Verify: JWT assinado ES256, verificado no Edge (WebCrypto) e Core (Rust).
	3.	MCP: tools/list, tool/call, session.* ativos; ErrorToken correto.
	4.	ABAC: ordem de avaliação respeitada; negações e allows testados.
	5.	Rate/Backpressure: perfis aplicados; retry_after_ms propagado.
	6.	Idempotência: repetição client_id+op_id retorna resultado cacheado.
	7.	Trilhas: office.* opt‑in sem plaintext; args_min válido.
	8.	Blue/Green: next → prod com rollback imediato.

⸻

12) Testes de contrato (resumo)
	•	Auth: mudança de kid sem downtime; rejeição a aud errada.
	•	MCP: INVALID_PARAMS, FORBIDDEN, RATE_LIMIT, BACKPRESSURE com tokens adequados.
	•	Webhook: somente W_Webhook_Trusted permite execução.
	•	Warmup público: apenas via W_Public_Warmup.

⸻

13) Anexo A — Guia rápido para Apps (vinculado à Constituição)

Apps = YAML + contratos; Runtime = UBL/Office/Core.

Pilares para autores de app:
	1.	Manifesto do app (YAML): nome, versões, ferramentas (tooling), escopos de ABAC, quotas mínimas, policies exigidas.
	2.	MCP Manifest: descreve métodos/tools expostos/consumidos (schemas de entrada/saída).
	3.	Ciclo de vida: draft → review → signed → staged(next) → prod (Chip‑as‑Code).
	4.	Checklists:
	•	app-lint: valida YAML e referências a schemas.
	•	policy-lint: valida wiring e bits usados.
	•	mcp-contract: roda collection de requests de contrato.
	5.	Privacidade: texto livre jamais vai para trilhas; só args_min.

Templates mínimos (entregues no kit):
	•	templates/app.manifest.yaml
	•	templates/mcp.manifest.json
	•	templates/policy.wiring.yaml
	•	templates/abac.policy.json
	•	templates/tests/*.http

⸻

14) Anexo B — Pipeline de Publicação (operacional)
	1.	Assinar política e app pack (CLI policy-signer).
	2.	Publicar em KV (*_next).
	3.	Validar com smoke (Edge/Proxy/Core/Office).
	4.	Promover (*_next → *) e registrar evento JSON Atomic.
	5.	Reverter em 1 comando (usa *_prev).

Observação: sem assinatura válida, o Worker recusa /_reload.

⸻

15) Anexo C — Vocabulário de Erros (ErrorToken)
	•	INVALID_PARAMS, UNAUTHORIZED, FORBIDDEN_SCOPE, RATE_LIMIT, BACKPRESSURE, IDEMPOTENCY_CONFLICT, INTERNAL.
	•	Cada token deve vir com até 3 remediações objetivas e retry_after_ms quando aplicável.

⸻

16) Rastreabilidade e prova (ponte com UBL/Proof)
	•	Registro de eventos de confiança sem conteúdo (verificação, denúncias, apelações, ban/selo).
	•	Cadeia de publicação das políticas e apps com ULIDs, kid e sig (opcional Ed25519 para carimbo de prova interna).

⸻

17) Roadmap (apenas do Blueprint 16)
	•	P0: DoD completo (itens 11.1–11.8) + App Dev Kit v5 publicado.
	•	P1: JWKS dinâmico no Core, compressão de brief sob pressão, session.cancel.
	•	P2: Limiter global opcional e redatores de brief (PII‑strip) por tenant.

⸻

Conclusão

Este Blueprint 16 fixa o centro normativo (Constituição) e a estrada prática (Anexos) para todo o ecossistema. A partir dele, todo componente — Edge, Proxy, Core, Office, Apps — obedece os mesmos contratos, pipeline Chip‑as‑Code e garantias operacionais, mantendo segurança, previsibilidade e escalabilidade sem “gambiarras”.