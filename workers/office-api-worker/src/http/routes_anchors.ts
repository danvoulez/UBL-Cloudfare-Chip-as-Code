// http/routes_anchors.ts
// Anchor endpoints (Padrão 10, Part II)

export async function anchorsSearch(env: any, req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const workspaceId = url.searchParams.get('workspaceId') || 'workspace/default';
    const fileId = url.searchParams.get('fileId');
    const kind = url.searchParams.get('kind');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    
    let sql = `SELECT a.id, a.file_id, a.kind, a.locator, a.text_preview, a.created_at,
                      f.path as file_path, f.name as file_name
               FROM anchor a
               JOIN file f ON a.file_id = f.id
               WHERE f.workspace_id = ?`;
    const binds: any[] = [workspaceId];
    
    if (fileId) {
      sql += ' AND a.file_id = ?';
      binds.push(fileId);
    }
    
    if (kind) {
      sql += ' AND a.kind = ?';
      binds.push(kind);
    }
    
    sql += ' ORDER BY a.created_at DESC LIMIT ?';
    binds.push(limit);
    
    const result = await env.OFFICE_DB.prepare(sql).bind(...binds).all();
    
    return new Response(JSON.stringify({
      ok: true,
      anchors: result.results || []
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

export async function anchorsGet(env: any, req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const anchorId = url.pathname.split('/').pop();
    
    if (!anchorId) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'Anchor ID required'
      }), {
        status: 400,
        headers: { 'content-type': 'application/json' }
      });
    }
    
    const result = await env.OFFICE_DB.prepare(
      `SELECT a.*, f.path as file_path, f.name as file_name
       FROM anchor a
       JOIN file f ON a.file_id = f.id
       WHERE a.id = ?`
    ).bind(anchorId).first();
    
    if (!result) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'Anchor not found'
      }), {
        status: 404,
        headers: { 'content-type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({
      ok: true,
      anchor: result
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
