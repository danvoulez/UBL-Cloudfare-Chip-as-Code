/**
 * domain/version_graph.ts
 * Version Graph + Canonicalization logic (Padrão 9, Part II)
 */

export type Env = {
  OFFICE_DB: D1Database;
  VECTORIZE_INDEX?: any;
  AI?: any;
};

type FileRow = {
  id: string;
  workspace_id: string;
  name?: string;
  path?: string;
};

function now() { return Math.floor(Date.now() / 1000); }

function normalizeName(s: string = ""): string {
  return s.toLowerCase()
    .replace(/[_\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function nameSimilarity(a?: string, b?: string): number {
  if (!a || !b) return 0;
  const ta = new Set(normalizeName(a).split(" "));
  const tb = new Set(normalizeName(b).split(" "));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  ta.forEach(w => { if (tb.has(w)) inter++; });
  const denom = Math.max(ta.size, tb.size);
  return inter / denom;
}

async function getFiles(db: D1Database, workspaceId: string): Promise<FileRow[]> {
  const q = await db.prepare("SELECT id, workspace_id, name, path FROM file WHERE workspace_id = ?").bind(workspaceId).all();
  return (q.results || []) as any;
}

export class VersionService {
  env: Env;
  constructor(env: Env) { this.env = env; }

  async markCanonical(fileId: string, reason = "manual") {
    const fam = await this.env.OFFICE_DB.prepare("SELECT family_id FROM file_family_membership WHERE file_id = ?").bind(fileId).first();
    if (!fam || !fam.family_id) throw new Error("file has no assigned family");
    
    await this.env.OFFICE_DB.prepare("UPDATE file_family SET canonical_file_id = ?, canonical_reason = ?, updated_at = ? WHERE id = ?")
      .bind(fileId, reason, now(), fam.family_id as string).run();
    
    return { ok: true, familyId: fam.family_id };
  }

  async getGraph(fileId: string) {
    const edges = await this.env.OFFICE_DB.prepare(`
      SELECT * FROM version_edge WHERE src_file_id = ? ORDER BY similarity DESC LIMIT 64
    `).bind(fileId).all();
    
    const fam = await this.env.OFFICE_DB.prepare(`
      SELECT ff.id as family_id, ff.canonical_file_id, ff.canonical_reason
      FROM file_family_membership fm
      JOIN file_family ff ON fm.family_id = ff.id
      WHERE fm.file_id = ?
    `).bind(fileId).first();
    
    return { edges: edges.results || [], family: fam || null };
  }

  async getConflicts(workspaceId: string) {
    const q = await this.env.OFFICE_DB.prepare(`
      SELECT ff.id as family_id, ff.canonical_file_id, COUNT(fm.file_id) as members
      FROM file_family ff
      LEFT JOIN file_family_membership fm ON fm.family_id = ff.id
      WHERE ff.workspace_id = ?
      GROUP BY ff.id
      HAVING ff.canonical_file_id IS NULL OR members = 0
    `).bind(workspaceId).all();
    return q.results || [];
  }
}
