// Webhooks Worker — HMAC verification + DLQ
export interface Env {
  WEBHOOK_SECRETS: KVNamespace;
  DLQ: R2Bucket;
}

async function verifyHMAC(body: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(body);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signatureBytes = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const computedSignature = Array.from(new Uint8Array(signatureBytes))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
  
  return computedSignature === signature.replace('sha256=', '');
}

async function sendToDLQ(env: Env, partner: string, eventId: string, body: string, reason: string): Promise<void> {
  const key = `webhooks/${partner}/${eventId}-${Date.now()}.json`;
  const payload = JSON.stringify({
    partner,
    event_id: eventId,
    body,
    reason,
    timestamp: new Date().toISOString()
  });
  
  await env.DLQ.put(key, payload, {
    httpMetadata: { contentType: 'application/json' }
  });
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    
    if (pathParts.length < 2 || pathParts[0] !== 'webhooks') {
      return new Response('Not found', { status: 404 });
    }
    
    const partner = pathParts[1];
    const signature = req.headers.get('X-Signature') || req.headers.get('X-Hub-Signature-256') || '';
    
    if (!signature) {
      return new Response(JSON.stringify({ error: 'missing_signature' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Buscar secret do parceiro
    const secretKey = `webhook:partner:${partner}:key:default`;
    const secret = await env.WEBHOOK_SECRETS.get(secretKey);
    
    if (!secret) {
      return new Response(JSON.stringify({ error: 'partner_not_configured' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Ler body
    const body = await req.text();
    
    // Verificar HMAC
    const isValid = await verifyHMAC(body, signature, secret);
    
    if (!isValid) {
      const eventId = req.headers.get('X-GitHub-Delivery') || 
                     req.headers.get('X-Event-ID') || 
                     `unknown-${Date.now()}`;
      
      // Enviar para DLQ
      ctx.waitUntil(sendToDLQ(env, partner, eventId, body, 'invalid_signature'));
      
      return new Response(JSON.stringify({ error: 'invalid_signature' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Dedupe por event_id
    const eventId = req.headers.get('X-GitHub-Delivery') || 
                   req.headers.get('X-Event-ID') || 
                   `gen-${Date.now()}`;
    
    const dedupeKey = `webhook:dedupe:${partner}:${eventId}`;
    const existing = await env.WEBHOOK_SECRETS.get(dedupeKey);
    
    if (existing) {
      return new Response(JSON.stringify({ ok: true, cached: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Marcar como processado (TTL 24h)
    await env.WEBHOOK_SECRETS.put(dedupeKey, 'processed', { expirationTtl: 86400 });
    
    // Processar webhook (stub)
    try {
      // TODO: Processar webhook real aqui
      return new Response(JSON.stringify({ ok: true, event_id: eventId }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (e) {
      // Em caso de erro, enviar para DLQ
      ctx.waitUntil(sendToDLQ(env, partner, eventId, body, `error: ${e}`));
      
      return new Response(JSON.stringify({ error: 'processing_failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};
