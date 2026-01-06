// office-dreamer-worker/src/index.ts
// Dreaming Cycle (Padrão 6, Part I) - Memory consolidation

export interface Env {
  OFFICE_DB: D1Database;
  AI: Ai;
}

export default {
  async fetch(_req: Request) {
    return new Response('office-dreamer');
  },
  
  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    // Find workspaces with recent handovers
    const recent = await env.OFFICE_DB.prepare(
      `SELECT DISTINCT workspace_id FROM handover
       WHERE created_at > strftime('%s','now') - 86400`
    ).all();
    
    const wss = (recent.results || []).map((r: any) => r.workspace_id);

    for (const ws of wss) {
      // Get last 20 handovers
      const rows = await env.OFFICE_DB.prepare(
        `SELECT content FROM handover WHERE workspace_id = ?
         ORDER BY created_at DESC LIMIT 20`
      ).bind(ws).all();

      const concat = (rows.results || []).map((r: any, i: number) => `#${i+1}: ${r.content}`).join("\n\n");
      if (!concat) continue;

      // Consolidate with AI
      const prompt = "Consolide objetivamente o estado do workspace em 8-12 linhas, em português, sem floreio. Foque em: (1) decisões, (2) pendências, (3) riscos, (4) próximos passos.\n\n" + concat;
      const out: any = await env.AI.run("@cf/meta/llama-3-8b-instruct", { prompt, max_tokens: 400 });
      const summary = (out.response || out.result || "").trim();
      if (!summary) continue;

      // Update baseline narrative
      const now = Math.floor(Date.now()/1000);
      await env.OFFICE_DB.prepare(
        `INSERT INTO workspace_state(workspace_id, baseline_narrative, updated_at)
         VALUES(?,?,?)
         ON CONFLICT(workspace_id) DO UPDATE SET
           baseline_narrative=excluded.baseline_narrative,
           updated_at=excluded.updated_at`
      ).bind(ws, summary, now).run();
    }
  }
} satisfies ExportedHandler<Env>;
