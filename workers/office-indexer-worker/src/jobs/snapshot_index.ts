// jobs/snapshot_index.ts
// Create snapshot of current index state

export async function snapshotIndexJob(env: any): Promise<void> {
  const snapshot = {
    timestamp: Date.now(),
    files: await countFiles(env),
    anchors: await countAnchors(env),
    workspaces: await countWorkspaces(env),
    versionFamilies: await countVersionFamilies(env)
  };
  
  // Store snapshot in D1 or KV
  await env.OFFICE_DB.prepare(
    `INSERT INTO index_snapshot (id, snapshot_json, created_at)
     VALUES (?, ?, ?)`
  ).bind(
    crypto.randomUUID(),
    JSON.stringify(snapshot),
    Date.now()
  ).run();
  
  console.log('Index snapshot created:', snapshot);
}

async function countFiles(env: any): Promise<number> {
  const result = await env.OFFICE_DB.prepare('SELECT COUNT(*) as count FROM file').first();
  return (result?.count as number) || 0;
}

async function countAnchors(env: any): Promise<number> {
  const result = await env.OFFICE_DB.prepare('SELECT COUNT(*) as count FROM anchor').first();
  return (result?.count as number) || 0;
}

async function countWorkspaces(env: any): Promise<number> {
  const result = await env.OFFICE_DB.prepare('SELECT COUNT(DISTINCT workspace_id) as count FROM file').first();
  return (result?.count as number) || 0;
}

async function countVersionFamilies(env: any): Promise<number> {
  const result = await env.OFFICE_DB.prepare('SELECT COUNT(*) as count FROM file_family').first();
  return (result?.count as number) || 0;
}
