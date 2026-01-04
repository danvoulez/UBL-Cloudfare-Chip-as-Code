# Ledger Hardening Kit

## Instalação

```bash
cd infra/ledger

# Instalar arquivos
sudo install -d -m 0755 /opt/ubl/flagship/bin /etc/ubl/flagship
sudo install -m 0755 ledger-sync-r2.sh /opt/ubl/flagship/bin/ledger-sync-r2.sh
sudo install -m 0644 flagship-ledger.logrotate /etc/logrotate.d/flagship-ledger
sudo install -m 0644 flagship-ledger-sync.service /etc/systemd/system/flagship-ledger-sync.service
sudo install -m 0644 flagship-ledger-sync.timer /etc/systemd/system/flagship-ledger-sync.timer

# Configurar credenciais R2
sudo tee /etc/ubl/flagship/r2.env >/dev/null <<'EOF'
R2_ACCOUNT_ID=SEU_ACCOUNT_ID
R2_BUCKET=ubl-ledger
R2_ACCESS_KEY_ID=SEU_KEY_ID
R2_SECRET_ACCESS_KEY=SEU_KEY_SECRET
LEDGER_PATH=/var/log/ubl/flagship-ledger.ndjson
EOF

# Habilitar timer diário
sudo systemctl daemon-reload
sudo systemctl enable --now flagship-ledger-sync.timer
sudo systemctl status flagship-ledger-sync.timer

# Teste manual
sudo -E /opt/ubl/flagship/bin/ledger-sync-r2.sh
```

## Requisitos

- AWS CLI instalado (`apt-get install awscli` ou `brew install awscli`)
- R2 bucket criado: `ubl-ledger`
- R2 API token com permissões de escrita

## Funcionamento

- **Logrotate**: Rotaciona diariamente, mantém 14 dias, comprime
- **Sync Timer**: Executa diariamente (com delay aleatório de até 1h)
- **R2 Upload**: Arquivos nomeados como `ledger/YYYYMMDD/flagship-ledger-YYYYMMDD-HASH.ndjson.gz`
