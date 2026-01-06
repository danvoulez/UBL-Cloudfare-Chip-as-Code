// domain/handover.ts
// Handover management - transfer of knowledge between instances

export interface HandoverCommitRequest {
  workspaceId: string;
  entityId: string;
  summary: string;
  bookmarks?: string[];
  canonicalMap?: Record<string, string>;
  unresolved?: string[];
}

export async function commitHandover(env: any, body: HandoverCommitRequest): Promise<{ id: string }> {
  const id = crypto.randomUUID();
  await env.OFFICE_DB.prepare(
    'INSERT INTO handover (id, workspace_id, entity_id, summary, bookmarks_json, canonical_map_json, unresolved_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).bind(
    id, body.workspaceId, body.entityId, body.summary,
    JSON.stringify(body.bookmarks || []),
    JSON.stringify(body.canonicalMap || {}),
    JSON.stringify(body.unresolved || []),
    Date.now()
  ).run();
  return { id };
}

export async function getLatestHandover(env: any, entityId: string, workspaceId: string) {
  const rs = await env.OFFICE_DB.prepare(
    'SELECT * FROM handover WHERE entity_id = ? AND workspace_id = ? ORDER BY created_at DESC LIMIT 1'
  ).bind(entityId, workspaceId).all();
  return rs.results?.[0] || null;
}
