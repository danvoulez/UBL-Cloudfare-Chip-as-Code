// domain/affordances.ts
// Affordances - List of possible actions for LLM entity

export interface Affordance {
  id: string;
  name: string;
  description: string;
  actionType: string;
  riskScore: number;
  requiresSimulation: boolean;
  parameters: AffordanceParameter[];
}

export interface AffordanceParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required: boolean;
  description: string;
}

export interface AffordancesContext {
  entityId: string;
  workspaceId: string;
  sessionType: 'work' | 'assist' | 'deliberate' | 'research';
}

/**
 * Returns list of available affordances for the entity
 */
export async function getAffordances(
  env: any,
  context: AffordancesContext
): Promise<Affordance[]> {
  const affordances: Affordance[] = [];
  
  // File operations
  affordances.push({
    id: 'file_search',
    name: 'Buscar Arquivos',
    description: 'Busca arquivos no workspace por query semântica',
    actionType: 'file_search',
    riskScore: 0.1,
    requiresSimulation: false,
    parameters: [
      { name: 'query', type: 'string', required: true, description: 'Query de busca' },
      { name: 'topK', type: 'number', required: false, description: 'Número de resultados' }
    ]
  });
  
  affordances.push({
    id: 'file_read',
    name: 'Ler Arquivo',
    description: 'Lê conteúdo de um arquivo específico',
    actionType: 'file_read',
    riskScore: 0.1,
    requiresSimulation: false,
    parameters: [
      { name: 'fileId', type: 'string', required: true, description: 'ID do arquivo' }
    ]
  });
  
  // Evidence operations
  affordances.push({
    id: 'evidence_answer',
    name: 'Responder com Evidência',
    description: 'Responde pergunta com citações de documentos',
    actionType: 'evidence_answer',
    riskScore: 0.2,
    requiresSimulation: false,
    parameters: [
      { name: 'question', type: 'string', required: true, description: 'Pergunta a responder' },
      { name: 'lensId', type: 'string', required: false, description: 'ID da lente para filtrar' }
    ]
  });
  
  // High-risk operations (require simulation)
  if (context.sessionType === 'work') {
    affordances.push({
      id: 'canonical_mark',
      name: 'Marcar como Canônico',
      description: 'Marca arquivo como versão canônica',
      actionType: 'canonical_mark',
      riskScore: 0.6,
      requiresSimulation: true,
      parameters: [
        { name: 'fileId', type: 'string', required: true, description: 'ID do arquivo' },
        { name: 'reason', type: 'string', required: false, description: 'Razão da marcação' }
      ]
    });
    
    affordances.push({
      id: 'file_delete',
      name: 'Deletar Arquivo',
      description: 'Remove arquivo do workspace',
      actionType: 'file_delete',
      riskScore: 0.9,
      requiresSimulation: true,
      parameters: [
        { name: 'fileId', type: 'string', required: true, description: 'ID do arquivo' }
      ]
    });
  }
  
  // Handover operations
  affordances.push({
    id: 'handover_commit',
    name: 'Registrar Handover',
    description: 'Registra handover ao final da sessão',
    actionType: 'handover_commit',
    riskScore: 0.1,
    requiresSimulation: false,
    parameters: [
      { name: 'summary', type: 'string', required: true, description: 'Resumo da sessão' },
      { name: 'bookmarks', type: 'array', required: false, description: 'IDs de âncoras importantes' }
    ]
  });
  
  return affordances;
}

/**
 * Simulates an affordance action
 */
export async function simulateAffordance(
  env: any,
  affordanceId: string,
  parameters: Record<string, any>
): Promise<any> {
  // This delegates to simulation.ts
  const { simulateAction } = await import('./simulation');
  
  // Map affordance to action type
  const actionTypeMap: Record<string, any> = {
    'file_delete': 'file_delete',
    'canonical_mark': 'canonical_mark',
    'file_move': 'file_move',
    'file_publish': 'file_publish'
  };
  
  const actionType = actionTypeMap[affordanceId] || 'other';
  
  return simulateAction(env, {
    action: affordanceId,
    actionType,
    parameters
  });
}
