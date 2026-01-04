# ADR-001: Versionamento de Política (Chip-as-Code)

**Status:** Aceito  
**Data:** 2026-01-03  
**Decisores:** ubl-ops

## Contexto

A política executável (YAML assinado) precisa evoluir sem quebrar o sistema em produção. Mudanças devem ser testáveis, reversíveis e auditáveis.

## Decisão

Implementar pipeline de promoção blue/green com stages:

1. **Desenvolvimento**: `policy_yaml_dev`, `policy_pack_dev`
2. **Staging**: `policy_yaml_next`, `policy_pack_next`
3. **Produção**: `policy_yaml`, `policy_pack` (ou `policy_active=next`)

### Fluxo de Promoção

1. Assinar YAML → gerar `pack.json` (BLAKE3 + Ed25519)
2. Publicar em KV como candidata: `policy_yaml_next`, `policy_pack_next`
3. `/_reload?stage=next` (Proxy) → carrega em sombra e valida assinatura
4. Promover: `policy_active=next` (ou copiar para chaves ativas)
5. Warmup: `/warmup` deve retornar `{ ok:true, blake3 }`
6. Rollback: `policy_active=prev` + `wrangler rollback` (Edge) + `/_reload` (Proxy)

### Versionamento

- Formato: `id@major.minor.patch` (ex: `ubl_access_chip_v3@3.0.0`)
- Breaking changes → incrementar major
- Novos bits sem breaking → incrementar minor
- Correções → incrementar patch

## Consequências

- ✅ Mudanças testáveis antes de produção
- ✅ Rollback rápido e seguro
- ✅ Auditoria completa (ledger + assinaturas)
- ⚠️ Requer disciplina para manter stages sincronizados
