#!/usr/bin/env bash
set -euo pipefail

BIN_SRC="${1:-./vvz-core}"
BIN_DST="/opt/vvz-core/vvz-core"

echo "==> Creating vvz system user (if not exists)"
sudo id vvz >/dev/null 2>&1 || sudo useradd --system --home /opt/vvz-core --shell /usr/sbin/nologin vvz

echo "==> Installing vvz-core binary to ${BIN_DST}"
sudo mkdir -p /opt/vvz-core
sudo install -m 0755 "$BIN_SRC" "$BIN_DST"
sudo chown -R vvz:vvz /opt/vvz-core

echo "==> Installing systemd unit files"
sudo install -m 0644 vvz-core.service /etc/systemd/system/vvz-core.service
sudo install -m 0644 cloudflared-vvz-core.service /etc/systemd/system/cloudflared-vvz-core.service
sudo systemctl daemon-reload

echo "==> Preparing /etc/cloudflared"
sudo mkdir -p /etc/cloudflared
if [ -f cloudflared-config.yml ]; then
  sudo install -m 0644 cloudflared-config.yml /etc/cloudflared/config.yml
else
  echo "WARN: cloudflared-config.yml not present in current dir; create /etc/cloudflared/config.yml manually."
fi

echo ""
echo "NEXT STEPS (one-time):"
echo "  1) Authenticate and create the tunnel:"
echo "       cloudflared tunnel login"
echo "       cloudflared tunnel create vvz-core"
echo "  2) Route DNS:"
echo "       cloudflared tunnel route dns vvz-core core.voulezvous.tv"
echo "  3) Copy credentials file to /etc/cloudflared/vvz-core.json:"
echo "       sudo cp ~/.cloudflared/*.json /etc/cloudflared/vvz-core.json"
echo "       sudo chown root:root /etc/cloudflared/vvz-core.json && sudo chmod 600 /etc/cloudflared/vvz-core.json"
echo "  4) Enable and start services:"
echo "       sudo systemctl enable --now vvz-core cloudflared-vvz-core"
echo ""
echo "Proof of Done:"
echo "  curl -s https://core.voulezvous.tv/healthz"
