Blueprint 07 — Messenger (PWA + MCP Client)

Versão: v1.0 • Data: 2026-01-03 • Status: P0 Canônico
Escopo: UI humana (web/PWA) para conversa, presença e chamadas leves. Fala com o Gateway/Core API para domínio e com o Office (RoomDO/WebSocket) para presença/eventos. Server-blind, Chip-as-Code-compliant, pronto para evoluir ao OMNI.

⸻

0) Invariantes (não negociáveis)
	•	MUST UI humana (não roda lógica de negócio).
	•	MUST Autentica via Identity & Access (Blueprint 06); tokens curtos.
	•	MUST Presença/eventos via WS do Office (RoomDO); REST só para writes de domínio no Gateway.
	•	MUST CipherEnvelope (conteúdo cifrado ou minimizado); servidor não lê plaintext.
	•	MUST Acessibilidade (WCAG AA), performance orçada e “no-reload” nas transições.
	•	SHOULD Suporte offline básico (PWA) e fila de envios.
	•	MAY E2EE por sala (chave de sessão) com rekey em troca de membros.

⸻

1) Objetos mínimos (contratos do cliente)
	•	Room { id, kind: "dm"|"group"|"system", members[], policy }
	•	Presence { user_id, state: "online"|"typing"|"away", at }
	•	Message { id, room_id, author, sent_at, envelope: CipherEnvelope }
	•	CipherEnvelope { ver, alg, hdr(min), ciphertext, mac }
	•	Invite { id, from, to, room_id, ttl, state }

Hdr(min) nunca inclui plaintext; apenas IDs, hints e contadores. Conteúdo vai cifrado.

⸻

2) Arquitetura (client-first, sem acoplamento)

Camadas do App (SPA)
	•	Shell (layout, theming, PWA, router no-reload)
	•	State (room store, message store, presence store)
	•	Transports
	•	WS (Office/RoomDO): subscribe a presence, message.created, invite.*
	•	REST (Gateway/Core): POST /messenger/send, POST /media/presign, GET /rooms/*, POST /invites/*
	•	Crypto (E2EE opcional por sala: derive, rotate, seal/open)
	•	UI Kit (Action Bar, Composer, MessageList, ProfileSheet, Toasts)

Fluxo write (DRY)
UI → REST /messenger/send → Gateway valida (ABAC/quotas/idempotência) → grava/apendiza evento → Office publica no WS → UI recebe eco no canal.

⸻

3) UX canônico (componentes fixos)
	•	Header (identidade, status, 🔴 Live se acoplado ao OMNI no futuro — “switch universal”, desligado por padrão aqui)
	•	RoomsPanel (busca, pins, convites)
	•	Thread (MessageList virtualizada + Composer)
	•	ProfileSheet (drawer com Action Bar padrão: Call · Invite · Message · Follow · ⋯)
	•	InvitesTab (lugar único de convites; zero pop-ups confusos)

Transições sem reload / sem interromper mídia
	•	Router interno (URL estável) + Room hot-swap preservando o player (se presente) em floating layer (PiP/overlay).
	•	Gate leve só quando mudar contexto forte (ex.: sair de call).

⸻

4) Performance & SLOs (cliente)
	•	TTI < 2,5 s em rede 4G (first load)
	•	Input→Send < 80 ms (local ack)
	•	Render de nova msg < 16 ms (pico) com lista virtualizada
	•	WS reconectar < 500 ms (retomar últimos N eventos)
	•	Bundle base < 200 KB gz + lazy por rota

⸻

5) Privacidade & Segurança
	•	Server-blind: nada de plaintext em logs; envelope cifrado.
	•	Key mgmt (P0): chave de sala derivada por criador; rekey em members change.
	•	CSRF: REST mutável com token; Bearer nos canais MCP/REST.
	•	Rate/Quota: segue session_type (Blueprint Office).
	•	Métricas cliente (opt-in): latência WS, falhas send, render timings.

⸻

6) Integrações cruciais
	•	Office (Blueprint 08): WS room.subscribe(room_id) → presence.update, message.created, invite.*.
	•	Core API (Blueprint 03): REST contratos de messenger/media/invites.
	•	Files (Blueprint 04): media/presign → PUT cifrado em R2 → mensagem referencia media_id.
	•	Webhooks (Blueprint 05): entrega de notificações externas (push/email) com W_Webhook_Verified.

⸻

7) P0 Escopo (entregável fechado)
	1.	Login + sessão (Blueprint 06) + WS conectado (Office)
	2.	Listar rooms + abrir thread sem reload
	3.	Enviar texto (CipherEnvelope) + eco via WS
	4.	Typing e presence em tempo real
	5.	Imagem/arquivo via presign (R2) + preview seguro
	6.	Invites: criar, aceitar, expirar (UI única)
	7.	Search local (rooms/people) e “pin” de conversas
	8.	PWA básico: ícone, offline cache shell + fila de send

⸻

8) P1 (logo depois)
	•	E2EE de grupo com rekey automático (de-/re-envelope)
	•	Read receipts agregados (sem micro-spam)
	•	Calls leves (WebRTC 1:1) com gate simples
	•	Mensagens de sistema (join/leave/rekey)
	•	Theming & acessibilidade avançada

⸻

9) DoD (Definition of Done)
	•	Suíte messenger-compliance.http PASS/NA.
	•	SLOs batidos (telemetria cliente).
	•	Logs server-blind no Gateway.
	•	WS recovery test: desconectar/reconectar → no message loss (até N eventos).
	•	Teste de anexos: upload cifrado → referência válida → preview controlado.

⸻

10) Deliverables (repo layout)

apps/messenger/
  src/
    app.tsx            # Shell + Router no-reload
    state/
      rooms.ts, thread.ts, presence.ts
    transports/
      ws.ts            # Office (RoomDO)
      rest.ts          # Gateway/Core
    crypto/
      envelope.ts      # seal/open + rekey
    ui/
      RoomsPanel.tsx
      Thread.tsx
      Composer.tsx
      MessageList.tsx  # virtualized
      ProfileSheet.tsx
      InvitesTab.tsx
  public/manifest.webmanifest
  tests/messenger-compliance.http


⸻

11) Provas & Gates de qualidade
	•	Proof of Done:
	1.	Vídeo demo: abrir 2 browsers → presence/typing → enviar msg/anexo → eco em ambos.
	2.	Matar WS de um lado → reconectar → recuperar últimas 50 mensagens.
	3.	Lighthouse PWA ≥ 90, A11y ≥ 90.
	•	Gates: não promove se Input→Send > 80 ms p95 ou se WS reconectar > 500 ms p95.

⸻

12) Notas de futuro (OMNI-ready)
	•	Player overlay já previsto (mantém mídia viva em troca de room).
	•	Action Bar compatível com Party/Circle/Roulette/Stage (mesmos verbos).
	•	Deep links (omni://room/{id}, omni://profile/{id}) para navegação uniforme.

Se estiver ok, sigo para o Blueprint 09 — Observability & Audit (telemetria server-blind + trilhas JSON Atomic), que amarra métricas, logs fixos e auditoria mínima para tudo acima.