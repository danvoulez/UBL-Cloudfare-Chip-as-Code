Voulezvous Core — Systemd + Cloudflared
=========================================

Files in this package
---------------------
- vvz-core.service                → systemd unit for the Core API
- cloudflared-vvz-core.service    → systemd unit for the named Tunnel
- cloudflared-config.yml          → Tunnel config mapping core.voulezvous.tv → 127.0.0.1:8787
- install-vvz-core.sh             → helper to install units and print next steps

Quick start
-----------
1) Copy your compiled binary:
   $ cp ./target/release/vvz-core ./vvz-core

2) Run the installer (creates users, installs units, prints next steps)
   $ bash install-vvz-core.sh ./vvz-core

3) Follow NEXT STEPS printed by the installer:
   - cloudflared tunnel login
   - cloudflared tunnel create vvz-core
   - cloudflared tunnel route dns vvz-core core.voulezvous.tv
   - copy credentials to /etc/cloudflared/vvz-core.json
   - systemctl enable --now vvz-core cloudflared-vvz-core

Signals & Logs
--------------
- Restart Core:        sudo systemctl restart vvz-core
- Tail Core logs:      journalctl -u vvz-core -f
- Tail Tunnel logs:    journalctl -u cloudflared-vvz-core -f

Security notes
--------------
- vvz-core runs as a dedicated system user 'vvz' with hardened systemd options.
- cloudflared runs as user 'cloudflared' (create it if your distro does not).
- Credentials file is expected at /etc/cloudflared/vvz-core.json (0600).

Proof of Done
-------------
- curl -s https://core.voulezvous.tv/healthz  → HTTP/200

