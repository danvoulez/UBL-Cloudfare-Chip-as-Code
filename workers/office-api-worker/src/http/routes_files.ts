// http/routes_files.ts
// File management endpoints

export async function filesList(env: any, req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const workspaceId = url.searchParams.get('workspaceId') || 'workspace/default';
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const kind = url.searchParams.get('kind');
    const canonical = url.searchParams.get('canonical');
    
    let sql = `SELECT id, workspace_id, path, name, mime, size_bytes, sha256, canonical, created_at, updated_at
               FROM file WHERE workspace_id = ?`;
    const binds: any[] = [workspaceId];
    
    if (kind) {
      sql += ' AND kind = ?';
      binds.push(kind);
    }
    
    if (canonical === 'true') {
      sql += ' AND canonical = 1';
    } else if (canonical === 'false') {
      sql += ' AND canonical = 0';
    }
    
    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    binds.push(limit, offset);
    
    const result = await env.OFFICE_DB.prepare(sql).bind(...binds).all();
    
    return new Response(JSON.stringify({
      ok: true,
      files: result.results || [],
      total: result.results?.length || 0
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

export async function filesGet(env: any, req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const fileId = url.pathname.split('/').pop();
    
    if (!fileId) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'File ID required'
      }), {
        status: 400,
        headers: { 'content-type': 'application/json' }
      });
    }
    
    const result = await env.OFFICE_DB.prepare(
      'SELECT * FROM file WHERE id = ?'
    ).bind(fileId).first();
    
    if (!result) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'File not found'
      }), {
        status: 404,
        headers: { 'content-type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({
      ok: true,
      file: result
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
