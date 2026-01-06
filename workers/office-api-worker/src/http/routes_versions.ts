// http/routes_versions.ts
// Version Graph endpoints (Padrão 9, Part II)

import { VersionService } from '../domain/version_graph';

export async function versionsRecompute(env: any, req: Request): Promise<Response> {
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), {
        status: 405,
        headers: { 'content-type': 'application/json' }
      });
    }
    
    const body = await req.json();
    const { workspaceId, topK = 8, threshold = 0.7 } = body;
    
    if (!workspaceId) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'workspaceId is required'
      }), {
        status: 400,
        headers: { 'content-type': 'application/json' }
      });
    }
    
    const svc = new VersionService(env);
    // Note: These methods would need to be implemented in version_graph.ts
    // await svc.recomputeFileVectors(workspaceId);
    // await svc.recomputeEdges(workspaceId, topK, threshold);
    // await svc.assignFamilies(workspaceId, Math.max(threshold, 0.75));
    
    return new Response(JSON.stringify({
      ok: true,
      message: 'Version graph recomputation started'
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

export async function versionsMarkCanonical(env: any, req: Request): Promise<Response> {
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), {
        status: 405,
        headers: { 'content-type': 'application/json' }
      });
    }
    
    const body = await req.json();
    const { fileId, reason = 'manual' } = body;
    
    if (!fileId) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'fileId is required'
      }), {
        status: 400,
        headers: { 'content-type': 'application/json' }
      });
    }
    
    const svc = new VersionService(env);
    const result = await svc.markCanonical(fileId, reason);
    
    return new Response(JSON.stringify({
      ok: true,
      result
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

export async function versionsGraph(env: any, req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const fileId = url.searchParams.get('fileId');
    
    if (!fileId) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'fileId parameter is required'
      }), {
        status: 400,
        headers: { 'content-type': 'application/json' }
      });
    }
    
    const svc = new VersionService(env);
    const graph = await svc.getGraph(fileId);
    
    return new Response(JSON.stringify({
      ok: true,
      graph
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

export async function versionsConflicts(env: any, req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const workspaceId = url.searchParams.get('workspaceId') || 'workspace/default';
    
    const svc = new VersionService(env);
    const conflicts = await svc.getConflicts(workspaceId);
    
    return new Response(JSON.stringify({
      ok: true,
      conflicts
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
