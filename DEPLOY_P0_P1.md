# Deploy P0 + P1 — Fila de Prioridade

**Objetivo:** Terminar plano de controle (P0) e plano de mídia mínimo (P1).

---

## P0 — Plano de Controle

### 1. Core online via Tunnel (core.voulezvous.tv)

**Comandos:**
```bash
# Opção A: Script automatizado
./scripts/deploy-p0-core.sh

# Opção B: Manual
cloudflared tunnel login
cloudflared tunnel create vvz-core
cloudflared tunnel route dns vvz-core core.voulezvous.tv

# Subir o core e o tunnel (dois terminais)
PORT=8787 RUST_LOG=info ./target/release/vvz-core
cloudflared tunnel run vvz-core

# Opção C: Systemd (Linux)
sudo bash infra/systemd/install-vvz-core.sh ./target/release/vvz-core
sudo systemctl enable --now vvz-core cloudflared-vvz-core
```

**Proof of Done:**
```bash
curl -s https://core.voulezvous.tv/healthz
# → 200 OK
```

---

### 2. Gateway → Core (proxy por host/tenant)

**Comando:**
```bash
curl -s https://voulezvous.tv/core/healthz
```

**Proof of Done:** → 200 OK (bate no worker, roteia pro Core)

---

### 3. Gate de Admin funcionando (Access)

**Comandos:**
```bash
# Sem login deve redirecionar Access:
curl -I https://admin.voulezvous.tv/admin/health
# → 302 sem login / 200 logado
```

**Proof of Done:** → 302 sem login / 200 logado

---

## P1 — Plano de Mídia "Mínimo Utilizável"

### 4. RTC health pela rota final

**Comando:**
```bash
curl -s https://rtc.voulezvous.tv/healthz | jq
```

**Proof of Done:** → `{"ok":true}`

---

### 5. Media API primitives (upload presign + D1)

**Comandos:**
```bash
# Presign
curl -s -X POST https://api.ubl.agency/internal/media/presign \
  -H 'content-type: application/json' \
  -d '{"tenant":"voulezvous","mime":"image/png","bytes":1234}' | jq

# Schema D1 já aplicado; validar link (vai 403/404 se não subiu o objeto, mas responde)
curl -s https://api.ubl.agency/internal/media/link/test-id
```

**Proof of Done:** → 200 JSON no `/presign`

---

### 6. DNS verificado (hosts principais)

**Comandos:**
```bash
for h in voulezvous.tv www.voulezvous.tv admin.voulezvous.tv core.voulezvous.tv rtc.voulezvous.tv; do
  echo "== $h ==" && curl -sI https://$h | head -n1
done
```

**Proof of Done:** → todos retornam HTTP/ (sem NXDOMAIN)

---

## Smoke Test Completo

```bash
./scripts/smoke-p0-p1.sh
```

---

## Ordem de Execução Recomendada

1. **P0.1** — Core via Tunnel (destrava `/core/**` no gateway)
2. **P0.2** — Gateway→Core (valida roteamento multitenant)
3. **P0.3** — Admin gate (valida segurança Access)
4. **P1.4** — RTC health (valida Worker RTC)
5. **P1.5** — Media primitives (valida upload/presign)
6. **P1.6** — DNS verificado (valida todos os hosts)

---

## Por que nessa ordem?

- **Core via Tunnel** destrava `/core/**` no gateway e o exchange de sessão do VVZ (é o único "bloqueador real" de produto agora).
- **Gateway→Core** garante que o roteamento multitenant já serve o app público.
- **Admin gate** valida segurança (Access) no domínio certo.
- **RTC + Media primitives** dão base para Party/Stage sem ainda depender de SFU/LL-HLS.

---

## Systemd (Linux)

Para produção, use os units systemd:

```bash
# Instalar
sudo bash infra/systemd/install-vvz-core.sh ./target/release/vvz-core

# Iniciar
sudo systemctl enable --now vvz-core cloudflared-vvz-core

# Logs
journalctl -u vvz-core -f
journalctl -u cloudflared-vvz-core -f
```

Arquivos em `infra/systemd/`:
- `vvz-core.service` — Unit para o Core API
- `cloudflared-vvz-core.service` — Unit para o Tunnel
- `cloudflared-config.yml` — Config do Tunnel
- `install-vvz-core.sh` — Script de instalação
