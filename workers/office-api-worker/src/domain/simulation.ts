// domain/simulation.ts
// Safety Net (Padrão 7, Part I) - Action Simulation
// Allows LLM to test actions before executing them

export interface SimulationRequest {
  action: string;
  actionType: 'file_delete' | 'file_move' | 'file_publish' | 'canonical_mark' | 'other';
  parameters: Record<string, any>;
  riskScore?: number;
}

export interface SimulationResult {
  outcomes: Outcome[];
  recommendation: 'proceed' | 'modify' | 'abandon';
  reasoning: string;
}

export interface Outcome {
  description: string;
  probability: number;
  consequences: string[];
}

/**
 * Simulates an action in a sandbox environment
 * Returns possible outcomes and recommendations
 */
export async function simulateAction(
  env: any,
  request: SimulationRequest
): Promise<SimulationResult> {
  const riskScore = request.riskScore || calculateRiskScore(request);
  
  // High-risk actions require simulation
  if (riskScore > 0.7) {
    return await simulateHighRiskAction(env, request);
  }
  
  // Medium-risk actions get basic simulation
  if (riskScore > 0.3) {
    return await simulateMediumRiskAction(env, request);
  }
  
  // Low-risk actions get minimal simulation
  return await simulateLowRiskAction(env, request);
}

function calculateRiskScore(request: SimulationRequest): number {
  // Risk scoring based on action type
  const riskMap: Record<string, number> = {
    'file_delete': 0.9,
    'file_publish': 0.8,
    'canonical_mark': 0.6,
    'file_move': 0.4,
    'other': 0.5
  };
  
  return riskMap[request.actionType] || 0.5;
}

async function simulateHighRiskAction(
  env: any,
  request: SimulationRequest
): Promise<SimulationResult> {
  const outcomes: Outcome[] = [];
  
  // Check dependencies
  if (request.actionType === 'file_delete') {
    const fileId = request.parameters.fileId;
    const dependencies = await checkDependencies(env, fileId);
    
    if (dependencies.length > 0) {
      outcomes.push({
        description: 'Arquivo tem dependências',
        probability: 1.0,
        consequences: [
          `${dependencies.length} arquivos referenciam este arquivo`,
          'Deletar pode quebrar referências',
          'Considere marcar como obsoleto ao invés de deletar'
        ]
      });
    }
  }
  
  // Check if canonical
  if (request.actionType === 'file_delete' || request.actionType === 'file_move') {
    const fileId = request.parameters.fileId;
    const isCanonical = await checkCanonical(env, fileId);
    
    if (isCanonical) {
      outcomes.push({
        description: 'Arquivo é canônico',
        probability: 1.0,
        consequences: [
          'Este arquivo é a versão canônica da família',
          'Deletar/mover pode causar perda de referência principal',
          'Considere marcar outro arquivo como canônico primeiro'
        ]
      });
    }
  }
  
  // Generate recommendation
  let recommendation: 'proceed' | 'modify' | 'abandon' = 'proceed';
  let reasoning = 'Ação pode ser executada com cuidado.';
  
  if (outcomes.some(o => o.consequences.some(c => c.includes('dependências')))) {
    recommendation = 'modify';
    reasoning = 'Ação tem dependências. Considere alternativa.';
  }
  
  if (outcomes.some(o => o.consequences.some(c => c.includes('canônico')))) {
    recommendation = 'abandon';
    reasoning = 'Não é recomendado modificar arquivo canônico sem substituição.';
  }
  
  return {
    outcomes,
    recommendation,
    reasoning
  };
}

async function simulateMediumRiskAction(
  env: any,
  request: SimulationRequest
): Promise<SimulationResult> {
  return {
    outcomes: [{
      description: 'Ação de risco médio',
      probability: 0.7,
      consequences: ['Ação pode ser executada com monitoramento']
    }],
    recommendation: 'proceed',
    reasoning: 'Ação de risco médio. Pode prosseguir com cuidado.'
  };
}

async function simulateLowRiskAction(
  env: any,
  request: SimulationRequest
): Promise<SimulationResult> {
  return {
    outcomes: [{
      description: 'Ação de baixo risco',
      probability: 0.9,
      consequences: ['Ação segura para executar']
    }],
    recommendation: 'proceed',
    reasoning: 'Ação de baixo risco. Pode prosseguir.'
  };
}

async function checkDependencies(env: any, fileId: string): Promise<string[]> {
  const result = await env.OFFICE_DB.prepare(
    `SELECT DISTINCT src_file_id FROM version_edge WHERE dst_file_id = ?`
  ).bind(fileId).all();
  
  return (result.results || []).map((r: any) => r.src_file_id);
}

async function checkCanonical(env: any, fileId: string): Promise<boolean> {
  const result = await env.OFFICE_DB.prepare(
    `SELECT canonical FROM file WHERE id = ? AND canonical = 1`
  ).bind(fileId).first();
  
  return !!result;
}
