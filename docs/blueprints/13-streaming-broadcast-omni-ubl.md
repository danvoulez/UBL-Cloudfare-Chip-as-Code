Blueprint 13 — Streaming/Broadcast Plan (OMNI + UBL)

Objetivo: entregar vídeo ao vivo e VOD com dois caminhos complementares — tempo real sub-segundo para interação (Party, Circle, Roulette) e broadcast escalável com gravação (Stage + VOD) — tudo rodando sobre Cloudflare e orquestrado pelo api.ubl.agency.

⸻

1) Mapas de uso → tecnologia

A. Interativo (sub-segundo): Party / Circle / Roulette
	•	Transporte: WebRTC via Cloudflare Realtime SFU (ou RealtimeKit no browser). Escala horizontal e TURN gerenciado, ideal para chamadas e salas pequenas/médias.  ￼
	•	Alternativa sub-segundo com ingest/playback 100% WebRTC: Stream WebRTC (WHIP/WHEP) – latência sub-segundo e viewers “ilimitados”, porém sem gravação nem mix com HLS/RTMP por enquanto (útil para pilots/POCs e eventos de baixa fricção).  ￼

B. Broadcast público (Stage) + VOD
	•	Transporte principal: Cloudflare Stream Live (ingest RTMPS/SRT) → playback HLS/DASH (LL-HLS ~2–5s). É o caminho “permanente” para gravação, DVR e replays.  ￼
	•	Segurança de playback: Signed URLs (token por sessão/tenant), emitidos pelo api.ubl.agency.  ￼

C. Mirror (Espelho)
	•	Preview local (sem uplink) com opção 🔴 Live (aciona A ou B conforme contexto).

⸻

2) Domínios, rotas e contratos
	•	Backend base: https://api.ubl.agency
	•	POST /media/stream-live/inputs → cria Live Input (RTMPS/SRT) + credenciais
	•	POST /media/tokens/stream → emite Signed URL para playback (TTL curto)  ￼
	•	POST /rtc/rooms → cria/resolve sala Realtime SFU (Party/Circle/Roulette)  ￼
	•	Stage URL estável (público): https://voulezvous.tv/@{user}
	•	Página única com estados: Offline / Live 🔴 / Replay (usa Stream + DVR/VOD).  ￼

⸻

3) Pipeline de ingest e entrega

Broadcast (Stage):
Creator envia RTMPS/SRT → Stream Live transcodifica e disponibiliza HLS/DASH (LL-HLS). Gravação automática habilita DVR/VOD.  ￼

Interativo (Party/Circle/Roulette):
Browsers/Apps publicam WebRTC → Realtime SFU roteia mídia entre participantes (sub-segundo). Para audiências maiores sem interação, use “Stage” (acima).  ￼

Sub-segundo alternativo (POC):
Stream WebRTC (WHIP/WHEP) para publish/play sub-segundo, ciente das limitações: sem gravação e não mistura com HLS/RTMP.  ￼

⸻

4) Custos e onde os LABs entram
	•	Stream cobra só por minutos armazenados e minutos entregues; ingress/encoding grátis e sem egress fee separado (o tráfego está incluso). Isso mantém previsibilidade de custo no Stage/VOD.  ￼
	•	Estratégia LAB (offload):
	•	VOD frio: exportar cópias/masters para MinIO no LAB 512 (tier frio) e manter no Stream apenas o que precisa de playback público imediato.
	•	Automação: usar R2 Event Notifications → Worker copia/compacta/expira conteúdo para LAB/S3-compatível.  ￼

⸻

5) Segurança e governança
	•	Gating do Stage: Signed URLs no player (web/app), emitidos por api.ubl.agency por usuário/sessão (aud/TTL/claims).  ￼
	•	Admin/operacional: rotas /admin/** já hardenizadas (Blueprint 12).
	•	Zero Trust: validação AUD e JWKS do Cloudflare Access onde aplicável (admin/ingest tools).

⸻

6) Observabilidade
	•	Viewer count & analytics: usar Stream Analytics / GraphQL para contagem ao vivo e métricas de entrega.
	•	SLOs: p99 join < 2s (WebRTC), start-to-first-frame HLS < 3s (LL-HLS) — alarmes integrados (Blueprint 11).

⸻

7) UI/UX (sem reload; vídeo contínuo)
	•	Gates como overlay: transições Party ↔ Circle ↔ Roulette ↔ Stage resolvidas no router do app (drawer/modal), mantendo:
	•	WebRTC: mesma RTCPeerConnection quando possível; se trocar de sala, faz hand-over sem encerrar o player (pré-negocia a próxima sala).
	•	HLS: player único (MSE) e troca de manifest por source-swap suave (mesmo elemento <video>).
	•	🔴 Live é switch universal; se mudar de modo com Live ativo, exiba gate de confirmação (sem recarregar página).

⸻

8) Checklist (1 tela) — “permanente” e acionável
	1.	Stage (Stream Live)
☐ Criar Live Input via API (SRT/RTMPS)
☐ Publicar com ffmpeg (SRT/RTMPS) e validar playback HLS/DASH
☐ Habilitar DVR/recording (VOD automático)
☐ Emitir Signed URL no api.ubl.agency e tocar no player web/app  ￼
	2.	Interativo (Realtime SFU)
☐ Provisionar sala via POST /rtc/rooms
☐ Conectar browsers com RealtimeKit (WebRTC)
☐ Medir join-time e estabilidade com 5+ peers  ￼
	3.	POC Sub-segundo alternativo (Stream WebRTC)
☐ Publicar com WHIP e consumir com WHEP (sem gravação)
☐ Validar latência sub-segundo e limites atuais  ￼
	4.	Offload LAB
☐ Habilitar R2 Event Notifications → Worker → MinIO (LAB 512)
☐ Políticas: “quente no Stream, frio no LAB” (listas por canal/idade)  ￼
	5.	SLO + Segurança
☐ Métricas de viewers e entrega (Stream Analytics)
☐ Signed URLs em produção + Access nos endpoints admin  ￼

Proof of Done:
	•	Link do Stage público voulezvous.tv/@{user} transmitindo ao vivo e reproduzindo Replay.
	•	Sala Circle com 4+ pessoas em WebRTC (sub-segundo), sem queda ao trocar Party↔Circle.
	•	Player sem reload ao trocar de modo; Signed URL válido é exigido para playback.
	•	Job de offload para LAB confirmando objetos copiados a cada novo VOD.

⸻

Se quiser, eu já te entrego os endpoints mínimos (/media/stream-live/inputs, /media/tokens/stream, /rtc/rooms) e o snippet do player HLS com Signed URL para colar no app — é só falar que eu escrevo agora.