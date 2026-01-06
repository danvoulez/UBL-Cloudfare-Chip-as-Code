// UBL ID — Identity Provider Worker
// Domínio: id.ubl.agency
// WebAuthn + Session + Device Flow

import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  AuthenticatorDevice,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/typescript-types';
import * as internal from './internal';

interface Env {
  UBL_DB: D1Database;
  UBL_FLAGS: KVNamespace;
  PASSKEY_CHALLENGE: KVNamespace;
  ISSUER_BASE: string;
  TOKEN_ISS: string;
  JWKS_URL: string;
  COOKIE_DOMAIN: string;
  RP_ID: string;
  SESSION_TTL_SECONDS: string;
  CHALLENGE_TTL_SECONDS: string;
  DEVICE_CODE_TTL_SECONDS: string;
  INTERNAL_AUTH_SECRET: string;
}

// Helper: gerar ULID simples (timestamp + random)
function ulid(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 11);
  return `${timestamp}${random}`.padEnd(26, '0').substring(0, 26);
}

// Helper: hash simples para IP+UA
function hashFingerprint(ip: string, ua: string): string {
  const str = `${ip}||${ua}`;
  return btoa(str).substring(0, 32);
}

// Helper: ler session do cookie
function getSessionId(cookie: string | null): string | null {
  if (!cookie) return null;
  const match = cookie.match(/sid=([^;]+)/);
  return match ? match[1] : null;
}

// Helper: set cookie sid
function setSessionCookie(sid: string, domain: string, maxAge: number): string {
  return `sid=${sid}; Path=/; Domain=${domain}; Secure; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

// Helper: expirar cookie
function expireCookie(domain: string): string {
  return `sid=; Path=/; Domain=${domain}; Secure; HttpOnly; SameSite=Lax; Max-Age=0`;
}

// POST /auth/passkey/register/start
async function handleRegisterStart(req: Request, env: Env): Promise<Response> {
  try {
    const username = (await req.json().catch(() => ({})) as any).username || undefined;

    // Gerar challenge
    const challenge = crypto.randomUUID();
    const options = await generateRegistrationOptions({
      rpName: 'UBL Agency',
      rpID: env.RP_ID,
      userID: ulid(), // será usado no finish
      userName: username || `user-${ulid().substring(0, 8)}`,
      timeout: 60000,
      attestationType: 'none',
      excludeCredentials: [], // pode preencher com passkeys existentes
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'preferred',
      },
    });

    // Salvar challenge em KV (5 min)
    await env.PASSKEY_CHALLENGE.put(
      `challenge:${challenge}`,
      JSON.stringify({ type: 'register', userID: options.user.id, username }),
      { expirationTtl: parseInt(env.CHALLENGE_TTL_SECONDS) }
    );

    return new Response(JSON.stringify({ publicKey: options }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// POST /auth/passkey/register/finish
async function handleRegisterFinish(req: Request, env: Env): Promise<Response> {
  try {
    const body = await req.json() as any;
    const { credential, challenge } = body;

    // Recuperar challenge
    const challengeData = await env.PASSKEY_CHALLENGE.get(`challenge:${challenge}`);
    if (!challengeData) {
      return new Response(JSON.stringify({ error: 'invalid_challenge' }), { status: 400 });
    }
    const { type, userID, username } = JSON.parse(challengeData);
    if (type !== 'register') {
      return new Response(JSON.stringify({ error: 'invalid_challenge_type' }), { status: 400 });
    }

    // Verificar resposta
    const verification = await verifyRegistrationResponse({
      response: credential,
      expectedChallenge: challenge,
      expectedOrigin: env.ISSUER_BASE,
      expectedRPID: env.RP_ID,
      requireUserVerification: false,
    });

    if (!verification.verified) {
      return new Response(JSON.stringify({ error: 'verification_failed' }), { status: 400 });
    }

    // Criar user
    const userId = ulid();
    await env.UBL_DB.prepare(
      'INSERT INTO users (id, username, created_at) VALUES (?, ?, unixepoch())'
    ).bind(userId, username || null).run();

    // Salvar passkey
    const credentialId = Buffer.from(verification.registrationInfo!.credentialID).toString('base64url');
    await env.UBL_DB.prepare(
      'INSERT INTO passkeys (id, user_id, public_key_cose, sign_count, transports, created_at) VALUES (?, ?, ?, ?, ?, unixepoch())'
    ).bind(
      credentialId,
      userId,
      Buffer.from(verification.registrationInfo!.credentialPublicKey),
      verification.registrationInfo!.counter || 0,
      JSON.stringify(verification.registrationInfo!.credentialDeviceType ? ['internal'] : [])
    ).run();

    // Criar session
    const sessionId = ulid();
    const csrf = crypto.randomUUID();
    const expiresAt = Math.floor(Date.now() / 1000) + parseInt(env.SESSION_TTL_SECONDS);
    await env.UBL_DB.prepare(
      'INSERT INTO sessions (id, user_id, csrf, expires_at, created_at) VALUES (?, ?, ?, ?, unixepoch())'
    ).bind(sessionId, userId, csrf, expiresAt).run();

    // Limpar challenge
    await env.PASSKEY_CHALLENGE.delete(`challenge:${challenge}`);

    return new Response(JSON.stringify({ ok: true, session_id: sessionId }), {
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': setSessionCookie(sessionId, env.COOKIE_DOMAIN, parseInt(env.SESSION_TTL_SECONDS)),
      },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// POST /auth/passkey/login/start
async function handleLoginStart(req: Request, env: Env): Promise<Response> {
  try {
    const challenge = crypto.randomUUID();
    const options = await generateAuthenticationOptions({
      rpID: env.RP_ID,
      timeout: 60000,
      userVerification: 'preferred',
      allowCredentials: [], // pode preencher com passkeys do user
    });

    // Salvar challenge
    await env.PASSKEY_CHALLENGE.put(
      `challenge:${challenge}`,
      JSON.stringify({ type: 'login' }),
      { expirationTtl: parseInt(env.CHALLENGE_TTL_SECONDS) }
    );

    return new Response(JSON.stringify({ publicKey: options }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// POST /auth/passkey/login/finish
async function handleLoginFinish(req: Request, env: Env): Promise<Response> {
  try {
    const body = await req.json() as any;
    const { credential, challenge } = body;

    // Recuperar challenge
    const challengeData = await env.PASSKEY_CHALLENGE.get(`challenge:${challenge}`);
    if (!challengeData) {
      return new Response(JSON.stringify({ error: 'invalid_challenge' }), { status: 400 });
    }
    const { type } = JSON.parse(challengeData);
    if (type !== 'login') {
      return new Response(JSON.stringify({ error: 'invalid_challenge_type' }), { status: 400 });
    }

    // Buscar passkey
    const credentialId = credential.id;
    const passkeyRow = await env.UBL_DB.prepare(
      'SELECT * FROM passkeys WHERE id = ?'
    ).bind(credentialId).first<{
      id: string;
      user_id: string;
      public_key_cose: ArrayBuffer;
      sign_count: number;
    }>();

    if (!passkeyRow) {
      return new Response(JSON.stringify({ error: 'passkey_not_found' }), { status: 404 });
    }

    // Verificar autenticação
    const verification = await verifyAuthenticationResponse({
      response: credential,
      expectedChallenge: challenge,
      expectedOrigin: env.ISSUER_BASE,
      expectedRPID: env.RP_ID,
      authenticator: {
        credentialID: Buffer.from(passkeyRow.id, 'base64url'),
        credentialPublicKey: new Uint8Array(passkeyRow.public_key_cose as any),
        counter: passkeyRow.sign_count,
      },
      requireUserVerification: false,
    });

    if (!verification.verified) {
      return new Response(JSON.stringify({ error: 'verification_failed' }), { status: 400 });
    }

    // Atualizar sign_count
    await env.UBL_DB.prepare(
      'UPDATE passkeys SET sign_count = ? WHERE id = ?'
    ).bind(verification.authenticationInfo.newCounter, credentialId).run();

    // Criar session
    const sessionId = ulid();
    const csrf = crypto.randomUUID();
    const expiresAt = Math.floor(Date.now() / 1000) + parseInt(env.SESSION_TTL_SECONDS);
    await env.UBL_DB.prepare(
      'INSERT INTO sessions (id, user_id, csrf, expires_at, created_at) VALUES (?, ?, ?, ?, unixepoch())'
    ).bind(sessionId, passkeyRow.user_id, csrf, expiresAt).run();

    // Limpar challenge
    await env.PASSKEY_CHALLENGE.delete(`challenge:${challenge}`);

    return new Response(JSON.stringify({ ok: true, session_id: sessionId }), {
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': setSessionCookie(sessionId, env.COOKIE_DOMAIN, parseInt(env.SESSION_TTL_SECONDS)),
      },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// GET /session
async function handleGetSession(req: Request, env: Env): Promise<Response> {
  try {
    const cookie = req.headers.get('Cookie');
    const sid = getSessionId(cookie);
    if (!sid) {
      return new Response(JSON.stringify({ ok: false, error: 'no_session' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Buscar session
    const session = await env.UBL_DB.prepare(
      'SELECT s.*, u.id as user_id, u.username FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.id = ? AND s.expires_at > unixepoch()'
    ).bind(sid).first<{
      id: string;
      user_id: string;
      username: string | null;
      csrf: string;
      expires_at: number;
    }>();

    if (!session) {
      return new Response(JSON.stringify({ ok: false, error: 'session_expired' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      user: { id: session.user_id, username: session.username },
      session: { id: session.id, expires_at: session.expires_at },
      scopes: [], // sintéticos, derivados de grupos/roles
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// POST /session/logout
async function handleLogout(req: Request, env: Env): Promise<Response> {
  try {
    const cookie = req.headers.get('Cookie');
    const sid = getSessionId(cookie);
    if (sid) {
      // Invalidar session
      await env.UBL_DB.prepare('DELETE FROM sessions WHERE id = ?').bind(sid).run();
      // Invalidar refresh tokens
      await env.UBL_DB.prepare('DELETE FROM refresh_tokens WHERE session_id = ?').bind(sid).run();
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': expireCookie(env.COOKIE_DOMAIN),
      },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// POST /device/start (Device Flow para voulezvous.tv)
async function handleDeviceStart(req: Request, env: Env): Promise<Response> {
  try {
    const body = await req.json().catch(() => ({})) as any;
    const { scope, audience, adult } = body;

    // Gerar códigos (compatível com kit - 6 caracteres alfanuméricos)
    const deviceCode = ulid();
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let userCode = '';
    for (let i = 0; i < 6; i++) {
      userCode += alphabet[Math.floor(Math.random() * alphabet.length)];
    }

    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + parseInt(env.DEVICE_CODE_TTL_SECONDS);

    await env.UBL_DB.prepare(
      'INSERT INTO device_codes (device_code, user_code, expires_at, created_at) VALUES (?, ?, ?, unixepoch())'
    ).bind(deviceCode, userCode, expiresAt).run();

    // Compatível com formato do kit
    const host = new URL(req.url).host;
    const base = `https://${host}`;
    return new Response(JSON.stringify({
      device_code: deviceCode,
      user_code: userCode,
      verification_uri: `${base}/activate`,
      verification_uri_complete: `${base}/activate?code=${userCode}`,
      expires_in: parseInt(env.DEVICE_CODE_TTL_SECONDS),
      interval: 5, // polling interval em segundos
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// POST /device/approve (compatibilidade com kit - aprovação simplificada)
async function handleDeviceApprove(req: Request, env: Env): Promise<Response> {
  try {
    const { user_code, subject } = await req.json() as any;
    
    if (!user_code || !subject) {
      return new Response(JSON.stringify({ ok: false, error: 'missing user_code or subject' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Buscar device_code pelo user_code
    const device = await env.UBL_DB.prepare(
      'SELECT * FROM device_codes WHERE user_code = ? AND expires_at > unixepoch()'
    ).bind(user_code).first<{
      device_code: string;
      user_code: string;
      user_id: string | null;
      session_id: string | null;
      approved_at: number | null;
    }>();

    if (!device) {
      return new Response(JSON.stringify({ ok: false, error: 'invalid_or_expired_user_code' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Criar session se não existir
    let sessionId = device.session_id;
    if (!sessionId) {
      sessionId = ulid();
      const csrf = crypto.randomUUID();
      const expiresAt = Math.floor(Date.now() / 1000) + parseInt(env.SESSION_TTL_SECONDS);
      await env.UBL_DB.prepare(
        'INSERT INTO sessions (id, user_id, csrf, expires_at, created_at) VALUES (?, ?, ?, ?, unixepoch())'
      ).bind(sessionId, subject, csrf, expiresAt).run();
    }

    // Marcar como aprovado
    await env.UBL_DB.prepare(
      'UPDATE device_codes SET user_id = ?, session_id = ?, approved_at = unixepoch() WHERE device_code = ?'
    ).bind(subject, sessionId, device.device_code).run();

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// POST /device/poll
async function handleDevicePoll(req: Request, env: Env): Promise<Response> {
  try {
    const { device_code } = await req.json() as any;

    const device = await env.UBL_DB.prepare(
      'SELECT * FROM device_codes WHERE device_code = ? AND expires_at > unixepoch()'
    ).bind(device_code).first<{
      device_code: string;
      user_code: string;
      user_id: string | null;
      session_id: string | null;
      approved_at: number | null;
    }>();

    if (!device) {
      return new Response(JSON.stringify({ ok: false, status: 'expired' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!device.approved_at) {
      return new Response(JSON.stringify({ ok: true, status: 'pending' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Aprovado: retornar tokens (será gerado pelo Core API via /tokens/mint)
    // Por compatibilidade com kit, retornamos info básica
    return new Response(JSON.stringify({
      ok: true,
      user_id: device.user_id,
      session_id: device.session_id,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

// GET /activate (página de ativação para scan/código)
async function handleActivate(req: Request, env: Env): Promise<Response> {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code') || '';
    
    const html = `<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>UBL ID — Activate Device</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      padding: 24px;
      max-width: 560px;
      margin: 0 auto;
      line-height: 1.6;
    }
    h1 { margin-top: 0; }
    code {
      background: #f5f5f5;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'SF Mono', Monaco, monospace;
    }
    .code-display {
      font-size: 2em;
      font-weight: bold;
      letter-spacing: 0.1em;
      text-align: center;
      padding: 16px;
      background: #f0f0f0;
      border-radius: 8px;
      margin: 16px 0;
    }
  </style>
</head>
<body>
  <h1>🔐 Authenticate Device</h1>
  <p>Enter this code after logging in:</p>
  <div class="code-display">${code || '—'}</div>
  <p><strong>Next steps:</strong></p>
  <ol>
    <li>Log in with your Passkey at <code>id.ubl.agency</code></li>
    <li>POST to <code>/device/approve</code> with:</li>
  </ol>
  <pre><code>{
  "user_code": "${code}",
  "subject": "&lt;your-user-id&gt;"
}</code></pre>
  <p><small>Or scan the QR code if available.</small></p>
</body>
</html>`;

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    
    // Health check
    if (url.pathname === '/healthz' && req.method === 'GET') {
      return new Response(JSON.stringify({ ok: true, service: 'ubl-id' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const path = url.pathname;

    // CORS
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Cookie',
        },
      });
    }

    // Rotas públicas
    if (path === '/auth/passkey/register/start' && req.method === 'POST') {
      return handleRegisterStart(req, env);
    }
    if (path === '/auth/passkey/register/finish' && req.method === 'POST') {
      return handleRegisterFinish(req, env);
    }
    if (path === '/auth/passkey/login/start' && req.method === 'POST') {
      return handleLoginStart(req, env);
    }
    if (path === '/auth/passkey/login/finish' && req.method === 'POST') {
      return handleLoginFinish(req, env);
    }
    if (path === '/session' && req.method === 'GET') {
      return handleGetSession(req, env);
    }
    if (path === '/session/logout' && req.method === 'POST') {
      return handleLogout(req, env);
    }
    if (path === '/device/start' && req.method === 'POST') {
      return handleDeviceStart(req, env);
    }
    if (path === '/device/approve' && req.method === 'POST') {
      return handleDeviceApprove(req, env);
    }
    if (path === '/device/poll' && req.method === 'POST') {
      return handleDevicePoll(req, env);
    }
    if (path === '/activate' && req.method === 'GET') {
      return handleActivate(req, env);
    }

    // Rotas internas (protegidas por X-Internal-Auth)
    if (path.startsWith('/internal/')) {
      if (!(await internal.validateInternalAuth(req, env))) {
        return new Response(JSON.stringify({ error: 'unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (path.startsWith('/internal/sessions/') && req.method === 'GET') {
        const sid = path.split('/')[3];
        if (path.endsWith('/revoked')) {
          return internal.isSessionRevoked(sid, env);
        }
        return internal.getSession(sid, env);
      }
      if (path === '/internal/abac/default' && req.method === 'GET') {
        return internal.getAbacDefault(env);
      }
      if (path === '/internal/refresh-tokens' && req.method === 'POST') {
        const body = await req.json();
        return internal.createRefreshToken(body, env);
      }
      if (path === '/internal/refresh-tokens/validate' && req.method === 'POST') {
        const body = await req.json();
        return internal.validateRefreshToken(body, env);
      }
      if (path === '/internal/revoke' && req.method === 'POST') {
        const body = await req.json();
        return internal.revokeToken(body, env);
      }
    }

    return new Response('Not Found', { status: 404 });
  },
};
