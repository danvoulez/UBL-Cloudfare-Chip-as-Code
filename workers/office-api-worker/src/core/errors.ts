// core/errors.ts
// ErrorTokens - Structured, machine-readable errors (Part I)

export interface ErrorToken {
  code: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  remediation?: string;
  context?: Record<string, any>;
  timestamp: number;
}

export class OfficeError extends Error {
  public errorToken: ErrorToken;
  
  constructor(errorToken: ErrorToken) {
    super(errorToken.message);
    this.name = 'OfficeError';
    this.errorToken = errorToken;
  }
  
  toJSON() {
    return this.errorToken;
  }
}

/**
 * Creates an ErrorToken
 */
export function createErrorToken(
  code: string,
  message: string,
  severity: 'error' | 'warning' | 'info' = 'error',
  remediation?: string,
  context?: Record<string, any>
): ErrorToken {
  return {
    code,
    message,
    severity,
    remediation,
    context,
    timestamp: Date.now()
  };
}

/**
 * Common error codes
 */
export const ErrorCodes = {
  // File errors
  FILE_NOT_FOUND: 'FILE_NOT_FOUND',
  FILE_ALREADY_EXISTS: 'FILE_ALREADY_EXISTS',
  FILE_DELETE_FAILED: 'FILE_DELETE_FAILED',
  
  // Handover errors
  HANDOVER_TOO_SHORT: 'HANDOVER_TOO_SHORT',
  HANDOVER_INVALID: 'HANDOVER_INVALID',
  
  // Lens errors
  LENS_NOT_FOUND: 'LENS_NOT_FOUND',
  LENS_INVALID_FILTERS: 'LENS_INVALID_FILTERS',
  
  // Version graph errors
  VERSION_GRAPH_NOT_COMPUTED: 'VERSION_GRAPH_NOT_COMPUTED',
  CANONICAL_MARK_FAILED: 'CANONICAL_MARK_FAILED',
  
  // Evidence errors
  EVIDENCE_INSUFFICIENT: 'EVIDENCE_INSUFFICIENT',
  EVIDENCE_QUERY_INVALID: 'EVIDENCE_QUERY_INVALID',
  
  // Simulation errors
  SIMULATION_FAILED: 'SIMULATION_FAILED',
  ACTION_TOO_RISKY: 'ACTION_TOO_RISKY',
  
  // General errors
  INVALID_REQUEST: 'INVALID_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
} as const;

/**
 * Error factory functions
 */
export const Errors = {
  fileNotFound: (fileId: string) => createErrorToken(
    ErrorCodes.FILE_NOT_FOUND,
    `File ${fileId} not found`,
    'error',
    'Verify file ID and workspace access',
    { fileId }
  ),
  
  handoverTooShort: (minLength: number = 50) => createErrorToken(
    ErrorCodes.HANDOVER_TOO_SHORT,
    `Handover must be at least ${minLength} characters`,
    'error',
    'Provide more detail about the session',
    { minLength }
  ),
  
  lensNotFound: (lensId: string) => createErrorToken(
    ErrorCodes.LENS_NOT_FOUND,
    `Lens ${lensId} not found`,
    'error',
    'Check lens ID or create a new lens',
    { lensId }
  ),
  
  actionTooRisky: (action: string, riskScore: number) => createErrorToken(
    ErrorCodes.ACTION_TOO_RISKY,
    `Action ${action} has high risk score: ${riskScore}`,
    'warning',
    'Consider using simulation first or modifying the action',
    { action, riskScore }
  ),
  
  evidenceInsufficient: (query: string) => createErrorToken(
    ErrorCodes.EVIDENCE_INSUFFICIENT,
    `Insufficient evidence for query: ${query}`,
    'warning',
    'Try a different query or expand the search scope',
    { query }
  )
};
