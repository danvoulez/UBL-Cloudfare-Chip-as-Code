// index.ts
// Main entry point for office-indexer-worker (cron/scheduled)

export interface Env {
  OFFICE_DB: D1Database;
  OFFICE_VECTORS?: VectorizeIndex;
  AI?: Ai;
  OFFICE_BLOB?: R2Bucket;
}

export default {
  async fetch(_req: Request, env: Env): Promise<Response> {
    return new Response('office-indexer-worker', {
      headers: { 'content-type': 'text/plain' }
    });
  },
  
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const cron = event.cron;
    
    // Daily: index new files
    if (cron === '0 0 * * *') {
      await indexNewFiles(env);
    }
    
    // Hourly: rebuild versions
    if (cron === '0 * * * *') {
      await rebuildVersions(env);
    }
    
    // Every 6 hours: snapshot index
    if (cron === '0 */6 * * *') {
      await snapshotIndex(env);
    }
  }
} satisfies ExportedHandler<Env>;

async function indexNewFiles(env: Env): Promise<void> {
  // Find files that need indexing
  const files = await env.OFFICE_DB.prepare(
    `SELECT id, workspace_id, path, name, mime FROM file 
     WHERE indexed_at IS NULL OR indexed_at < updated_at
     LIMIT 100`
  ).all();
  
  for (const file of files.results || []) {
    try {
      await indexFile(env, file as any);
    } catch (error) {
      console.error(`Failed to index file ${file.id}:`, error);
    }
  }
}

async function indexFile(env: Env, file: any): Promise<void> {
  // Import from jobs/index_file.ts
  const { indexFileJob } = await import('./jobs/index_file');
  await indexFileJob(env, file);
}

async function rebuildVersions(env: Env): Promise<void> {
  // Import from jobs/rebuild_versions.ts
  const { rebuildVersionsJob } = await import('./jobs/rebuild_versions');
  await rebuildVersionsJob(env);
}

async function snapshotIndex(env: Env): Promise<void> {
  // Import from jobs/snapshot_index.ts
  const { snapshotIndexJob } = await import('./jobs/snapshot_index');
  await snapshotIndexJob(env);
}
