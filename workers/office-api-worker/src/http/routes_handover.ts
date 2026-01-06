// http/routes_handover.ts
// Handover endpoints (Padrão 3, Part I)

import { commitHandover, getLatestHandover } from '../domain/handover';

export async function handoverCommit(env: any, req: Request): Promise<Response> {
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), {
        status: 405,
        headers: { 'content-type': 'application/json' }
      });
    }
    
    const body = await req.json();
    const { workspaceId, entityId, summary, bookmarks, canonicalMap, unresolved } = body;
    
    if (!workspaceId || !entityId || !summary) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'Missing required fields: workspaceId, entityId, summary'
      }), {
        status: 400,
        headers: { 'content-type': 'application/json' }
      });
    }
    
    if (summary.length < 50) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'Summary must be at least 50 characters'
      }), {
        status: 400,
        headers: { 'content-type': 'application/json' }
      });
    }
    
    const result = await commitHandover(env, {
      workspaceId,
      entityId,
      summary,
      bookmarks,
      canonicalMap,
      unresolved
    });
    
    return new Response(JSON.stringify({
      ok: true,
      handover: result
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

export async function handoverLatest(env: any, req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const entityId = url.searchParams.get('entityId');
    const workspaceId = url.searchParams.get('workspaceId');
    
    if (!entityId || !workspaceId) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'Missing required parameters: entityId, workspaceId'
      }), {
        status: 400,
        headers: { 'content-type': 'application/json' }
      });
    }
    
    const handover = await getLatestHandover(env, entityId, workspaceId);
    
    return new Response(JSON.stringify({
      ok: true,
      handover: handover || null
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
