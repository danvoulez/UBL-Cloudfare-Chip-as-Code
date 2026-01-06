// Internal endpoints for Core API (protegidos por X-Internal-Auth)
// GET /internal/sessions/:sid
// GET /internal/abac/default
// GET /internal/sessions/:sid/revoked
// POST /internal/refresh-tokens
// POST /internal/refresh-tokens/validate
// POST /internal/revoke

interface Env {
  UBL_DB: D1Database;
  INTERNAL_AUTH_SECRET: string;
}

async function validateInternalAuth(req: Request, env: Env): Promise<boolean> {
  const secret = req.headers.get('X-Internal-Auth');
  return secret === env.INTERNAL_AUTH_SECRET;
}

// GET /internal/sessions/:sid
export async function getSession(sid: string, env: Env): Promise<Response> {
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
    return new Response(JSON.stringify({ error: 'session_not_found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({
    user_id: session.user_id,
    session_id: session.id,
    username: session.username,
    expires_at: session.expires_at,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// GET /internal/abac/default
export async function getAbacDefault(env: Env): Promise<Response> {
  const policy = await env.UBL_DB.prepare(
    'SELECT blob_json FROM abac_policies WHERE id = ? ORDER BY version DESC LIMIT 1'
  ).bind('default').first<{ blob_json: string }>();

  if (!policy) {
    return new Response(JSON.stringify({ error: 'policy_not_found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(policy.blob_json, {
    headers: { 'Content-Type': 'application/json' },
  });
}

// GET /internal/sessions/:sid/revoked
export async function isSessionRevoked(sid: string, env: Env): Promise<Response> {
  const session = await env.UBL_DB.prepare(
    'SELECT id FROM sessions WHERE id = ? AND expires_at > unixepoch()'
  ).bind(sid).first();

  if (!session) {
    return new Response(JSON.stringify({ revoked: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ revoked: false }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// POST /internal/refresh-tokens
export async function createRefreshToken(body: any, env: Env): Promise<Response> {
  const { user_id, session_id, token_hash, expires_at } = body;

  const id = crypto.randomUUID();
  await env.UBL_DB.prepare(
    'INSERT INTO refresh_tokens (id, user_id, session_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?, unixepoch())'
  ).bind(id, user_id, session_id, token_hash, expires_at).run();

  return new Response(JSON.stringify({ ok: true, id }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// POST /internal/refresh-tokens/validate
export async function validateRefreshToken(body: any, env: Env): Promise<Response> {
  const { token_hash } = body;

  const token = await env.UBL_DB.prepare(
    'SELECT * FROM refresh_tokens WHERE token_hash = ? AND expires_at > unixepoch() AND used_at IS NULL'
  ).bind(token_hash).first<{
    id: string;
    user_id: string;
    session_id: string;
    expires_at: number;
  }>();

  if (!token) {
    return new Response(JSON.stringify({ error: 'invalid_token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Marcar como usado (rotação)
  await env.UBL_DB.prepare(
    'UPDATE refresh_tokens SET used_at = unixepoch() WHERE id = ?'
  ).bind(token.id).run();

  return new Response(JSON.stringify({
    user_id: token.user_id,
    session_id: token.session_id,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

// POST /internal/revoke
export async function revokeToken(body: any, env: Env): Promise<Response> {
  const { jti, session_id } = body;

  if (jti) {
    await env.UBL_DB.prepare(
      'INSERT OR IGNORE INTO jwt_revocations (jti, revoked_at) VALUES (?, unixepoch())'
    ).bind(jti).run();
  }

  if (session_id) {
    await env.UBL_DB.prepare('DELETE FROM sessions WHERE id = ?').bind(session_id).run();
    await env.UBL_DB.prepare('DELETE FROM refresh_tokens WHERE session_id = ?').bind(session_id).run();
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

export { validateInternalAuth };
