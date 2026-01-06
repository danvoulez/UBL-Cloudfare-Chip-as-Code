// index.ts
// Main entry point for office-api-worker

import { health } from './http/routes_health';
import { inventory } from './http/routes_inventory';
import { adminInfo } from './http/routes_admin';
import { frameBuild } from './http/routes_frame';
import { narrativePrepare } from './http/routes_narrative';
import { simulationRun } from './http/routes_simulation';
import { handoverCommit, handoverLatest } from './http/routes_handover';
import { filesList, filesGet } from './http/routes_files';
import { anchorsSearch, anchorsGet } from './http/routes_anchors';
import { lensesList, lensesGet, lensesPut, lensesFrame } from './http/routes_lenses';
import { evidenceSearch, evidenceAnswer } from './http/routes_evidence';
import { versionsRecompute, versionsMarkCanonical, versionsGraph, versionsConflicts } from './http/routes_versions';
import { resolveTenant } from './core/tenant';
import { handleCORS, addCORSHeaders } from './core/cors';
import type { Env } from './bindings';

// Export Durable Object
export { OfficeSessionDO } from './do/OfficeSessionDO';

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const pathname = url.pathname;
    
    // Handle CORS preflight
    const corsResponse = handleCORS(req);
    if (corsResponse) return corsResponse;
    
    // Health check
    if (pathname === '/healthz') {
      return addCORSHeaders(req, health());
    }
    
    // Inventory
    if (pathname === '/inventory') {
      const response = await inventory(env);
      return addCORSHeaders(req, response);
    }
    
    // Admin
    if (pathname === '/admin/info') {
      const response = await adminInfo();
      return addCORSHeaders(req, response);
    }
    
    // Whoami (tenant resolution)
    if (pathname === '/whoami') {
      const tenant = resolveTenant(req);
      const response = new Response(JSON.stringify({ ok: true, tenant }), {
        headers: { 'content-type': 'application/json' }
      });
      return addCORSHeaders(req, response);
    }
    
    // Frame
    if (pathname === '/api/frame' || pathname === '/frame') {
      const response = await frameBuild(env, req);
      return addCORSHeaders(req, response);
    }
    
    // Narrative
    if (pathname === '/api/narrative' || pathname === '/narrative') {
      const response = await narrativePrepare(env, req);
      return addCORSHeaders(req, response);
    }
    
    // Simulation
    if (pathname === '/api/simulation' || pathname === '/simulation') {
      const response = await simulationRun(env, req);
      return addCORSHeaders(req, response);
    }
    
    // Handover
    if (pathname === '/api/handover/commit' || pathname === '/handover/commit') {
      const response = await handoverCommit(env, req);
      return addCORSHeaders(req, response);
    }
    if (pathname === '/api/handover/latest' || pathname === '/handover/latest') {
      const response = await handoverLatest(env, req);
      return addCORSHeaders(req, response);
    }
    
    // Files
    if (pathname === '/api/files' || pathname === '/files') {
      const response = await filesList(env, req);
      return addCORSHeaders(req, response);
    }
    if (pathname.startsWith('/api/files/') || pathname.startsWith('/files/')) {
      const response = await filesGet(env, req);
      return addCORSHeaders(req, response);
    }
    
    // Anchors
    if (pathname === '/api/anchors' || pathname === '/anchors') {
      const response = await anchorsSearch(env, req);
      return addCORSHeaders(req, response);
    }
    if (pathname.startsWith('/api/anchors/') || pathname.startsWith('/anchors/')) {
      const response = await anchorsGet(env, req);
      return addCORSHeaders(req, response);
    }
    
    // Lenses
    if (pathname === '/api/lenses' || pathname === '/lenses') {
      if (req.method === 'GET') {
        const response = await lensesList(env, req);
        return addCORSHeaders(req, response);
      }
      if (req.method === 'PUT') {
        const response = await lensesPut(env, req);
        return addCORSHeaders(req, response);
      }
    }
    if (pathname.startsWith('/api/lenses/') || pathname.startsWith('/lenses/')) {
      if (pathname.endsWith('/frame')) {
        const response = await lensesFrame(env, req);
        return addCORSHeaders(req, response);
      }
      const response = await lensesGet(env, req);
      return addCORSHeaders(req, response);
    }
    
    // Evidence
    if (pathname === '/api/evidence/search' || pathname === '/evidence/search') {
      const response = await evidenceSearch(env, req);
      return addCORSHeaders(req, response);
    }
    if (pathname === '/api/evidence/answer' || pathname === '/evidence/answer') {
      const response = await evidenceAnswer(env, req);
      return addCORSHeaders(req, response);
    }
    
    // Versions
    if (pathname === '/api/version/recompute' || pathname === '/version/recompute') {
      const response = await versionsRecompute(env, req);
      return addCORSHeaders(req, response);
    }
    if (pathname === '/api/version/mark-canonical' || pathname === '/version/mark-canonical') {
      const response = await versionsMarkCanonical(env, req);
      return addCORSHeaders(req, response);
    }
    if (pathname === '/api/version/graph' || pathname === '/version/graph') {
      const response = await versionsGraph(env, req);
      return addCORSHeaders(req, response);
    }
    if (pathname === '/api/version/conflicts' || pathname === '/version/conflicts') {
      const response = await versionsConflicts(env, req);
      return addCORSHeaders(req, response);
    }
    
    // Not found
    return new Response(JSON.stringify({
      ok: false,
      error: 'Not found',
      path: pathname
    }), {
      status: 404,
      headers: { 'content-type': 'application/json' }
    });
  }
};
