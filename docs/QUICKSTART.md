# Quick Start — UBL Flagship

## Setup Inicial

### 1. Gerar Chaves Ed25519

```bash
cd policy-pack
cargo build --release
./target/release/pack-builder --generate-key
```

Isso cria `keys/private.pem` e `keys/public.pem`.

### 2. Build Policy Pack

```bash
./target/release/pack-builder -y policy.yaml -k keys/private.pem -o pack.json
```

### 3. Configurar Worker

1. Editar `worker/wrangler.toml`:
   - Adicionar KV namespace ID
   - Adicionar Durable Object binding
   - Adicionar Queue binding
   - Adicionar R2 bucket binding
   - Adicionar `PUBLIC_KEY` (base64 da chave pública)

2. Upload `pack.json` para KV:
```bash
cd worker
wrangler kv:key put --binding=POLICY_KV "policy_pack" --path=../policy-pack/pack.json
```

### 4. Build e Deploy Worker

```bash
cd worker
npm install
npm run build
npm run deploy
```

### 5. Build Proxy

```bash
cd proxy
cargo build --release
```

### 6. Configurar Proxy

1. Criar arquivo `.env` ou exportar variáveis:
```bash
export PUBLIC_KEY="<base64-da-chave-publica>"
export RUST_LOG=info
```

2. Instalar systemd service:
```bash
sudo cp infra/systemd/ubl-policy-proxy.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable ubl-policy-proxy
sudo systemctl start ubl-policy-proxy
```

### 7. Verificar

**Worker:**
```bash
curl https://ubl-flagship-edge.your-subdomain.workers.dev/admin/test
# Deve retornar 403 (sem grupo ubl-ops)
```

**Proxy:**
```bash
curl http://localhost:8080/metrics
# Deve retornar métricas Prometheus
```

## Testes PoD

### Cenário 1: Hacker (sem grupo)
```bash
curl https://ubl-flagship-edge.your-subdomain.workers.dev/admin/users
# Esperado: 403
```

### Cenário 2: Admin (com grupo ubl-ops)
```bash
# Com header CF-Access-Jwt-Assertion válido e grupo ubl-ops
curl -H "CF-Access-Jwt-Assertion: <token>" \
     https://ubl-flagship-edge.your-subdomain.workers.dev/admin/users
# Esperado: 200
```

### Cenário 3: Break-glass
```bash
# Ativar break-glass (requer grupo ubl-ops-breakglass)
curl -X POST https://ubl-flagship-edge.your-subdomain.workers.dev/breakglass \
     -H "Content-Type: application/json" \
     -d '{"active": true, "reason": "Emergency", "ttl_seconds": 120}'

# Testar acesso sem grupo
curl https://ubl-flagship-edge.your-subdomain.workers.dev/admin/users
# Esperado: 200 (break-glass ativo)
```

## Monitoramento

**Métricas Proxy:**
```bash
curl http://localhost:8080/metrics | grep policy_
```

**Ledger Proxy:**
```bash
curl http://localhost:8080/ledger | jq
```

**R2 Events:**
```bash
# Via Cloudflare Dashboard ou wrangler
wrangler r2 object list nova --prefix="events/"
```

## Troubleshooting

**Worker retorna 503:**
- Verificar se `policy_pack` está no KV
- Verificar se assinatura está válida
- Verificar `PUBLIC_KEY` no wrangler.toml

**Proxy não inicia:**
- Verificar logs: `journalctl -u ubl-policy-proxy -f`
- Verificar se porta 8080 está livre
- Verificar variáveis de ambiente

**Decisões diferentes entre Worker e Proxy:**
- Verificar break-glass state (deve ser o mesmo)
- Verificar user groups (devem ser os mesmos)
- Verificar versão do tdln-core (deve ser a mesma)
