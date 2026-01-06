// domain/narrative.ts
// Narrator (Padrão 2, Part I) - Narrative Generator
// Transforms Context Frame into first-person narrative

import { buildFileContextFrame, type FileContextFrame } from './frame_builder';
import { getLatestHandover } from './handover';
import { sanityCheck } from './sanity_check';

export interface NarrativeContext {
  entityId: string;
  workspaceId: string;
  sessionType?: 'work' | 'assist' | 'deliberate' | 'research';
  constitution?: string;
}

export interface NarrativeResult {
  narrative: string;
  governanceNotes?: string[];
  handover?: any;
}

/**
 * Generates first-person narrative from Context Frame
 * Applies Sanity Check and injects Constitution
 */
export async function prepareNarrative(
  env: any,
  context: NarrativeContext
): Promise<NarrativeResult> {
  // 1. Build Context Frame
  const frame = await buildFileContextFrame(env, context.workspaceId);
  
  // 2. Get latest handover (if exists)
  const handover = await getLatestHandover(env, context.entityId, context.workspaceId);
  
  // 3. Apply Sanity Check (if handover exists)
  let governanceNotes: string[] = [];
  if (handover) {
    const sanity = await sanityCheck(env, handover, context.workspaceId);
    if (sanity.discrepancies.length > 0) {
      governanceNotes = sanity.discrepancies;
    }
  }
  
  // 4. Get Constitution
  const constitution = context.constitution || await getConstitution(env, context.entityId);
  
  // 5. Build narrative sections
  const sections: string[] = [];
  
  // Identity
  sections.push(`Você é ${context.entityId}, operando no workspace ${context.workspaceId}.`);
  
  // Situation
  sections.push(`O workspace contém ${frame.inventory.length} arquivos.`);
  if (frame.canonicals.length > 0) {
    sections.push(`${frame.canonicals.length} arquivos estão marcados como canônicos.`);
  }
  if (frame.topAnchors.length > 0) {
    sections.push(`${frame.topAnchors.length} âncoras relevantes foram identificadas.`);
  }
  
  // Handover (if exists)
  if (handover) {
    sections.push(`\nHandover anterior:\n${handover.summary || handover.content || ''}`);
  }
  
  // Governance Notes (from Sanity Check)
  if (governanceNotes.length > 0) {
    sections.push(`\nNotas de governança:\n${governanceNotes.join('\n')}`);
  }
  
  // Constitution (injected at the end)
  if (constitution) {
    sections.push(`\n${constitution}`);
  }
  
  // Token budget
  const budget = frame.limits.token_budget[context.sessionType || 'work'];
  sections.push(`\nOrçamento de tokens para esta sessão: ${budget}`);
  
  const narrative = sections.join('\n\n');
  
  return {
    narrative,
    governanceNotes: governanceNotes.length > 0 ? governanceNotes : undefined,
    handover: handover || undefined
  };
}

async function getConstitution(env: any, entityId: string): Promise<string | null> {
  // Try to get from entity config
  const entity = await env.OFFICE_DB.prepare(
    'SELECT constitution_md FROM entities WHERE id = ?'
  ).bind(entityId).first();
  
  if (entity?.constitution_md) {
    return entity.constitution_md as string;
  }
  
  // Fallback to default
  return null;
}
