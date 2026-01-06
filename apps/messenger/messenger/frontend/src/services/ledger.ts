
export const LEDGER_CONFIG = {
  GAS_PRICE: 0.000012,
  NETWORK_ID: 'ubl-mainnet-v1',
  PRECISION: 8
};

export class LedgerService {
  /**
   * Generate a deterministic SHA-256 hash of content
   * IMPORTANT: Does NOT include timestamp - hash is deterministic for same input
   */
  static async generateHash(content: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return `0x${hashHex}`;
  }

  /**
   * Generate hash with previous hash for chain linking
   * This is the proper way to create ledger entry hashes
   */
  static async generateChainHash(content: string, previousHash: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(previousHash + content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return `0x${hashHex}`;
  }

  /**
   * @deprecated Use generateHash() instead - this is not cryptographically secure
   * Kept for backwards compatibility
   */
  static generateHashSync(content: string): string {
    console.warn('generateHashSync is deprecated and not cryptographically secure');
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    const hex = Math.abs(hash).toString(16).padStart(8, '0');
    // Use content-based suffix instead of random for determinism
    const suffix = content.length.toString(16).padStart(8, '0');
    return `0X${hex}${suffix}`.toUpperCase();
  }

  static calculateExecutionCost(content: string, isAgent: boolean): number {
    const base = isAgent ? 0.0004 : 0.0001;
    const complexity = content.length * 0.000005;
    return parseFloat((base + complexity).toFixed(LEDGER_CONFIG.PRECISION));
  }

  static verifyIntegrity(hash: string): boolean {
    return /^0X[0-9A-F]{32,}$/.test(hash);
  }
}
