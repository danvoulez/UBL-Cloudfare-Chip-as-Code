// core/cors.ts
// CORS utilities

export interface CORSOptions {
  origin?: string | string[];
  methods?: string[];
  headers?: string[];
  credentials?: boolean;
  maxAge?: number;
}

const DEFAULT_OPTIONS: CORSOptions = {
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  headers: ['Content-Type', 'Authorization', 'X-API-Key'],
  credentials: true,
  maxAge: 86400
};

/**
 * Handle CORS preflight request
 */
export function handleCORS(req: Request, options?: CORSOptions): Response | null {
  if (req.method !== 'OPTIONS') {
    return null;
  }
  
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const origin = req.headers.get('Origin');
  
  if (!origin || !isOriginAllowed(origin, opts.origin)) {
    return new Response(null, { status: 403 });
  }
  
  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Methods', opts.methods!.join(', '));
  headers.set('Access-Control-Allow-Headers', opts.headers!.join(', '));
  headers.set('Access-Control-Max-Age', String(opts.maxAge));
  
  if (opts.credentials) {
    headers.set('Access-Control-Allow-Credentials', 'true');
  }
  
  return new Response(null, { status: 204, headers });
}

/**
 * Add CORS headers to response
 */
export function addCORSHeaders(
  req: Request,
  response: Response,
  options?: CORSOptions
): Response {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const origin = req.headers.get('Origin');
  
  if (!origin || !isOriginAllowed(origin, opts.origin)) {
    return response;
  }
  
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Methods', opts.methods!.join(', '));
  headers.set('Access-Control-Allow-Headers', opts.headers!.join(', '));
  
  if (opts.credentials) {
    headers.set('Access-Control-Allow-Credentials', 'true');
  }
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function isOriginAllowed(origin: string, allowed?: string | string[]): boolean {
  if (!allowed) return true;
  if (typeof allowed === 'string') return origin === allowed;
  return allowed.includes(origin);
}

/**
 * Load allowed origins from config
 */
export async function loadAllowedOrigins(env: any): Promise<string[]> {
  try {
    // Try to load from KV or config
    const config = await env.OFFICE_DB.prepare(
      'SELECT value FROM config WHERE key = ?'
    ).bind('cors_origins').first();
    
    if (config?.value) {
      return JSON.parse(config.value as string);
    }
    
    // Default: allow all (for development)
    return ['*'];
  } catch {
    return ['*'];
  }
}
