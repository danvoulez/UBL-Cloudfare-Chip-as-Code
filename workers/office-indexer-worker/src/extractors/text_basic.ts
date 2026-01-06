// extractors/text_basic.ts
// Basic text extraction

export interface ExtractedContent {
  text: string;
  chunks: Array<{
    anchorId: string;
    text: string;
    kind: string;
    locator: string;
  }>;
  anchors: Array<{
    id: string;
    kind: string;
    locator: string;
    text_preview: string;
  }>;
}

export async function extractText(env: any, file: any): Promise<ExtractedContent> {
  // Get file content from R2
  if (!env.OFFICE_BLOB) {
    throw new Error('R2 bucket not configured');
  }
  
  const object = await env.OFFICE_BLOB.get(file.path);
  if (!object) {
    throw new Error(`File not found in R2: ${file.path}`);
  }
  
  const text = await object.text();
  
  // Split into chunks (simple line-based for now)
  const lines = text.split('\n');
  const chunks: ExtractedContent['chunks'] = [];
  const anchors: ExtractedContent['anchors'] = [];
  
  let chunkIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const anchorId = `anchor_${file.id}_${chunkIndex}`;
    chunks.push({
      anchorId,
      text: line,
      kind: 'text',
      locator: `line=${i + 1}`
    });
    
    anchors.push({
      id: anchorId,
      kind: 'text',
      locator: `line=${i + 1}`,
      text_preview: line.slice(0, 200)
    });
    
    chunkIndex++;
  }
  
  return {
    text,
    chunks,
    anchors
  };
}
