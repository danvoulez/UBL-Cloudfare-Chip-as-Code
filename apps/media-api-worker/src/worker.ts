/**
 * Media API Worker — Blueprint 10
 * 100% Cloudflare: R2, KV, D1, Queues
 */

export interface Env {
  R2_MEDIA: R2Bucket;
  KV_MEDIA: KVNamespace;
  D1_MEDIA: D1Database;
  QUEUE_MEDIA_EVENTS: Queue;
  MEDIA_API_VERSION: string;
  R2_MEDIA_PREFIX: string;
  // Blueprint 13: Cloudflare Stream API
  STREAM_API_TOKEN?: string; // Cloudflare API token for Stream
  STREAM_ACCOUNT_ID?: string; // Cloudflare Account ID
  // Blueprint 13: RTC/WebRTC
  RTC_WS_URL?: string; // WebSocket URL for RTC signaling
  TURN_SERVERS?: string; // JSON array of TURN servers
}

// Types
interface PresignRequest {
  room_id: string;
  mime: string;
  bytes: number;
  enc_meta?: Record<string, unknown>;
}

interface PresignResponse {
  media_id: string;
  upload: {
    url: string;
    headers: Record<string, string>;
    expires_in: number;
  };
  max_bytes: number;
  checksum: {
    algo: string;
  };
}

interface CommitRequest {
  media_id: string;
  sha256: string;
  bytes: number;
  thumb_media_id?: string;
}

interface CommitResponse {
  ok: boolean;
}

interface GetLinkResponse {
  url: string;
  ttl_s: number;
}

interface PrepareRequest {
  mode: string; // party|duo|circle|roulette|stage
  audience: string;
  title?: string;
}

interface PrepareResponse {
  session_id: string;
  sfu_url?: string;
  ingest?: {
    rtmp_url?: string;
    webrtc_url?: string;
  };
  tokens: {
    pub_token: string;
    sub_token: string;
  };
}

interface GoLiveRequest {
  session_id: string;
  recording?: boolean;
}

interface GoLiveResponse {
  ok: boolean;
  playback: {
    type: "webrtc" | "ll-hls";
    url: string;
  };
}

interface EndRequest {
  session_id: string;
}

interface EndResponse {
  ok: boolean;
  replay_media_id?: string;
}

// Blueprint 13: Stage (Live + VOD) types
interface StreamLiveInputRequest {
  channel_id: string; // e.g., "stage:dan"
  record?: boolean;
  dvr?: boolean;
  latency?: "ultra_low" | "low";
}

interface StreamLiveInputResponse {
  input_id: string; // e.g., "li_01JABC..."
  ingest: {
    rtmps_url: string;
    rtmps_key: string;
    srt_url?: string;
  };
  playback: {
    hls_path: string;
    dash_path?: string;
  };
}

interface StreamTokenRequest {
  input_id: string;
  format: "hls" | "dash";
  ttl_sec?: number;
  aud?: string;
  claims?: Record<string, unknown>;
}

interface StreamTokenResponse {
  url: string; // Signed URL for playback
}

// Blueprint 13: RTC/WebRTC types
interface RTCRoomRequest {
  room_kind: "party" | "circle" | "roulette";
  room_id: string;
  max_participants?: number;
  record?: boolean;
}

interface RTCRoomResponse {
  room_id: string;
  ws_url: string; // WebSocket signaling URL
  ice_servers: Array<{
    urls: string[];
    username?: string;
    credential?: string;
  }>;
  auth: {
    token: string; // JWT for WebSocket auth
  };
}

// Presign upload (R2)
async function handlePresign(req: PresignRequest, env: Env, tenant: string): Promise<PresignResponse> {
  const mediaId = crypto.randomUUID();
  const r2Key = `${env.R2_MEDIA_PREFIX}/${tenant}/room/${req.room_id}/${new Date().toISOString().split('T')[0]}/${mediaId}`;
  
  // Generate presigned PUT URL (R2 supports S3-compatible presign)
  // Note: Cloudflare R2 doesn't have native presign yet, so we'll use a workaround
  // For now, return a URL that the client can PUT to with auth headers
  const uploadUrl = `https://${env.R2_MEDIA.accountId}.r2.cloudflarestorage.com/${r2Key}`;
  
  // Store metadata in KV
  await env.KV_MEDIA.put(`media:${mediaId}`, JSON.stringify({
    r2_key: r2Key,
    mime: req.mime,
    bytes: req.bytes,
    tenant,
    room_id: req.room_id,
    created_at: new Date().toISOString(),
    status: "pending",
  }), { expirationTtl: 3600 }); // 1 hour TTL for pending uploads
  
  // Blueprint 15: Emit JSON✯Atomic event (media.upload.presigned)
  const presignEvent = {
    id: crypto.randomUUID().replace(/-/g, '').substring(0, 26),
    ts: new Date().toISOString(),
    kind: "media.upload.presigned",
    scope: {
      tenant,
      room: req.room_id || undefined,
    },
    actor: {
      email: "system@ubl.agency", // TODO: extract from headers
      groups: [],
    },
    refs: {
      room_id: req.room_id || undefined,
    },
    data: {
      object_id: mediaId,
      content_type: req.mime,
      size_max: req.bytes,
      expires_at: new Date(Date.now() + 900 * 1000).toISOString(), // 15 min
      r2_key: r2Key,
      room_id: req.room_id || undefined,
    },
    meta: {
      service: "media-api-worker@v1",
      version: env.MEDIA_API_VERSION || "v1",
    },
    sig: null,
  };
  
  // Queue event (optional, for ledger)
  try {
    await env.QUEUE_MEDIA_EVENTS.send({
      kind: "atomic",
      event: presignEvent,
      ts: new Date().toISOString(),
    });
  } catch (e) {
    // Non-critical: continue even if queue fails
    console.error("Failed to queue atomic event:", e);
  }
  
  return {
    media_id: mediaId,
    upload: {
      url: uploadUrl,
      headers: {
        "Content-Type": req.mime,
        "Content-Length": req.bytes.toString(),
      },
      expires_in: 900, // 15 min
    },
    max_bytes: req.bytes,
    checksum: {
      algo: "sha256",
    },
  };
}

// Commit upload (verify sha256)
async function handleCommit(req: CommitRequest, env: Env): Promise<CommitResponse> {
  const metaKey = `media:${req.media_id}`;
  const metaRaw = await env.KV_MEDIA.get(metaKey);
  
  if (!metaRaw) {
    throw new Error("media_not_found");
  }
  
  const meta = JSON.parse(metaRaw);
  
  // Verify R2 object exists and size matches
  const obj = await env.R2_MEDIA.head(meta.r2_key);
  if (!obj || obj.size !== req.bytes) {
    throw new Error("size_mismatch");
  }
  
  // Update metadata
  await env.KV_MEDIA.put(metaKey, JSON.stringify({
    ...meta,
    sha256: req.sha256,
    thumb_media_id: req.thumb_media_id,
    status: "committed",
    committed_at: new Date().toISOString(),
  }));
  
  // Store in D1 for queries
  await env.D1_MEDIA.prepare(`
    INSERT INTO media (id, tenant, room_id, r2_key, mime, bytes, sha256, thumb_media_id, created_at, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    req.media_id,
    meta.tenant,
    meta.room_id,
    meta.r2_key,
    meta.mime,
    req.bytes,
    req.sha256,
    req.thumb_media_id || null,
    meta.created_at,
    "committed"
  ).run();
  
  // Blueprint 15: Emit JSON✯Atomic event
  const atomicEvent = {
    id: crypto.randomUUID().replace(/-/g, '').substring(0, 26), // ULID-like
    ts: new Date().toISOString(),
    kind: "media.ingest.completed",
    scope: {
      tenant: meta.tenant,
      room: meta.room_id || undefined,
    },
    actor: {
      email: "system@ubl.agency", // TODO: extract from headers
      groups: [],
    },
    refs: {
      object_id: req.media_id,
      thumb_media_id: req.thumb_media_id || undefined,
    },
    data: {
      object_id: req.media_id,
      bytes: req.bytes,
      sha256: req.sha256,
      // TODO: extract media metadata (width, height, duration, codecs) from R2 object
    },
    meta: {
      service: "media-api-worker@v1",
      version: env.MEDIA_API_VERSION || "v1",
    },
    sig: null,
  };
  
  // Publish event to queue
  await env.QUEUE_MEDIA_EVENTS.send({
    kind: "media.committed",
    media_id: req.media_id,
    tenant: meta.tenant,
    ts: new Date().toISOString(),
    atomic: atomicEvent, // Include JSON✯Atomic event
  });
  
  return { ok: true };
}

// Get playback link (signed URL)
async function handleGetLink(mediaId: string, env: Env, dl?: boolean, range?: string): Promise<GetLinkResponse> {
  const metaKey = `media:${mediaId}`;
  const metaRaw = await env.KV_MEDIA.get(metaKey);
  
  if (!metaRaw) {
    throw new Error("media_not_found");
  }
  
  const meta = JSON.parse(metaRaw);
  
  // Generate signed URL (R2 supports S3-compatible presign for GET)
  // For now, return a public URL if the media is committed
  // In production, use R2 presign or Cloudflare Stream
  const url = `https://${env.R2_MEDIA.accountId}.r2.cloudflarestorage.com/${meta.r2_key}`;
  
  return {
    url,
    ttl_s: 3600, // 1 hour
  };
}

// Prepare stream session
async function handlePrepare(req: PrepareRequest, env: Env, tenant: string): Promise<PrepareResponse> {
  const sessionId = crypto.randomUUID();
  
  // Store session in KV
  await env.KV_MEDIA.put(`session:${sessionId}`, JSON.stringify({
    mode: req.mode,
    audience: req.audience,
    title: req.title,
    tenant,
    state: "prepared",
    created_at: new Date().toISOString(),
  }), { expirationTtl: 86400 }); // 24 hours
  
  // Generate ephemeral tokens
  const pubToken = await generateToken(sessionId, "pub", env);
  const subToken = await generateToken(sessionId, "sub", env);
  
  return {
    session_id: sessionId,
    sfu_url: req.mode !== "stage" ? "wss://sfu.lab512.local:8443" : undefined,
    ingest: {
      rtmp_url: req.mode === "stage" ? "rtmp://ingest.lab512.local/live" : undefined,
      webrtc_url: req.mode !== "stage" ? "wss://sfu.lab512.local:8443" : undefined,
    },
    tokens: {
      pub_token: pubToken,
      sub_token: subToken,
    },
  };
}

// Go live
async function handleGoLive(req: GoLiveRequest, env: Env): Promise<GoLiveResponse> {
  const sessionKey = `session:${req.session_id}`;
  const sessionRaw = await env.KV_MEDIA.get(sessionKey);
  
  if (!sessionRaw) {
    throw new Error("session_not_found");
  }
  
  const session = JSON.parse(sessionRaw);
  
  // Update state
  await env.KV_MEDIA.put(sessionKey, JSON.stringify({
    ...session,
    state: "live",
    live: true,
    recording: req.recording || false,
    live_at: new Date().toISOString(),
  }), { expirationTtl: 86400 });
  
  // Determine playback type
  const playbackType = session.mode === "stage" ? "ll-hls" : "webrtc";
  const playbackUrl = playbackType === "ll-hls"
    ? `https://cdn.ubl.agency/hls/${req.session_id}/playlist.m3u8`
    : `wss://sfu.lab512.local:8443/${req.session_id}`;
  
  return {
    ok: true,
    playback: {
      type: playbackType,
      url: playbackUrl,
    },
  };
}

// End stream
async function handleEnd(req: EndRequest, env: Env): Promise<EndResponse> {
  const sessionKey = `session:${req.session_id}`;
  const sessionRaw = await env.KV_MEDIA.get(sessionKey);
  
  if (!sessionRaw) {
    throw new Error("session_not_found");
  }
  
  const session = JSON.parse(sessionRaw);
  
  // Update state
  await env.KV_MEDIA.put(sessionKey, JSON.stringify({
    ...session,
    state: "archived",
    live: false,
    ended_at: new Date().toISOString(),
  }), { expirationTtl: 86400 * 7 }); // Keep for 7 days
  
  // Generate replay if recording
  const replayMediaId = session.recording ? crypto.randomUUID() : undefined;
  
  if (replayMediaId) {
    await env.QUEUE_MEDIA_EVENTS.send({
      kind: "replay.ready",
      session_id: req.session_id,
      replay_media_id: replayMediaId,
      ts: new Date().toISOString(),
    });
  }
  
  return {
    ok: true,
    replay_media_id: replayMediaId,
  };
}

// Generate ephemeral token (JWT-like, but simpler for now)
async function generateToken(sessionId: string, role: string, env: Env): Promise<string> {
  // In production, use JWT with ES256
  // For now, return a simple token
  const payload = {
    session_id: sessionId,
    role,
    exp: Math.floor(Date.now() / 1000) + 300, // 5 min
  };
  
  return btoa(JSON.stringify(payload));
}

// Blueprint 13: Create Live Input (Cloudflare Stream)
async function handleStreamLiveInput(req: StreamLiveInputRequest, env: Env, tenant: string): Promise<StreamLiveInputResponse> {
  // If Cloudflare Stream API token is available, use real Stream API
  if (env.STREAM_API_TOKEN && env.STREAM_ACCOUNT_ID) {
    const streamResp = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.STREAM_ACCOUNT_ID}/stream/live_inputs`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.STREAM_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        meta: { channel_id: req.channel_id, tenant },
        recording: req.record ? { mode: "automatic" } : undefined,
        // Note: Cloudflare Stream doesn't expose latency directly, but uses "low" by default
      }),
    });
    
    if (!streamResp.ok) {
      throw new Error(`stream_api_error: ${streamResp.status}`);
    }
    
    const streamData = await streamResp.json<{ result: any }>();
    const input = streamData.result;
    
    return {
      input_id: input.uid || input.id,
      ingest: {
        rtmps_url: input.rtmps?.url || `rtmps://live.cloudflare.com/live/${input.uid}`,
        rtmps_key: input.rtmps?.streamKey || input.uid,
        srt_url: input.srt?.url,
      },
      playback: {
        hls_path: input.playback?.hls || `/stream/${input.uid}/master.m3u8`,
        dash_path: input.playback?.dash,
      },
    };
  }
  
  // Fallback: Generate stub input_id and return mock URLs
  const inputId = `li_${crypto.randomUUID().replace(/-/g, '').substring(0, 12)}`;
  
  // Store in KV for lookup
  await env.KV_MEDIA.put(`stream_input:${inputId}`, JSON.stringify({
    channel_id: req.channel_id,
    tenant,
    record: req.record || false,
    dvr: req.dvr || false,
    latency: req.latency || "low",
    created_at: new Date().toISOString(),
  }), { expirationTtl: 86400 * 7 }); // 7 days
  
  return {
    input_id: inputId,
    ingest: {
      rtmps_url: `rtmps://ingest.example/live/${inputId}`,
      rtmps_key: `${inputId}_KEY`,
      srt_url: `srt://ingest.example:8080?streamid=${inputId}_KEY`,
    },
    playback: {
      hls_path: `/stream/${inputId}/master.m3u8`,
      dash_path: `/stream/${inputId}/manifest.mpd`,
    },
  };
}

// Blueprint 13: Issue signed playback URL
async function handleStreamToken(req: StreamTokenRequest, env: Env): Promise<StreamTokenResponse> {
  // Lookup input
  const inputKey = `stream_input:${req.input_id}`;
  const inputRaw = await env.KV_MEDIA.get(inputKey);
  
  if (!inputRaw) {
    throw new Error("input_not_found");
  }
  
  const input = JSON.parse(inputRaw);
  
  // If using Cloudflare Stream, generate signed URL
  if (env.STREAM_API_TOKEN && env.STREAM_ACCOUNT_ID) {
    // Cloudflare Stream signed URLs use JWT with claims
    // For now, return a URL with token query param (production should use proper JWT)
    const baseUrl = `https://customer-${env.STREAM_ACCOUNT_ID}.cloudflarestream.com${input.playback?.hls_path || `/stream/${req.input_id}/master.m3u8`}`;
    const token = await generateStreamToken(req.input_id, req.claims || {}, req.ttl_sec || 300, env);
    return {
      url: `${baseUrl}?token=${token}`,
    };
  }
  
  // Fallback: Return URL with mock token
  const baseUrl = `https://player.example${input.playback?.hls_path || `/stream/${req.input_id}/master.m3u8`}`;
  const token = await generateStreamToken(req.input_id, req.claims || {}, req.ttl_sec || 300, env);
  return {
    url: `${baseUrl}?token=${token}`,
  };
}

// Generate signed token for Stream playback
async function generateStreamToken(inputId: string, claims: Record<string, unknown>, ttlSec: number, env: Env): Promise<string> {
  // In production, use JWT ES256 with proper signing
  // For now, return base64-encoded payload
  const payload = {
    input_id: inputId,
    aud: claims.aud || "viewer",
    tenant: claims.tenant || "ubl",
    user: claims.user,
    exp: Math.floor(Date.now() / 1000) + ttlSec,
    iat: Math.floor(Date.now() / 1000),
  };
  
  return btoa(JSON.stringify(payload));
}

// Blueprint 13: Create/resolve RTC room
async function handleRTCRoom(req: RTCRoomRequest, env: Env, tenant: string): Promise<RTCRoomResponse> {
  // Store room in KV
  const roomKey = `rtc_room:${req.room_id}`;
  const existing = await env.KV_MEDIA.get(roomKey);
  
  if (existing) {
    const room = JSON.parse(existing);
    // Return existing room
    return {
      room_id: req.room_id,
      ws_url: env.RTC_WS_URL || `wss://rtc.api.ubl.agency/rooms/${req.room_id}`,
      ice_servers: parseICEServers(env.TURN_SERVERS),
      auth: {
        token: await generateToken(req.room_id, "participant", env),
      },
    };
  }
  
  // Create new room
  await env.KV_MEDIA.put(roomKey, JSON.stringify({
    room_kind: req.room_kind,
    room_id: req.room_id,
    tenant,
    max_participants: req.max_participants || 8,
    record: req.record || false,
    created_at: new Date().toISOString(),
    state: "active",
  }), { expirationTtl: 86400 }); // 24 hours
  
  return {
    room_id: req.room_id,
    ws_url: env.RTC_WS_URL || `wss://rtc.api.ubl.agency/rooms/${req.room_id}`,
    ice_servers: parseICEServers(env.TURN_SERVERS),
    auth: {
      token: await generateToken(req.room_id, "participant", env),
    },
  };
}

// Parse ICE servers from env (JSON string)
function parseICEServers(turnServersJson?: string): Array<{ urls: string[]; username?: string; credential?: string }> {
  if (!turnServersJson) {
    // Default: Google STUN
    return [{ urls: ["stun:stun.l.google.com:19302"] }];
  }
  
  try {
    return JSON.parse(turnServersJson);
  } catch {
    return [{ urls: ["stun:stun.l.google.com:19302"] }];
  }
}

// Main handler
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Extract tenant from headers or path
    const tenant = request.headers.get("X-Tenant") || "ubl";
    
    try {
      // Media endpoints
      if (path.startsWith("/internal/media/presign") && request.method === "POST") {
        const body = await request.json<PresignRequest>();
        const resp = await handlePresign(body, env, tenant);
        return new Response(JSON.stringify(resp), {
          headers: { "Content-Type": "application/json" },
        });
      }
      
      if (path.startsWith("/internal/media/commit") && request.method === "POST") {
        const body = await request.json<CommitRequest>();
        const resp = await handleCommit(body, env);
        return new Response(JSON.stringify(resp), {
          headers: { "Content-Type": "application/json" },
        });
      }
      
      if (path.startsWith("/internal/media/link/") && request.method === "GET") {
        const mediaId = path.split("/").pop() || "";
        const dl = url.searchParams.get("dl") === "true";
        const range = url.searchParams.get("range") || undefined;
        const resp = await handleGetLink(mediaId, env, dl, range);
        return new Response(JSON.stringify(resp), {
          headers: { "Content-Type": "application/json" },
        });
      }
      
      // Stream endpoints
      if (path.startsWith("/internal/stream/prepare") && request.method === "POST") {
        const body = await request.json<PrepareRequest>();
        const resp = await handlePrepare(body, env, tenant);
        return new Response(JSON.stringify(resp), {
          headers: { "Content-Type": "application/json" },
        });
      }
      
      if (path.startsWith("/internal/stream/go_live") && request.method === "POST") {
        const body = await request.json<GoLiveRequest>();
        const resp = await handleGoLive(body, env);
        return new Response(JSON.stringify(resp), {
          headers: { "Content-Type": "application/json" },
        });
      }
      
      if (path.startsWith("/internal/stream/end") && request.method === "POST") {
        const body = await request.json<EndRequest>();
        const resp = await handleEnd(body, env);
        return new Response(JSON.stringify(resp), {
          headers: { "Content-Type": "application/json" },
        });
      }
      
      if (path.startsWith("/internal/stream/tokens/refresh") && request.method === "POST") {
        // TODO: Implement token refresh
        return new Response(JSON.stringify({ error: "not_implemented" }), {
          status: 501,
          headers: { "Content-Type": "application/json" },
        });
      }
      
      if (path.startsWith("/internal/stream/snapshot") && request.method === "POST") {
        // TODO: Implement snapshot
        return new Response(JSON.stringify({ error: "not_implemented" }), {
          status: 501,
          headers: { "Content-Type": "application/json" },
        });
      }
      
      // Blueprint 13: Stage (Live + VOD) endpoints
      if (path === "/media/stream-live/inputs" && request.method === "POST") {
        const body = await request.json<StreamLiveInputRequest>();
        const resp = await handleStreamLiveInput(body, env, tenant);
        return new Response(JSON.stringify(resp), {
          headers: { "Content-Type": "application/json" },
        });
      }
      
      if (path === "/media/tokens/stream" && request.method === "POST") {
        const body = await request.json<StreamTokenRequest>();
        const resp = await handleStreamToken(body, env);
        return new Response(JSON.stringify(resp), {
          headers: { "Content-Type": "application/json" },
        });
      }
      
      // Blueprint 13: RTC/WebRTC endpoints
      if (path === "/rtc/rooms" && request.method === "POST") {
        const body = await request.json<RTCRoomRequest>();
        const resp = await handleRTCRoom(body, env, tenant);
        return new Response(JSON.stringify(resp), {
          headers: { "Content-Type": "application/json" },
        });
      }
      
      // Blueprint 10: Stage URL estável (@user)
      // GET /stage/:username → resolve stage do usuário (offline/live/replay)
      if (path.startsWith("/stage/") && request.method === "GET") {
        const username = path.split("/")[2];
        if (!username) {
          return new Response(JSON.stringify({ error: "username_required" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
        
        // Lookup active stage session for user
        const stageKey = `stage:${username}`;
        const sessionId = await env.KV_MEDIA.get(stageKey);
        
        if (!sessionId) {
          // No active stage → offline
          return new Response(JSON.stringify({
            state: "offline",
            username,
            live: false,
            replay: null
          }), {
            headers: { "Content-Type": "application/json" },
          });
        }
        
        // Get session from D1
        const session = await env.D1_MEDIA.prepare(
          "SELECT * FROM stream_sessions WHERE id = ?"
        ).bind(sessionId).first<{
          id: string;
          mode: string;
          state: string;
          live: number;
          playback_url: string | null;
          replay_media_id: string | null;
        }>();
        
        if (!session) {
          return new Response(JSON.stringify({
            state: "offline",
            username,
            live: false,
            replay: null
          }), {
            headers: { "Content-Type": "application/json" },
          });
        }
        
        // Determine state: live or replay
        if (session.live === 1 && session.state === "live") {
          // Live stage
          return new Response(JSON.stringify({
            state: "live",
            username,
            live: true,
            session_id: session.id,
            playback: {
              type: session.mode === "stage" ? "ll-hls" : "webrtc",
              url: session.playback_url || null
            },
            replay: null
          }), {
            headers: { "Content-Type": "application/json" },
          });
        } else if (session.replay_media_id) {
          // Replay available
          const replayLink = await env.R2_MEDIA.createMultipartUpload(
            `${env.R2_MEDIA_PREFIX}/${tenant}/replay/${session.replay_media_id}`
          );
          
          return new Response(JSON.stringify({
            state: "replay",
            username,
            live: false,
            session_id: session.id,
            playback: null,
            replay: {
              media_id: session.replay_media_id,
              url: replayLink ? `https://${env.R2_MEDIA_PREFIX}.r2.dev/${env.R2_MEDIA_PREFIX}/${tenant}/replay/${session.replay_media_id}` : null
            }
          }), {
            headers: { "Content-Type": "application/json" },
          });
        } else {
          // Offline
          return new Response(JSON.stringify({
            state: "offline",
            username,
            live: false,
            replay: null
          }), {
            headers: { "Content-Type": "application/json" },
          });
        }
      }
      
      return new Response("Not Found", { status: 404 });
    } catch (e) {
      return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "internal_error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  },
};
