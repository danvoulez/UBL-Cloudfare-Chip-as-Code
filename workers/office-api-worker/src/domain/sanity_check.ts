// domain/sanity_check.ts
// Sanity Check (Padrão 4, Part I & Padrão 15, Part II)
// Validates claims from handover against objective facts

export interface SanityCheckResult {
  discrepancies: string[];
  valid: boolean;
}

/**
 * Extracts claims from handover and validates against workspace facts
 */
export async function sanityCheck(
  env: any,
  handover: any,
  workspaceId: string
): Promise<SanityCheckResult> {
  const discrepancies: string[] = [];
  
  // Extract claims from handover (simple keyword-based extraction)
  const content = handover.summary || handover.content || '';
  const claims = extractClaims(content);
  
  // Validate each claim
  for (const claim of claims) {
    const validation = await validateClaim(env, claim, workspaceId);
    if (!validation.valid) {
      discrepancies.push(validation.message);
    }
  }
  
  // Validate canonical map (if exists)
  if (handover.canonical_map_json) {
    const canonicalMap = JSON.parse(handover.canonical_map_json || '{}');
    for (const [fileId, reason] of Object.entries(canonicalMap)) {
      const isCanonical = await checkCanonical(env, fileId as string);
      if (!isCanonical) {
        discrepancies.push(`Handover afirma que ${fileId} é canônico, mas não está marcado como tal.`);
      }
    }
  }
  
  // Validate unresolved items (if they were resolved)
  if (handover.unresolved_json) {
    const unresolved = JSON.parse(handover.unresolved_json || '[]');
    for (const item of unresolved) {
      const resolved = await checkResolved(env, item, workspaceId);
      if (resolved) {
        discrepancies.push(`Item "${item}" foi marcado como não resolvido, mas parece ter sido resolvido.`);
      }
    }
  }
  
  return {
    discrepancies,
    valid: discrepancies.length === 0
  };
}

/**
 * Simple keyword-based claim extraction
 * TODO: Can be enhanced with LLM extraction for more sophisticated claims
 */
function extractClaims(text: string): string[] {
  const claims: string[] = [];
  const keywords = ['canônico', 'canonical', 'conflito', 'conflict', 'resolvido', 'resolved', 'pendente', 'pending'];
  
  const lines = text.split('\n');
  for (const line of lines) {
    for (const keyword of keywords) {
      if (line.toLowerCase().includes(keyword)) {
        claims.push(line.trim());
      }
    }
  }
  
  return claims;
}

async function validateClaim(env: any, claim: string, workspaceId: string): Promise<{ valid: boolean; message?: string }> {
  // Simple validation - can be enhanced
  // For now, just check if claim mentions canonical files
  if (claim.toLowerCase().includes('canônico') || claim.toLowerCase().includes('canonical')) {
    // Extract file IDs from claim (simplified)
    const fileIdMatch = claim.match(/file[_-]?(\w+)/i);
    if (fileIdMatch) {
      const fileId = fileIdMatch[1];
      const isCanonical = await checkCanonical(env, fileId);
      if (!isCanonical && claim.toLowerCase().includes('é canônico')) {
        return {
          valid: false,
          message: `Claim "${claim}" afirma que arquivo é canônico, mas não está marcado.`
        };
      }
    }
  }
  
  return { valid: true };
}

async function checkCanonical(env: any, fileId: string): Promise<boolean> {
  const result = await env.OFFICE_DB.prepare(
    `SELECT f.canonical FROM file f 
     WHERE f.id = ? AND f.canonical = 1`
  ).bind(fileId).first();
  
  return !!result;
}

async function checkResolved(env: any, item: string, workspaceId: string): Promise<boolean> {
  // Simple check - can be enhanced based on item type
  // For now, just return false (assume unresolved)
  return false;
}
