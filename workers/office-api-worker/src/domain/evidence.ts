// domain/evidence.ts
// Evidence Mode (Padrão 11, Part II)

export interface EvidenceRequest {
  workspaceId: string;
  question: string;
  lensId?: string;
  topK?: number;
}

export interface EvidenceResponse {
  answer: string;
  citations: string[];
  anchors: AnchorCitation[];
}

export interface AnchorCitation {
  id: string;
  fileId: string;
  filePath: string;
  locator: string;
  preview: string;
}

/**
 * Generate evidence-based answer with citations
 */
export async function generateEvidenceAnswer(
  env: any,
  request: EvidenceRequest
): Promise<EvidenceResponse> {
  const { workspaceId, question, lensId, topK = 6 } = request;
  
  // Vector search
  const emb = await embedText(env, question);
  const vectorize = await (env as any).OFFICE_VECTORS.query({
    topK,
    vector: emb,
    filter: { workspaceId }
  });
  
  const matches = vectorize.matches || [];
  const ids = matches.map((m: any) => m.id);
  
  // Get anchor texts and metadata
  let anchors: AnchorCitation[] = [];
  if (ids.length) {
    const placeholders = ids.map(() => '?').join(',');
    const sql = `SELECT a.id, a.file_id, a.locator, a.text_preview, f.path as file_path
                 FROM anchor a JOIN file f ON a.file_id = f.id
                 WHERE a.id IN (${placeholders})`;
    const stmt = env.OFFICE_DB.prepare(sql).bind(...ids);
    const rs = await stmt.all();
    anchors = (rs.results || []).map((r: any) => ({
      id: r.id,
      fileId: r.file_id,
      filePath: r.file_path,
      locator: r.locator,
      preview: r.text_preview || ''
    }));
  }
  
  // Generate answer with AI
  const system = [
    'Você é um sistema de Evidence Mode.',
    'Responda com base APENAS nos documentos fornecidos.',
    'Inclua citações no formato [#id] ao fazer afirmações que dependem de evidência.',
    'Se não houver evidência suficiente, declare a limitação.'
  ].join(' ');
  
  const contextDocs = anchors.map(a => ({ id: a.id, text: a.preview }));
  const answer = await generateAnswer(env, system, question, contextDocs);
  
  return {
    answer,
    citations: anchors.map(a => a.id),
    anchors
  };
}

/**
 * Embed text using Cloudflare AI
 * TODO: Implement actual embedding using @cf/baai/bge-base-en-v1.5 or similar
 */
async function embedText(env: any, text: string): Promise<number[]> {
  if (!env.AI) {
    throw new Error('AI binding not configured');
  }
  
  try {
    // Use Cloudflare AI to embed text
    const result = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
      text: [text]
    });
    return result.data[0] || [];
  } catch (error) {
    console.error('Embedding failed:', error);
    return [];
  }
}

/**
 * Generate answer using Cloudflare AI
 * TODO: Implement actual answer generation with proper prompt engineering
 */
async function generateAnswer(
  env: any,
  system: string,
  question: string,
  contextDocs: { id: string; text: string }[]
): Promise<string> {
  if (!env.AI) {
    return `[AI not configured] Answer would be based on ${contextDocs.length} documents.`;
  }
  
  try {
    const context = contextDocs.map(d => `[${d.id}] ${d.text}`).join('\n\n');
    const prompt = `${system}\n\nContext:\n${context}\n\nQuestion: ${question}\n\nAnswer:`;
    
    // Use Cloudflare AI to generate answer
    const result = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [{ role: 'user', content: prompt }]
    });
    
    return result.response || `[Generated] Answer based on ${contextDocs.length} documents.`;
  } catch (error) {
    console.error('Answer generation failed:', error);
    return `[Error] Could not generate answer. Based on ${contextDocs.length} documents.`;
  }
}
