// http/routes_evidence.ts
// Evidence Mode endpoints (Padrão 11, Part II)

export async function evidenceSearch(env: any, req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const workspaceId = url.searchParams.get('workspaceId') || 'workspace/default';
    const q = url.searchParams.get('q') || '';
    const topk = parseInt(url.searchParams.get('topk') || '6');
    
    if (!q) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'Query parameter "q" is required'
      }), {
        status: 400,
        headers: { 'content-type': 'application/json' }
      });
    }
    
    // Vector search (simplified - would need actual embedding)
    const vectorize = await (env as any).OFFICE_VECTORS?.query({
      topK: topk,
      vector: [], // Would need to embed query
      filter: { workspaceId }
    });
    
    const matches = vectorize?.matches || [];
    const ids = matches.map((m: any) => m.id);
    
    // Hydrate anchors
    let anchors: any[] = [];
    if (ids.length) {
      const placeholders = ids.map(() => '?').join(',');
      const sql = `SELECT a.id, a.file_id, a.kind, a.locator, a.text_preview, f.path as file_path
                   FROM anchor a JOIN file f ON a.file_id = f.id
                   WHERE a.id IN (${placeholders})`;
      const stmt = env.OFFICE_DB.prepare(sql).bind(...ids);
      const rs = await stmt.all();
      anchors = rs.results || [];
    }
    
    return new Response(JSON.stringify({
      ok: true,
      matches,
      anchors
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

export async function evidenceAnswer(env: any, req: Request): Promise<Response> {
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), {
        status: 405,
        headers: { 'content-type': 'application/json' }
      });
    }
    
    const body = await req.json();
    const { workspaceId, question, topk = 6 } = body;
    
    if (!question) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'Question is required'
      }), {
        status: 400,
        headers: { 'content-type': 'application/json' }
      });
    }
    
    // Vector search
    const vectorize = await (env as any).OFFICE_VECTORS?.query({
      topK: topk,
      vector: [], // Would need to embed question
      filter: { workspaceId }
    });
    
    const matches = vectorize?.matches || [];
    const ids = matches.map((m: any) => m.id);
    
    // Get anchor texts
    let docs: { id: string; text: string }[] = [];
    if (ids.length) {
      const placeholders = ids.map(() => '?').join(',');
      const sql = `SELECT a.id, a.text_preview FROM anchor a WHERE a.id IN (${placeholders})`;
      const stmt = env.OFFICE_DB.prepare(sql).bind(...ids);
      const rs = await stmt.all();
      docs = (rs.results || []).map((r: any) => ({
        id: r.id,
        text: r.text_preview || ''
      }));
    }
    
    // Generate answer with citations (would use AI)
    const system = [
      'Você é um sistema de Evidence Mode.',
      'Responda com base APENAS nos documentos fornecidos.',
      'Inclua citações no formato [#id] ao fazer afirmações que dependem de evidência.',
      'Se não houver evidência suficiente, declare a limitação.'
    ].join(' ');
    
    // Placeholder for AI answer generation
    const answer = `[Placeholder] Resposta baseada em ${docs.length} documentos. ${system}`;
    
    return new Response(JSON.stringify({
      ok: true,
      answer,
      citations: docs.map(d => d.id),
      topk
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
