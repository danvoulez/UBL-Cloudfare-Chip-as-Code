# 🚀 Deploy Rápido — Fase 2 + 3

## Fase 2: LAB 256 (1 comando)

```bash
cd "/Users/ubl-ops/Chip as Code at Cloudflare"
bash scripts/deploy-phase2.sh
```

**Faz tudo:**
- Gera chaves Ed25519
- Assina política
- Build + instala proxy
- Configura systemd
- Valida proxy

**Saída:** Chave pública em `/tmp/PUB_BASE64.txt`

---

## Fase 3: Edge (Worker + WASM)

**1. Defina as variáveis:**

```bash
export ACCESS_AUD='seu-access-aud'
export ACCESS_JWKS='https://seu-team.cloudflareaccess.com/cdn-cgi/access/certs'
export KV_NAMESPACE_ID='id-do-kv'  # opcional
```

**2. Execute:**

```bash
bash scripts/deploy-phase3.sh
```

**Faz tudo:**
- Build WASM
- Configura wrangler.toml
- Publica política na KV
- Deploy Worker

---

## ⚠️ Informações Necessárias

**Preciso de você:**

1. **ACCESS_AUD**: Audience do Cloudflare Access
   - Exemplo: `"your-app-audience-id"`

2. **ACCESS_JWKS**: URL do JWKS do Cloudflare Access
   - Exemplo: `"https://your-team.cloudflareaccess.com/cdn-cgi/access/certs"`

**Como obter:**
- No Cloudflare Dashboard → Access → Applications
- Selecione sua app
- Veja "Application Audience (AUD)" e "JWKS Endpoint"

---

## Validação

```bash
# Proxy
curl -s http://127.0.0.1:9456/_reload | jq

# Worker
curl -s https://api.ubl.agency/warmup | jq

# Smoke test
bash scripts/smoke_chip_as_code.sh
```

---

## Próximo Passo

**Me passe:**
- `ACCESS_AUD`
- `ACCESS_JWKS`

E eu atualizo o `wrangler.toml` e você pode executar a Fase 3! 🚀
