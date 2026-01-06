// http/routes_frame.ts
// Frame building endpoint (Padrão 1 & 8, Part I & II)

import { buildFileContextFrame } from '../domain/frame_builder';

export async function frameBuild(env: any, req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const workspaceId = url.searchParams.get('workspaceId') || 'workspace/default';
    
    const frame = await buildFileContextFrame(env, workspaceId);
    
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
