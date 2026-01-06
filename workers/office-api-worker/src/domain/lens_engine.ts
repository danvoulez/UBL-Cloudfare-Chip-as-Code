// domain/lens_engine.ts
// Lens Engine (Padrão 12, Part II)

export type LensFilters = {
  canonicalOnly?: boolean;
  signedOnly?: boolean;
  types?: string[];
};

export async function getLens(env: any, workspaceId: string, lensId: string) {
  const r = await env.OFFICE_DB.prepare(
    'SELECT id, workspace_id, name, filters_json FROM lens WHERE workspace_id = ? AND id = ?'
  ).bind(workspaceId, lensId).first();
  
  if (!r) {
    return { 
      id: lensId, 
      workspace_id: workspaceId, 
      name: 'default', 
      filters: {} as LensFilters 
    };
  }
  
  const filters = JSON.parse(r.filters_json || '{}');
  return { 
    id: r.id, 
    workspace_id: r.workspace_id, 
    name: r.name, 
    filters 
  };
}

export async function getFrame(env: any, { workspaceId, lensId }: { workspaceId: string, lensId: string }) {
  const lens = await getLens(env, workspaceId, lensId);
  
  const inv = await env.OFFICE_DB.prepare(
    `SELECT id, title, canonical, signed_receipt, kind
     FROM file WHERE workspace_id = ?
     ORDER BY updated_at DESC LIMIT 50`
  ).bind(workspaceId).all();

  const filters = lens.filters as LensFilters;
  const where = ['a.file_id = f.id'];
  const binds: any[] = [];

  if (filters?.types?.length) {
    where.push('a.kind IN (' + filters.types.map(_ => '?').join(',') + ')');
    binds.push(...filters.types);
  }
  if (filters?.canonicalOnly) where.push('f.canonical = 1');
  if (filters?.signedOnly) where.push('f.signed_receipt IS NOT NULL');

  const topAnchors = await env.OFFICE_DB.prepare(
    `SELECT a.id as anchor_id, a.file_id, a.kind, a.locator, a.text_preview,
            f.title, f.canonical, f.signed_receipt
     FROM anchor a JOIN file f ON f.id = a.file_id
     WHERE f.workspace_id = ? AND ${where.join(' AND ')}
     ORDER BY a.created_at DESC LIMIT 50`
  ).bind(workspaceId, ...binds).all();

  const ws = await env.OFFICE_DB.prepare(
    'SELECT baseline_narrative, updated_at FROM workspace_state WHERE workspace_id = ?'
  ).bind(workspaceId).first();

  return {
    ok: true,
    workspaceId,
    lens: { id: lens.id, name: lens.name, filters },
    inventory: inv.results || [],
    topAnchors: topAnchors.results || [],
    baseline: ws?.baseline_narrative ?? null,
    baselineUpdatedAt: ws?.updated_at ?? null
  };
}
