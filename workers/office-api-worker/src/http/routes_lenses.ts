// http/routes_lenses.ts
// Lens endpoints (Padrão 12, Part II)

import { getLens, getFrame } from '../domain/lens_engine';

export async function lensesList(env: any, req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const workspaceId = url.searchParams.get('workspaceId') || 'workspace/default';
    
    const result = await env.OFFICE_DB.prepare(
      'SELECT id, workspace_id, name, filters_json, created_at FROM lens WHERE workspace_id = ? ORDER BY created_at DESC'
    ).bind(workspaceId).all();
    
    return new Response(JSON.stringify({
      ok: true,
      lenses: result.results || []
    }), {
      headers: { 'content-type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({
      ok: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }
}

export async function lensesGet(env: any, req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const workspaceId = url.searchParams.get('workspaceId') || 'workspace/default';
    const lensId = url.pathname.split('/').pop() || 'default';
    
    const lens = await getLens(env, workspaceId, lensId);
    
    return new Response(JSON.stringify({
      ok: true,
      lens
    }), {
      headers: { 'content-type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({
      ok: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }
}

export async function lensesPut(env: any, req: Request): Promise<Response> {
  try {
    if (req.method !== 'PUT') {
      return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), {
        status: 405,
        headers: { 'content-type': 'application/json' }
      });
    }
    
    const body = await req.json();
    const { workspaceId, name, filters } = body;
    
    if (!workspaceId || !name) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'Missing required fields: workspaceId, name'
      }), {
        status: 400,
        headers: { 'content-type': 'application/json' }
      });
    }
    
    const lensId = body.id || crypto.randomUUID();
    
    await env.OFFICE_DB.prepare(
      `INSERT INTO lens (id, workspace_id, name, filters_json, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         filters_json = excluded.filters_json`
    ).bind(lensId, workspaceId, name, JSON.stringify(filters || {}), Date.now()).run();
    
    return new Response(JSON.stringify({
      ok: true,
      lens: { id: lensId, workspaceId, name, filters }
    }), {
      headers: { 'content-type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({
      ok: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }
}

export async function lensesFrame(env: any, req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const workspaceId = url.searchParams.get('workspaceId') || 'workspace/default';
    const lensId = url.searchParams.get('lensId') || 'default';
    
    const frame = await getFrame(env, { workspaceId, lensId });
    
    return new Response(JSON.stringify({
      ok: true,
      frame
    }), {
      headers: { 'content-type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({
      ok: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }
}
