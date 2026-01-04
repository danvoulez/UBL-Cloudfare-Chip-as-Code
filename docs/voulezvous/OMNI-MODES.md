# OMNI Modes — Definições oficiais

- **Party** — overlay social sobre a TV 24h. TV segue tocando (coluna esquerda). Drawer à direita com pessoas online, reações, chat leve e Action Bar.
- **Circle** — sala por convite (1+). Vídeo em grupo. Membership claro por sessão. Gate para gravação (REC) com consentimento.
- **Roulette** — descoberta 1:1 com `Next`. Guardrails: rate-limit, cooldown, block/report imediato.
- **Stage** — broadcast público `voulezvous.tv/@user`. Estados: Offline, Live, Replay (fase 2).
- **Live (🔴)** — switch universal de câmera ativa. **Não** é modo.
- **Mirror** — utilitário local de pré-visualização de câmera (com/sem REC); não muda presença nem modo.

**Strong Presence Lock**
Um device só ocupa **um** strong mode por vez. Todos conflitam (Party↔Circle↔Roulette↔Stage). Transições ocorrem por **gate** curto e sem reload do player.
