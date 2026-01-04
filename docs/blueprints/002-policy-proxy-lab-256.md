Blueprint 02 — Policy-Proxy (LAB 256)

02) Policy-Proxy (Rust) — “segunda barreira + ledger + métricas”

1) Propósito
	•	Reaplica a Constituição (YAML v3, pack assinado) localmente.
	•	Prossegue ou nega a request antes dos apps.
	•	Grava rastro (ledger NDJSON) e expõe /metrics.
	•	Opcional: modo break-glass local (TTL) para incidentes.

⸻

2) Interface
	•	POST /_reload[?stage=next] → carrega/valida pack da KV (ou disco) e ativa sombra (next).
	•	GET  /metrics → policy_allow_total, policy_deny_total, panic_active, latências.
	•	POST /__breakglass { ttl_sec, reason } → ativa pânico local (somente loopback).
	•	Proxy HTTP → encaminha para upstream correto: /core/**, /admin/**, /files/**, /webhooks/**.

Porta padrão: 127.0.0.1:9456.

⸻

3) Política (o mesmo pack do Edge)
	•	Bits/Wires/Outputs exatamente iguais ao Worker (v3).
	•	A decisão do Edge não é confiada cegamente — o Proxy reavalia.
	•	Se houver divergência: nega, loga e alerta via métricas.

⸻

4) Contexto esperado (dos headers)

Proxy calcula/consome estes campos:

Campo	Fonte
transport.tls_version	Header interno X-TLS-Version (Caddy)
mtls.verified	X-Mtls-Verified: true/false (Caddy mTLS)
mtls.issuer	X-Mtls-Issuer: UBL Local CA (Caddy)
auth.method	Cf-Access-Authenticated-User-Email/Cf-Access-Organization/etc.
auth.rp_id	fixo: app.ubl.agency (ou do Access)
user.groups	Cf-Access-Groups (CSV)
req.path/method	da própria request
rate.ok	opcional revalidação local (ou confia no Edge)
webhook.verified	X-Webhook-Verified: true (Edge) ou recalcular assinatura local
legacy_jwt.*	opcional (compat), via Authorization: Bearer + verificação local

Dica prática: se o Edge já calcula rate.ok e webhook.verified, reaproveite; senão, o Proxy recalcula.

⸻

5) Roteamento interno (exemplos)
	•	/core/*      → 127.0.0.1:9458  (Core API Axum)
	•	/admin/*     → 127.0.0.1:9458  (mesma API, mas exige ubl-ops)
	•	/files/*     → 127.0.0.1:9458  (presign R2)
	•	/webhooks/*  → 127.0.0.1:9460  (serviço leve)

Se negar no chip, não encaminha.

⸻

6) Caddy (frente local, com mTLS)

:443 {
    tls /etc/ssl/certs/ubl.crt /etc/ssl/private/ubl.key {
        client_auth {
            mode require_and_verify
            trusted_ca_cert_file /etc/step-ca/root_ca.crt
        }
    }

    @admin path /admin/*
    route {
        header_up X-TLS-Version {tls_protocol}
        header_up X-Mtls-Verified true
        header_up X-Mtls-Issuer "UBL Local CA"
        # Preserve Access headers
        reverse_proxy 127.0.0.1:9456
    }
}

O Cloudflare Tunnel aponta pra este Caddy. Caddy exige mTLS e repassa headers para o Proxy.

⸻

7) Variáveis/Env do Proxy

BIND_ADDR=127.0.0.1:9456
UPSTREAM_CORE=http://127.0.0.1:9458              # Blueprint 02: roteamento por prefixo
UPSTREAM_WEBHOOKS=http://127.0.0.1:9460           # Blueprint 02: roteamento por prefixo
POLICY_PUBKEY_PEM_B64=<chave pública Ed25519 do pack (base64)>
POLICY_YAML=/etc/ubl/nova/policy/ubl_core_v1.yaml
POLICY_PACK=/etc/ubl/nova/policy/pack.json
LEDGER_PATH=/var/log/ubl/nova-ledger.ndjson      # Implementado: append com hash BLAKE3
PANIC_TTL_MAX_SEC=900                            # 15 min (implementado)


⸻

8) Deploy (CLI — 10 linhas)

# binário e dirs
sudo install -d -m 0755 /opt/nova/bin /etc/nova/policy /var/log/ubl/ledger
sudo install -m 0755 policy-proxy /opt/nova/bin/policy-proxy
sudo touch /var/log/ubl/ledger/ledger.ndjson && sudo chmod 0640 /var/log/ubl/ledger/ledger.ndjson

# env file (Blueprint 02: atualizado para roteamento por prefixo)
sudo tee /etc/default/nova-policy-proxy >/dev/null <<'EOF'
BIND_ADDR=127.0.0.1:9456
UPSTREAM_CORE=http://127.0.0.1:9458
UPSTREAM_WEBHOOKS=http://127.0.0.1:9460
POLICY_PUBKEY_PEM_B64=REPLACE_ME
POLICY_YAML=/etc/ubl/nova/policy/ubl_core_v1.yaml
POLICY_PACK=/etc/ubl/nova/policy/pack.json
LEDGER_PATH=/var/log/ubl/nova-ledger.ndjson
PANIC_TTL_MAX_SEC=900
EOF

# systemd (Blueprint 02: service atualizado)
sudo tee /etc/systemd/system/nova-policy-rs.service >/dev/null <<'EOF'
[Unit]
Description=UBL Policy Proxy (Rust)
After=network.target

[Service]
EnvironmentFile=/etc/default/nova-policy-proxy
ExecStart=/opt/ubl/nova/bin/nova-policy-rs
Restart=always
RestartSec=2
NoNewPrivileges=true
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now nova-policy-proxy
curl -sf http://127.0.0.1:9456/metrics | head


⸻

9) Reload/Promoção da política

Modelo recomendado (shadow → promote):
	1.	Copiar candidata para disco:
sudo cp /etc/nova/policy/pack.next.json /etc/nova/policy/pack.next.json
	2.	Carregar em sombra:
curl -sf -X POST 'http://127.0.0.1:9456/_reload?stage=next'
	3.	Promover (swap de ponteiro/arquivo atômico):
sudo cp /etc/nova/policy/pack.next.json /etc/nova/policy/pack.json && curl -sf -X POST 'http://127.0.0.1:9456/_reload'

Alternativa: Edge/Worker promove via KV; Proxy lê policy_active e puxa a versão nova.

⸻

10) Ledger (rastro verificável)
	•	Formato: NDJSON; uma linha por decisão → { ts, who, path, decision, wire, bit_failed?, blake3_pack, signature }.
	•	Rotação: logrotate diário (/etc/logrotate.d/ubl-ledger).
	•	Espelho R2: cron diário (rclone/aws s3 cp) para r2://ubl-ledger/YYYY-MM-DD.ndjson.

⸻

11) Observabilidade
	•	/metrics:
	•	policy_allow_total{route=..., user=...}
	•	policy_deny_total{reason=..., bit=...}
	•	panic_active{source=edge|proxy}
	•	upstream_latency_ms{route=...}
	•	Alertas básicos: /metrics indisponível; pico anômalo de policy_deny_total; panic_active > TTL.

⸻

12) Segurança
	•	Chave privada do pack nunca no LAB 256.
	•	__breakglass só aceita loopback (127.0.0.1) e exige TTL + razão.
	•	Sem eco de tokens/JWT; apenas identidade mínima e grupos.
	•	Se Edge e Proxy discordarem → nega e loga diferença.

⸻

13) Proof of Done (objetivo e testável)
	•	curl -sf http://127.0.0.1:9456/metrics → OK com contadores 0/>0.
	•	/_reload → { ok:true, stage:"active", blake3:"..." }.
	•	Acesso a /admin/ping sem ubl-ops → 403 no Proxy (sem tocar upstream).
	•	Acesso a /admin/ping com ubl-ops → 200 e linha no ledger.
	•	Simulação de carga → policy_deny_total{reason="rate_limit"} sobe conforme esperado.

⸻

14) Runbook (3 incidentes comuns)
	1.	403 em massa (falso-positivo):
	•	Conferir hash do pack no Proxy vs Edge; /_reload novamente.
	•	Checar relógio do host (NTP) se houver regras com now().
	2.	latência alta:
	•	Ver upstream_latency_ms, isolar rota; checar Core API.
	•	Temporariamente reduzir logging/ledger (sampling) se I/O local for gargalo.
	3.	pânico não desarma:
	•	journalctl -u nova-policy-proxy | tail (ver razões)
	•	limpar estado TTL local e POST /panic/off no Edge; reiniciar serviço.

⸻

15) Bônus (opcionais fáceis)
	•	Replay auditor: endpoint local que reavalia uma request gravada no ledger e comprova decisão (diff visível).
	•	Assinatura de resposta: adicionar X-Policy-Sign (Ed25519) em respostas 2xx/4xx para não-repúdio ponta-a-ponta.
	•	Canário de política: ativar pack.canary por grupo/rota e expor métrica separada.

⸻

