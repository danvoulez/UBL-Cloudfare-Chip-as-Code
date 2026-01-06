import { Hono } from 'hono';

type Transport = { type: 'streamable-http' | 'ws' | 'sse'; url: string };
type Server = { 
  name: string; 
  description?: string; 
  transports: Transport[]; 
  tags?: string[];
  oauth?: { issuer?: string };
};

type Env = {
  REGISTRY_KV: KVNamespace;
  UPSTREAM_REGISTRY: string;
  ALLOW_ORIGIN: string;
};

async function fetchUpstream(upstream: string): Promise<Server[]> {
  try {
    const res = await fetch(upstream);
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const data = await res.json();
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.servers)) return data.servers;
    return [];
  } catch { 
    return []; 
  }
}

const app = new Hono<{ Bindings: Env }>();

// CORS middleware
app.use('*', async (c, next) => {
  c.header('Access-Control-Allow-Origin', c.env.ALLOW_ORIGIN || '*');
  c.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (c.req.method === 'OPTIONS') return c.text('', 204);
  return next();
});

// GET /v1/servers: upstream + curated
app.get('/v1/servers', async (c) => {
  const upstream = await fetchUpstream(c.env.UPSTREAM_REGISTRY);
  const curatedRaw = await c.env.REGISTRY_KV.get('curated');
  const curated: Server[] = curatedRaw ? JSON.parse(curatedRaw) : [];
  return c.json({ servers: [...curated, ...upstream] });
});

// POST /v1/servers: append curated (proteja com CF Access)
app.post('/v1/servers', async (c) => {
  // TODO: Adicionar verificação de Cloudflare Access token
  const body = await c.req.json() as Server;
  const curatedRaw = await c.env.REGISTRY_KV.get('curated');
  const curated: Server[] = curatedRaw ? JSON.parse(curatedRaw) : [];
  curated.push(body);
  await c.env.REGISTRY_KV.put('curated', JSON.stringify(curated));
  return c.json({ ok: true, added: body.name });
});

// GET /healthz
app.get('/healthz', (c) => c.text('ok'));

export default app;
