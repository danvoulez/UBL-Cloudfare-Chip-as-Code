# Status de Deploy — Chip-as-Code

**Última atualização:** 2026-01-03

---

## 📊 Resumo

| Fase | Status | Descrição |
|------|--------|-----------|
| **Fase 1** | ✅ **COMPLETA** | Build local, validação, WASM compilado |
| **Fase 2** | ❓ **PENDENTE** | Deploy no LAB 256 (proxy Rust) |
| **Fase 3** | ❓ **PENDENTE** | Deploy no Edge (Worker + WASM) |

---

## ✅ Fase 1: Validação Local — COMPLETA

### O que foi feito:
- ✅ Estrutura do projeto reorganizada
- ✅ Build completo (`cargo build --release`)
- ✅ WASM compilado (`target/wasm32-unknown-unknown/release/policy_engine.wasm`)
- ✅ Scripts de deploy criados
- ✅ Documentação completa

### Evidências:
```bash
# Build completo
cargo build --release
# ✅ Todos os componentes compilam

# WASM
ls -lh target/wasm32-unknown-unknown/release/policy_engine.wasm
# ✅ Arquivo existe (~471K)
```

---

## ❓ Fase 2: LAB 256 — PENDENTE

### O que precisa ser feito:
1. Executar `scripts/deploy-phase2.sh` no LAB 256
2. Gerar chaves Ed25519
3. Assinar política (`pack.json`)
4. Instalar proxy Rust
5. Configurar systemd service

### Como verificar se foi executado:

```bash
# Verificar pack.json
sudo test -f /etc/ubl/nova/policy/pack.json && echo "✅ pack.json existe" || echo "❌ pack.json não existe"

# Verificar service
sudo systemctl is-active nova-policy-rs && echo "✅ Service ativo" || echo "❌ Service não ativo"

# Verificar proxy respondendo
curl -s http://127.0.0.1:9456/_reload | jq
# Esperado: {"ok":true,"reloaded":true}
```

### Executar agora:

```bash
cd "/Users/ubl-ops/Chip as Code at Cloudflare"
bash scripts/deploy-phase2.sh
```

**Saída esperada:**
- Chave pública em `/tmp/PUB_BASE64.txt`
- Proxy respondendo em `http://127.0.0.1:9456`

---

## ❓ Fase 3: Edge (Worker) — PENDENTE

### O que precisa ser feito:
1. Definir variáveis: `ACCESS_AUD`, `ACCESS_JWKS`, `POLICY_PUBKEY_B64`
2. Executar `scripts/deploy-phase3.sh`
3. Build WASM
4. Configurar `wrangler.toml`
5. Publicar política na KV
6. Deploy Worker

### Como verificar se foi executado:

```bash
# Verificar WASM
test -f policy-worker/build/policy_engine.wasm && echo "✅ WASM existe" || echo "❌ WASM não existe"

# Verificar Worker
curl -s https://api.ubl.agency/warmup | jq
# Esperado: {"ok":true,"blake3":"..."}

# Verificar KV
wrangler kv key get --binding=UBL_FLAGS --key=policy_pack
# Esperado: JSON do pack.json
```

### Executar agora:

```bash
# 1. Definir variáveis
export ACCESS_AUD='seu-access-aud'
export ACCESS_JWKS='https://seu-team.cloudflareaccess.com/cdn-cgi/access/certs'
export POLICY_PUBKEY_B64='base64-da-chave-publica'  # ou usar /tmp/PUB_BASE64.txt

# 2. Executar deploy
cd "/Users/ubl-ops/Chip as Code at Cloudflare"
bash scripts/deploy-phase3.sh
```

---

## 🎯 Próximos Passos

### Se Fase 2 não foi executada:
1. Executar `scripts/deploy-phase2.sh` no LAB 256
2. Copiar chave pública de `/tmp/PUB_BASE64.txt`
3. Ir para Fase 3

### Se Fase 2 foi executada mas Fase 3 não:
1. Obter `ACCESS_AUD` e `ACCESS_JWKS` do Cloudflare Access
2. Usar `POLICY_PUBKEY_B64` de `/tmp/PUB_BASE64.txt` (ou da Fase 2)
3. Executar `scripts/deploy-phase3.sh`

### Se ambas foram executadas:
1. Executar smoke test: `bash scripts/smoke_chip_as_code.sh`
2. Verificar métricas: `curl -s http://127.0.0.1:9456/metrics`
3. Verificar ledger: `tail -f /var/log/ubl/nova-ledger.ndjson`

---

## 📋 Checklist Rápido

- [ ] Fase 1: Build local completo
- [ ] Fase 2: Proxy instalado e rodando
- [ ] Fase 2: `/_reload` respondendo
- [ ] Fase 3: WASM compilado
- [ ] Fase 3: Worker deployado
- [ ] Fase 3: `/warmup` respondendo
- [ ] Smoke test passando

---

## 🔍 Comandos de Diagnóstico

```bash
# Status geral
bash scripts/smoke_chip_as_code.sh

# Proxy
curl -s http://127.0.0.1:9456/_reload | jq
curl -s http://127.0.0.1:9456/metrics | head -20

# Worker
curl -s https://api.ubl.agency/warmup | jq
curl -s https://api.ubl.agency/health | jq

# Ledger
sudo tail -n 5 /var/log/ubl/nova-ledger.ndjson | jq
```

---

## 📚 Referências

- **DEPLOY.md** — Guia completo de deploy
- **QUICK_DEPLOY.md** — Deploy rápido (1 comando)
- **GO_LIVE_CHECKLIST.md** — Checklist final
- **scripts/deploy-phase2.sh** — Script Fase 2
- **scripts/deploy-phase3.sh** — Script Fase 3
