// core/auth.ts
// Authentication utilities

import { resolveTenant } from './tenant';

export interface AuthResult {
  authenticated: boolean;
  entityId?: string;
  tenant?: string;
  error?: string;
}

/**
 * Authenticate request
 * Supports multiple auth methods: API key, JWT, or tenant-based
 */
export async function authenticate(
  req: Request,
  env: any
): Promise<AuthResult> {
  // Check for API key in header
  const apiKey = req.headers.get('X-API-Key');
  if (apiKey) {
    return authenticateApiKey(apiKey, env);
  }
  
  // Check for Authorization header (Bearer token)
  const authHeader = req.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    return authenticateJWT(token, env);
  }
  
  // Fallback to tenant-based auth
  return authenticateTenant(req, env);
}

async function authenticateApiKey(apiKey: string, env: any): Promise<AuthResult> {
  // Look up API key in KV or D1
  const keyRecord = await env.OFFICE_DB.prepare(
    'SELECT entity_id, tenant FROM api_keys WHERE key_hash = ? AND active = 1'
  ).bind(await hashString(apiKey)).first();
  
  if (!keyRecord) {
    return { authenticated: false, error: 'Invalid API key' };
  }
  
  return {
    authenticated: true,
    entityId: keyRecord.entity_id as string,
    tenant: keyRecord.tenant as string
  };
}

async function authenticateJWT(token: string, env: any): Promise<AuthResult> {
  // Simple JWT validation (in production, use proper JWT library)
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { authenticated: false, error: 'Invalid JWT format' };
    }
    
    const payload = JSON.parse(atob(parts[1]));
    const entityId = payload.sub || payload.entityId;
    const tenant = payload.tenant;
    
    if (!entityId) {
      return { authenticated: false, error: 'Missing entity ID in token' };
    }
    
    return {
      authenticated: true,
      entityId,
      tenant
    };
  } catch (error) {
    return { authenticated: false, error: 'Invalid JWT' };
  }
}

async function authenticateTenant(req: Request, env: any): Promise<AuthResult> {
  // Extract tenant from hostname or header
  const host = new URL(req.url).host;
  const tenant = resolveTenant(req);
  
  return {
    authenticated: true,
    tenant,
    entityId: `entity/${tenant}`
  };
}

async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
