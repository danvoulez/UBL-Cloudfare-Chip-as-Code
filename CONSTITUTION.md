# UBL — Constituição Definitiva (Chip‑as‑Code)

**Versão:** v2.0 • **Data:** 2026‑01‑03 • **Caráter:** Normativo

Este documento tem precedência sobre Blueprints/READMEs/Annexes.

## Escopo

Central Gateway (Edge), Policy‑Proxy (LAB 256), UBL (Ledger), Messenger e Office (MCP).

## Princípio Chave

O código de aplicação não decide acesso. Toda decisão nasce desta Constituição (texto assinado), é avaliada no Edge Worker e, opcionalmente, reforçada no Policy‑Proxy. Cada decisão deixa rastro em ledger NDJSON com prova criptográfica.

---

## 0) Propósito

Garantir coerência, segurança e auditabilidade com política única (texto → decisão → ação), mantendo o sistema server‑blind (sem plaintext sensível), append‑only e portável.

## 1) Hierarquia Normativa

1. **Constitution** (este arquivo)
2. **ADRs** (`docs/ADR-*.md`) – decisões irreversíveis que interpretam esta Constituição
3. **Blueprints** (`docs/BLUEPRINT.md`) – arquitetura e fluxos
4. **Contratos & Schemas** (`packages/*/schema.*`, OpenAPI/MCP)
5. **Implementações** (código)

Mudanças nesta Constituição obedecem ao pipeline de promoção/rollback (Seção 11).

## 2) Invariantes (Leis Imutáveis)

- **Server‑Blind**: mensagens/blobs sempre como CipherEnvelope (sem plaintext no edge).
- **Append‑Only**: fatos de negócio em JSON Atomic; não há UPDATE/DELETE.
- **Gateway Único**: nenhum cliente fala direto com DOs/R2/D1; tudo passa pelo Gateway.
- **Mesma Língua**: Rust no backend + JSON Atomic nos contratos; payloads curtos e estáveis.
- **LLM‑Friendly**: nomes estáveis, exemplos consistentes, sem ambiguidade semântica.

## 3) JSON Atomic (Formato Canônico)

Campos canônicos (ordem estável): `id`, `ts`, `kind`, `scope`, `actor`, `refs`, `data`, `meta`, `sig`. Hash BLAKE3 e assinatura Ed25519. Fatos são imutáveis e exportáveis (NDJSON) para R2.

## 4) CipherEnvelope (Mensagens & Blobs)

Mensagens e media são envelopadas (metadados mínimos + bytes cifrados). Chaves nunca residem no Edge; apenas verificadores/rotinas de envelope.

## 5) Superfícies Canônicas

- **REST**: saúde, identidade (Passkey), UBL (links/events), Messenger (rooms/messages), media presign.
- **MCP** (WebSocket JSON‑RPC): operações Office; contratos DRY com REST.

## 6) Autenticação, Tokens e ABAC

- **Humanos**: Passkey/WebAuthn → cookie `sid` (HttpOnly/Secure/Lax) ou Bearer `sid`.
- **Agentes/IDE**: `POST /tokens/mint` → token curto com `tools`, `scope`, `ttl_sec`.
- **ABAC** (ordem): 1) deny explícito 2) allow específico 3) allow genérico 4) deny por padrão.

## 7) Rate‑Limit, Quotas, Idempotência

- **Rate‑Limit**: token‑bucket por tenant/sid/rota (KV). Bit explícito na política.
- **Quotas**: por dia/mês (átomos, bytes R2, chamadas MCP).
- **Idempotência**: janela deslizante no Gateway; refuerzo no DO; TTL mínima 24h.

## 8) Estado & Armazenamento

- **Durable Objects (DO)**: ordem total por `container_id` e sequência monotônica.
- **R2**: snapshots NDJSON (prova de verdade) e blobs cifrados.
- **KV**: chaves operacionais (rate, panic TTL, policy stage/active).
- **D1** (opcional): índices de leitura/consulta.

## 9) Erros Padronizados

Erros são canônicos, sem vazar segredos. Códigos estáveis, causa/ação sugerida, `traceId`.

## 10) Observabilidade (sem plaintext)

- **Métricas mínimas**: Gateway (req.count|latency), UBL (append.count|latency), Messenger (msg.append|ws.delay), Limiter (rate_limited|backpressure), Proxy (policy_allow_total|policy_deny_total).
- **Logs**: apenas metadados (rota, tenant, ids, seq, status), amostrados.
- **SLOs**: p99 REST/MCP < 300ms; broadcast médio < 100ms; reconexão+redreno < 500ms (últimos 100 eventos).

---

## 11) Chip‑as‑Code (Política Executável)

A política vive como YAML assinado (pack). O Edge Worker avalia bits/wires e roteia; o Policy‑Proxy (LAB 256) reforça e registra.

### 11.1 Contexto

`transport.tls_version`, `mtls.{verified,issuer}`, `auth.{method,rp_id}`, `user.groups`, `req.{path,method}`, `rate.ok`, `webhook.verified`, `legacy_jwt.{valid,expires_at}`.

### 11.2 Modos

- **Normal** — Zero Trust completo.
- **Manutenção** — mesmas regras, escrita limitada.
- **Pânico (Break‑Glass)** — `POST /panic/on|off` (Edge, só ubl-ops, com TTL em KV) e `__breakglass` local no Proxy (TTL). Todos os eventos são registrados.

### 11.3 Constituição Executável (YAML v3)

Ver `policies/ubl_core_v3.yaml` para a política completa conforme esta Constituição.

### 11.4 Pipeline de Publicação (Seguro e Reversível)

1. Assinar YAML → gerar `pack.json` (BLAKE3 + Ed25519).
2. Publicar em KV como candidata: `policy_yaml_next`, `policy_pack_next`.
3. `/_reload?stage=next` (Proxy) → carrega em sombra e valida assinatura.
4. Promover: `policy_active=next` (ou copiar para chaves ativas).
5. Warmup: `/warmup` deve retornar `{ ok:true, blake3 }`.
6. Rollback: `policy_active=prev` + `wrangler rollback` (Edge) + `/_reload` (Proxy).

---

## 12) Domínios e Rotas (Mapa)

- `/` → PWA (Pages)
- `/core/*` → Core API (Axum) – presign R2, whoami, objetos de negócio
- `/admin/*` → Core API/Admin UI – exige `W_Admin_Path_And_Role`
- `/files/*` → Core API (presign R2)
- `/webhooks/*` → Serviço de webhooks – exige `W_Webhook_Trusted`
- `/warmup`, `/panic/*` → Edge Worker (controle)

Gateway: pode residir 100% no Worker (roteamento no Edge) ou passar pelo Caddy → Policy‑Proxy (dupla barreira). O estado atual mantém dupla barreira.

## 13) Ledger & Prova

Cada decisão gera NDJSON `{ ts, who, path, decision, wire, bit_failed?, blake3, signature }`. Retenção local 30 dias (logrotate) + espelho diário em R2. Respostas de controle incluem `blake3` do pack ativo.

## 14) Versionamento, Deprecação e Veto

- **Versionamento**: `id@major.minor.patch` para políticas/contratos. Breaking → major.
- **Deprecação**: janelas explícitas; anúncio em CHANGELOG e cabeçalhos. Remoção só após janela mínima.
- **Veto de Segurança**: qualquer owner `ubl-ops` pode vetar e reverter para `prev` se métricas/ledger indicarem regressão.

## 15) Annexes (Extensões Oficiais)

Annexes definem namespaces e kinds reservados para evitar colisão. Devem referenciar os invariantes e os artigos 6–11.

---

## Operação (Checklist Rápido)

- `/_reload` → `{ ok:true }`
- `/warmup` → `{ ok:true, blake3 }`
- `/admin/**` → 403 sem ubl-ops, 200 com ubl-ops
- `policy_allow_total/policy_deny_total > 0`
- Ledger incrementa após requests; snapshots em R2 ao fim do dia
