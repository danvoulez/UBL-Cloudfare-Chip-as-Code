// http/routes_simulation.ts
// Simulation endpoint (Padrão 7, Part I)

import { simulateAction } from '../domain/simulation';

export async function simulationRun(env: any, req: Request): Promise<Response> {
  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), {
        status: 405,
        headers: { 'content-type': 'application/json' }
      });
    }
    
    const body = await req.json();
    const { action, actionType, parameters, riskScore } = body;
    
    if (!action || !actionType) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'Missing required fields: action, actionType'
      }), {
        status: 400,
        headers: { 'content-type': 'application/json' }
      });
    }
    
    const result = await simulateAction(env, {
      action,
      actionType,
      parameters: parameters || {},
      riskScore
    });
    
    return new Response(JSON.stringify({
      ok: true,
      simulation: result
    }), {
      headers: { 'content-type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({
      ok: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }
}
