// domain/frame_builder.ts
// File Context Frame Builder (Padrão 8, Part II)

export interface Env {
  OFFICE_DB: D1Database;
}

export interface FileContextFrame {
  inventory: any[];
  canonicals: any[];
  topAnchors: any[];
  limits: {
    token_budget: {
      work: number;
      assist: number;
      deliberate: number;
      research: number;
    };
  };
}

async function all(db: D1Database, sql: string, binds: any[] = []) {
  const stmt = db.prepare(sql).bind(...binds);
  const rs = await stmt.all();
  return rs.results || [];
}

export async function buildFileContextFrame(env: Env, workspaceId: string): Promise<FileContextFrame> {
  // inventory: last N files
  const files = await all(env.OFFICE_DB, 
    `SELECT id, workspace_id, path, name, mime, size_bytes, sha256, created_at
     FROM file WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 50`, 
    [workspaceId]);
  
  // canonicals: latest per family
  const canon = await all(env.OFFICE_DB, 
    `SELECT c.family_id, c.file_id, c.marked_at
     FROM canonical_mark c LEFT JOIN version_family f ON f.id = c.family_id
     WHERE f.workspace_id = ?`, 
    [workspaceId]);
  
  // top anchors (recent)
  const anchors = await all(env.OFFICE_DB, 
    `SELECT a.id, a.file_id, a.kind, a.locator, a.text_preview
     FROM anchor a JOIN file f ON a.file_id = f.id
     WHERE f.workspace_id = ? ORDER BY a.created_at DESC LIMIT 50`, 
    [workspaceId]);
  
  // limits
  const limits = { 
    token_budget: { 
      work: 5000, 
      assist: 4000, 
      deliberate: 8000, 
      research: 6000 
    } 
  };
  
  return { inventory: files, canonicals: canon, topAnchors: anchors, limits };
}
