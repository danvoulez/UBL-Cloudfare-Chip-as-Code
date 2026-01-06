// jobs/rebuild_versions.ts
// Rebuild version graph for all workspaces

export async function rebuildVersionsJob(env: any): Promise<void> {
  // Get all workspaces
  const workspaces = await env.OFFICE_DB.prepare(
    'SELECT DISTINCT workspace_id FROM file'
  ).all();
  
  for (const ws of workspaces.results || []) {
    const workspaceId = ws.workspace_id as string;
    
    try {
      // Import VersionService
      const { VersionService } = await import('../../office-api-worker/src/domain/version_graph');
      const svc = new VersionService(env);
      
      // Recompute file vectors
      await svc.recomputeFileVectors(workspaceId);
      
      // Recompute edges
      await svc.recomputeEdges(workspaceId, 8, 0.7);
      
      // Assign families
      await svc.assignFamilies(workspaceId, 0.75);
      
      console.log(`Rebuilt version graph for workspace ${workspaceId}`);
    } catch (error) {
      console.error(`Failed to rebuild versions for ${workspaceId}:`, error);
    }
  }
}
