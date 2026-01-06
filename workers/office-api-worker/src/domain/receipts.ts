// domain/receipts.ts
// Receipts - Cryptographic proof of actions (Part I)

export interface Receipt {
  id: string;
  kind: string;
  actor: string;
  workspaceId?: string;
  body: Record<string, any>;
  signature: string;
  publicKey: string;
  createdAt: number;
}

export interface ReceiptRequest {
  kind: string;
  actor: string;
  workspaceId?: string;
  body: Record<string, any>;
}

/**
 * Create and sign a receipt
 */
export async function createReceipt(
  env: any,
  request: ReceiptRequest,
  privateKey?: string
): Promise<Receipt> {
  const id = crypto.randomUUID();
  const createdAt = Date.now();
  
  const receiptBody = {
    id,
    kind: request.kind,
    actor: request.actor,
    workspaceId: request.workspaceId,
    body: request.body,
    createdAt
  };
  
  const canonical = JSON.stringify(receiptBody);
  const signature = await signReceipt(canonical, privateKey || env.RECEIPT_PRIVATE_KEY);
  const publicKey = await getPublicKey(privateKey || env.RECEIPT_PRIVATE_KEY);
  
  // Store receipt in database
  await env.OFFICE_DB.prepare(
    `INSERT INTO receipt (id, kind, actor, workspace_id, body_json, sig_hex, pubkey_hex, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    request.kind,
    request.actor,
    request.workspaceId || null,
    canonical,
    signature,
    publicKey,
    createdAt
  ).run();
  
  return {
    id,
    kind: request.kind,
    actor: request.actor,
    workspaceId: request.workspaceId,
    body: request.body,
    signature,
    publicKey,
    createdAt
  };
}

/**
 * Verify receipt signature
 */
export async function verifyReceipt(
  env: any,
  receiptId: string
): Promise<{ valid: boolean; receipt?: Receipt; error?: string }> {
  const result = await env.OFFICE_DB.prepare(
    'SELECT * FROM receipt WHERE id = ?'
  ).bind(receiptId).first();
  
  if (!result) {
    return { valid: false, error: 'Receipt not found' };
  }
  
  const canonical = result.body_json as string;
  const signature = result.sig_hex as string;
  const publicKey = result.pubkey_hex as string;
  
  const valid = await verifySignature(canonical, signature, publicKey);
  
  if (!valid) {
    return { valid: false, error: 'Invalid signature' };
  }
  
  const receipt: Receipt = {
    id: result.id as string,
    kind: result.kind as string,
    actor: result.actor as string,
    workspaceId: result.workspace_id as string | undefined,
    body: JSON.parse(canonical),
    signature,
    publicKey,
    createdAt: result.created_at as number
  };
  
  return { valid: true, receipt };
}

/**
 * Sign receipt using Ed25519
 * TODO: Implement proper Ed25519 signing using Web Crypto API
 * Note: Cloudflare Workers support Web Crypto API for Ed25519
 */
async function signReceipt(canonical: string, privateKeyPEM?: string): Promise<string> {
  if (!privateKeyPEM) {
    return 'UNSIGNED';
  }
  
  try {
    // TODO: Parse PEM and use crypto.subtle.sign with Ed25519
    // For now, use HMAC as fallback
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(privateKeyPEM.slice(0, 32)),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(canonical));
    const hashArray = Array.from(new Uint8Array(signature));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (error) {
    console.error('Signing failed:', error);
    return 'UNSIGNED';
  }
}

/**
 * Extract public key from private key
 * TODO: Implement proper Ed25519 public key extraction
 */
async function getPublicKey(privateKeyPEM?: string): Promise<string> {
  if (!privateKeyPEM) {
    return 'UNAVAILABLE';
  }
  
  try {
    // TODO: Extract Ed25519 public key from private key
    // For now, return hash of private key as identifier
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(privateKeyPEM));
    const hashArray = Array.from(new Uint8Array(hash));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (error) {
    console.error('Public key extraction failed:', error);
    return 'UNAVAILABLE';
  }
}

/**
 * Verify receipt signature
 * TODO: Implement proper Ed25519 verification
 */
async function verifySignature(
  canonical: string,
  signature: string,
  publicKey: string
): Promise<boolean> {
  if (signature === 'UNSIGNED' || publicKey === 'UNAVAILABLE') {
    return false;
  }
  
  try {
    // TODO: Use crypto.subtle.verify with Ed25519
    // For now, re-sign and compare (HMAC fallback)
    const expected = await signReceipt(canonical, publicKey);
    return expected === signature;
  } catch (error) {
    console.error('Verification failed:', error);
    return false;
  }
}
