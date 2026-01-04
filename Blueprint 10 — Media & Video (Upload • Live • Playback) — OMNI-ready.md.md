Blueprint 10 já “completo de vídeo”, plugado no OMNI (Party/Circle/Roulette/Stage + 🔴 Live), com latência baixa, playback contínuo sem reload, e caminhos claros de custo/offload nos LABs.

Blueprint 10 — Media & Video (Upload • Live • Playback) — OMNI-ready

0) Objetivo & Escopo (P0)
	•	Upload criptografado no cliente (server-blind), presign R2, commit/verificação, preview/thumbnail.
	•	Live:
	•	Tempo real (sub-400 ms) via WebRTC+SFU para Duo, Circle, Roulette e presence video em Party.
	•	Near-real-time (1–2 s) via LL-HLS/CMAF para Stage (broadcast público) e replays curtos.
	•	Playback contínuo (sem recarregar página e sem interromper o vídeo) com um player persistente.
	•	Stage URL estável (voulezvous.tv/@user) com estados: offline / live / replay.
	•	Políticas de retenção, links temporários, SLOs, observabilidade e controle de custos com offload para LAB 512/256.

⸻

1) OMNI → requisitos de mídia (resumo)

Modo	Audiência	Latência alvo	Caminho técnico	Gravação
Party	watchers do canal	~200–400 ms (presence)	WebRTC SFU leve (1→N pequeno)	opcional (off)
Duo	1:1	~150–300 ms	WebRTC P2P ou via SFU	opt-in (consent gate)
Circle	grupo conhecido	~200–400 ms	WebRTC SFU	opt-in (consent gate)
Roulette	pares efêmeros	~150–300 ms	WebRTC SFU + Next	sem gravação (P0)
Stage	público geral	1–2 s	LL-HLS/CMAF (origin edge/LAB)	on por criador (VOD)

🔴 Live é um switch universal, não um modo: liga/desliga câmera no contexto do modo atual. Presence Lock impede “modos fortes” simultâneos.

⸻

2) Três trilhas de mídia

A) Upload cifrado (server-blind)
	•	media@v1.presign → PUT ciphertext → media@v1.commit (verifica bytes+sha256 do ciphertext).
	•	Preview: gerado no cliente (Canvas/ffmpeg.wasm) e publicado como thumb_media_id.
	•	Storage: R2 (tenant/{t}/room/{r}/YYYY/MM/DD/{media_id}); índice leve em KV/D1.
	•	Links: GET assinado (TTL curto) ou gateway streaming com Range.

B) Live tempo real (WebRTC+SFU)
	•	Sinalização via Gateway (WebSocket no Worker/Axum).
	•	SFU: roda no LAB 512 (prod) com fallback no LAB 256; TURN local opcional.
	•	E2EE opcional (Insertable Streams) para Duo/Circle.
	•	Tokens efêmeros (60–300 s) por sala/mode; ABAC/quotas/Presence Lock antes da entrada.
	•	Recording: só com consent gate; grava no LAB 512 (MP4/Matroska) e exporta segmentado para R2.

C) Live near-real-time (LL-HLS/CMAF)
	•	Ingest: WebRTC ou RTMP do app do criador → packager no LAB 512.
	•	Packaging: CMAF (2s chunks) + playlists delta; push para R2 (origin).
	•	Entrega: CDN/Worker → 1–2 s de atraso alvo.
	•	VOD: playlists fixadas após End Live.

⸻

3) Sessões e estados (FSM unificada)

StreamSession
	•	prepared → publishing → live → ending → archived
	•	Flags: mode (party|duo|circle|roulette|stage), live (on/off), recording (on/off).
	•	Gates: trocar de modo com live:on abre gate (“Encerrar sessão atual para trocar de modo?”).
	•	Presence Lock: 1 modo forte por device (resolve confusão; sem “Party+Stage”).

⸻

4) Infra & custos (Edge + LAB)
	•	Edge/Gateway (Worker/Axum): autentica, sinaliza WebRTC, emite tokens efêmeros, presign/commit, links temporários, ABAC/quotas/idempotência.
	•	LAB 512 (head): SFU, packager LL-HLS, transcoding, gravador, thumbnails pesados, antivírus P1, métricas prom/otlp.
	•	LAB 256/8GB (workers): transcoding leve, pré-processos.
	•	R2: origin (HLS, VOD, thumbs, ciphertext).
	•	Por que isso reduz custo: banda/CPU caros ficam nos LABs; R2+CDN barateia distribuição; só controle fica no Edge.

⸻

5) Privacidade & provas
	•	Server-blind por padrão (upload/mensagens cifrados no cliente).
	•	Live E2EE opcional (Duo/Circle).
	•	Recording: gate de consentimento (UI clara) + eventos ledger:
	•	proof.consent.start, proof.consent.stop, stream.recording.{start,stop}, replay.ready.
	•	Watermark discreto em Stage (P1), anti-restream.
	•	ZeroTrust: tokens efêmeros, ABAC forte, quotas por session_type.

⸻

6) APIs (MCP/REST) — contratos mínimos

6.1 MCP (via Office)
	•	media@v1.presign(room_id, mime, bytes, enc_meta?) → {media_id, upload{url,headers,expires_in}, max_bytes, checksum{algo}}
	•	media@v1.commit(media_id, sha256, bytes, thumb_media_id?) → {ok:true}
	•	media@v1.get_link(media_id, dl?, range?) → {url, ttl_s}
	•	stream@v1.prepare(mode, audience, title?) → {session_id, sfu_url?, ingest, tokens{pub,sub}}
	•	stream@v1.go_live(session_id, recording?) → {ok:true, playback{type:"webrtc"|"ll-hls", url}}
	•	stream@v1.end(session_id) → {ok:true, replay_media_id?}
	•	stream@v1.tokens.refresh(session_id) → {tokens{pub,sub}}
	•	stream@v1.snapshot(session_id) → {thumb_media_id}

6.2 REST interno (Gateway)
	•	POST /internal/media/presign · POST /internal/media/commit · GET /internal/media/link/:id
	•	POST /internal/stream/prepare · POST /internal/stream/go_live · POST /internal/stream/end
	•	POST /internal/stream/tokens/refresh · POST /internal/stream/snapshot

Meta obrigatória em MCP: version, client_id, op_id, correlation_id, session_type, mode, scope{tenant,...} (idempotência + ABAC).

⸻

7) Player & UI (sem reload e sem cortar vídeo)
	•	Player persistente (<VideoShell/>) fora do router, preservado entre telas/modos.
	•	Troca por gate overlay: muda estado do player, não desmonta o elemento.
	•	WebRTC: renegotiation suave (muda tracks sem fechar peer).
	•	LL-HLS: seamless source switch (pre-buffer e setMediaKeys se DRM for usado).
	•	Deep links universais**: omni://room/{id}, omni://stage/{user}, omni://invite/{id} — navegação previsível.

⸻

8) Observabilidade & SLOs

Métricas principais
	•	webrtc.join.latency_ms, webrtc.rtt_ms, webrtc.jitter_ms, webrtc.packets_lost_rate
	•	sfu.room.participants, sfu.cpu, sfu.egress_mbps, sfu.recording.status
	•	hls.buffer_health_s, hls.rebuffer.count, hls.latency_s
	•	media.{presign,commit,get_link}.count|latency|errors
	•	cost.egress_gb, cost.transcode_hours (estimado)

SLOs
	•	Join WebRTC p99 < 800 ms
	•	Stage start-to-first-frame LL-HLS p95 < 2.5 s
	•	Rebuffer rate < 1.5% / sessão
	•	Presign p99 < 150 ms, Link p99 < 120 ms

⸻

9) Custos: o que pesa & como offload
	•	Banda de rede (egress CDN): maior custo em broadcast. → HLS em CDN + cache agressivo; VBR adaptativo; cap de bitrate por rede.
	•	Transcoding: caro em cloud. → LAB 512 roda packager/transcoder; empurra CMAF para R2.
	•	SFU CPU/egress: linear com “N × bitrates”. → Simulcast/SVC + mute por background + cap por Circle.
	•	Storage: VOD longo pesa. → políticas ephemeral/standard/archival; GC diário.

⸻

10) Retenção & GC
	•	Policies: ephemeral:7d, standard:90d (default), archival:365d.
	•	Cron: marca expirados em D1/KV → DELETE no R2 → ledger.media.expired.

⸻

11) DoD (Definition of Done, P0)
	•	✅ Upload cifrado (presign/commit/link) com thumbs no cliente
	•	✅ WebRTC SFU funcionando para Duo/Circle/Roulette/Party (presence), tokens efêmeros
	•	✅ Stage LL-HLS (1–2 s) com Stage URL estável e player persistente
	•	✅ Gates de transição (sem reload e sem cortar vídeo)
	•	✅ Recording com consent gate e publicação de replay (VOD curto)
	•	✅ Métricas e SLOs mínimos + GC de retenção
	•	✅ ABAC + quotas + idempotência em todas as rotas

⸻

12) Smoke (1 arquivo .http / 5 passos)
	1.	stream@v1.prepare(mode:"stage") → session_id
	2.	stream@v1.go_live(session_id, recording:true) → playback.url
	3.	Player abre playback.url (LL-HLS) → first-frame < 2.5 s
	4.	stream@v1.snapshot(session_id) → thumb_media_id
	5.	stream@v1.end(session_id) → replay_media_id (GET link toca)

(Para Duo/Circle: prepare → go_live (webrtc) → ping SFU RTT/jitter → end)

⸻

13) Entregáveis (checklist de implantação)
	•	Gateway/Edge
	•	WS de sinalização WebRTC; REST stream/*; media/*
	•	Bindings: R2_MEDIA, KV_MEDIA, D1_MEDIA, CRON_GC
	•	LAB 512
	•	SFU + TURN; Packager LL-HLS; Recorder; Thumbnails
	•	Exportar CMAF para R2; health + métricas Prom/OTLP
	•	Schemas/Contratos
	•	schemas/media.descriptor.v1.json, schemas/stream.session.v1.json
	•	MCP manifest com media@v1.*, stream@v1.*
	•	UI
	•	<VideoShell/> persistente; gates; seamless switch (WebRTC/LL-HLS)
	•	Stage page @user com estados (offline/live/replay)

⸻

14) Decisões travadas (ADR)
	•	ADR-VID-001: Player persistente, sem reload, com seamless switch.
	•	ADR-VID-002: WebRTC+SFU para modos sociais; LL-HLS para Stage.
	•	ADR-VID-003: Recording sob consent gate; ledger de consentimento.
	•	ADR-VID-004: Offload pesado (transcoding/SFU) para LAB 512; Edge só controla.

⸻

Próximo passo (1 tela, objetivo único)

Objetivo: “Hello, Stage” fim-a-fim em ambiente real.

Checklist
	1.	stream@v1.prepare(stage) no Gateway (token efêmero ok).
	2.	Packager no LAB 512 publicando CMAF em R2_MEDIA.
	3.	Stage page consumindo LL-HLS com <VideoShell/> persistente (sem reload).
	4.	end() fecha live e publica replay VOD.

Proof of Done
	•	Abrir voulezvous.tv/@lab512 → ver 🔴 Live com first-frame < 2.5 s e, após encerrar, replay disponível via link.

Se topar, eu te deixo agora o contrato MCP/REST em .http + os schemas JSON mínimos pra começar a integrar no IDE.