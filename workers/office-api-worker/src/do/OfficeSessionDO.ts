// do/OfficeSessionDO.ts
// Durable Object for LLM Session management (Part I - Entity/Instance separation)

export class OfficeSessionDO {
  state: DurableObjectState;
  env: any;
  
  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    this.env = env;
  }
  
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Get session state
    if (path === '/state' && request.method === 'GET') {
      const state = await this.state.storage.get('sessionState');
      return new Response(JSON.stringify({
        ok: true,
        state: state || null
      }), {
        headers: { 'content-type': 'application/json' }
      });
    }
    
    // Update session state
    if (path === '/state' && request.method === 'POST') {
      const body = await request.json();
      await this.state.storage.put('sessionState', body);
      return new Response(JSON.stringify({
        ok: true
      }), {
        headers: { 'content-type': 'application/json' }
      });
    }
    
    // Get token budget
    if (path === '/budget' && request.method === 'GET') {
      const budget = await this.getTokenBudget();
      return new Response(JSON.stringify({
        ok: true,
        budget
      }), {
        headers: { 'content-type': 'application/json' }
      });
    }
    
    // Consume tokens
    if (path === '/budget/consume' && request.method === 'POST') {
      const body = await request.json();
      const { tokens } = body;
      const result = await this.consumeTokens(tokens);
      return new Response(JSON.stringify({
        ok: result.success,
        remaining: result.remaining,
        error: result.error
      }), {
        headers: { 'content-type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({
      ok: true,
      do: 'OfficeSessionDO',
      methods: ['GET /state', 'POST /state', 'GET /budget', 'POST /budget/consume']
    }), {
      headers: { 'content-type': 'application/json' }
    });
  }
  
  private async getTokenBudget(): Promise<{
    total: number;
    used: number;
    remaining: number;
    perSession: Record<string, number>;
  }> {
    const state = await this.state.storage.get('tokenBudget') || {
      total: 50000,
      used: 0,
      perSession: {}
    };
    
    return {
      total: state.total,
      used: state.used,
      remaining: state.total - state.used,
      perSession: state.perSession || {}
    };
  }
  
  private async consumeTokens(tokens: number): Promise<{
    success: boolean;
    remaining: number;
    error?: string;
  }> {
    const budget = await this.getTokenBudget();
    
    if (budget.remaining < tokens) {
      return {
        success: false,
        remaining: budget.remaining,
        error: 'Insufficient token budget'
      };
    }
    
    const newUsed = budget.used + tokens;
    await this.state.storage.put('tokenBudget', {
      ...budget,
      used: newUsed
    });
    
    return {
      success: true,
      remaining: budget.total - newUsed
    };
  }
}
