# Hosts ↔ Tenants (Voulezvous)

**Tenant IDs**
- `ubl` — infraestrutura (API, identidade, políticas)
- `voulezvous` — app social de vídeo

**Hosts**
- `api.ubl.agency` → tenant `ubl`
- `voulezvous.tv` → tenant `voulezvous`
- `www.voulezvous.tv` → tenant `voulezvous`
- `admin.voulezvous.tv` → tenant `voulezvous` (gated por Cloudflare Access)

**Constantes canônicas (OMNI)**
- Modes: `Party`, `Circle`, `Roulette`, `Stage`
- Universal switch: `Live` (🔴), com opção `REC` (gravação)
- Utility: `Mirror` (pré-visualização local de câmera; não altera presença)

**Deep Links**
- `omni://room/{room_id}`
- `omni://profile/{user_id}`
- `omni://invite/{invite_id}`
- Stage público: `https://voulezvous.tv/@{user}`
