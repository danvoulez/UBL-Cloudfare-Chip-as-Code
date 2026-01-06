// jobs/index_file.ts
// Index a single file (extract text, create anchors, embed)

export interface FileToIndex {
  id: string;
  workspace_id: string;
  path: string;
  name: string;
  mime: string;
}

export async function indexFileJob(env: any, file: FileToIndex): Promise<void> {
  // 1. Extract text based on file type
  const extractor = getExtractor(file.mime);
  const extracted = await extractor(env, file);
  
  // 2. Create anchors from extracted content
  await createAnchors(env, file.id, extracted);
  
  // 3. Embed and store in Vectorize
  await embedAndStore(env, file, extracted);
  
  // 4. Mark as indexed
  await env.OFFICE_DB.prepare(
    'UPDATE file SET indexed_at = ? WHERE id = ?'
  ).bind(Date.now(), file.id).run();
}

function getExtractor(mime: string): (env: any, file: FileToIndex) => Promise<any> {
  if (mime === 'application/pdf') {
    return async (env, file) => {
      const { extractPDF } = await import('../extractors/pdf_stub');
      return extractPDF(env, file);
    };
  }
  
  // Default: text extractor
  return async (env, file) => {
    const { extractText } = await import('../extractors/text_basic');
    return extractText(env, file);
  };
}

async function createAnchors(env: any, fileId: string, extracted: any): Promise<void> {
  const { persistAnchors } = await import('../persist/anchors');
  await persistAnchors(env, fileId, extracted.anchors || []);
}

async function embedAndStore(env: any, file: FileToIndex, extracted: any): Promise<void> {
  if (!env.OFFICE_VECTORS || !env.AI) return;
  
  // Embed text chunks
  for (const chunk of extracted.chunks || []) {
    const embedding = await embedText(env, chunk.text);
    await env.OFFICE_VECTORS.upsert([{
      id: `anchor:${chunk.anchorId}`,
      values: embedding,
      metadata: {
        fileId: file.id,
        workspaceId: file.workspace_id,
        kind: chunk.kind || 'text',
        locator: chunk.locator
      }
    }]);
  }
}

async function embedText(env: any, text: string): Promise<number[]> {
  const result = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
    text: [text]
  });
  return result.data[0] || [];
}
