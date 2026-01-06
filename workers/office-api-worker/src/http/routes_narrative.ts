// http/routes_narrative.ts
// Narrative preparation endpoint (Padrão 2, Part I)

import { prepareNarrative } from '../domain/narrative';

export async function narrativePrepare(env: any, req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const entityId = url.searchParams.get('entityId') || 'entity/default';
    const workspaceId = url.searchParams.get('workspaceId') || 'workspace/default';
    const sessionType = url.searchParams.get('sessionType') as any || 'work';
    const constitution = url.searchParams.get('constitution') || undefined;
    
    const result = await prepareNarrative(env, {
      entityId,
      workspaceId,
      sessionType,
      constitution
    });
    
    return new Response(JSON.stringify({
      ok: true,
      narrative: result.narrative,
      governanceNotes: result.governanceNotes,
      hasHandover: !!result.handover
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
