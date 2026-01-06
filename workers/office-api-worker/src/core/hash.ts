// core/hash.ts
// Hash utilities

/**
 * Hash string using SHA-256
 */
export async function hashSHA256(data: string | ArrayBuffer): Promise<string> {
  const encoder = typeof data === 'string' ? new TextEncoder() : null;
  const buffer = typeof data === 'string' 
    ? encoder!.encode(data) 
    : data instanceof ArrayBuffer 
      ? data 
      : new Uint8Array(data);
  
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Hash string using SHA-256 and return as hex
 */
export async function hashSHA256Hex(data: string): Promise<string> {
  return hashSHA256(data);
}

/**
 * Create HMAC-SHA256
 */
export async function hmacSHA256(
  key: string | ArrayBuffer,
  data: string | ArrayBuffer
): Promise<string> {
  const keyBuffer = typeof key === 'string' 
    ? new TextEncoder().encode(key) 
    : key instanceof ArrayBuffer 
      ? key 
      : new Uint8Array(key);
  
  const dataBuffer = typeof data === 'string' 
    ? new TextEncoder().encode(data) 
    : data instanceof ArrayBuffer 
      ? data 
      : new Uint8Array(data);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, dataBuffer);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify HMAC-SHA256
 */
export async function verifyHMAC(
  key: string | ArrayBuffer,
  data: string | ArrayBuffer,
  signature: string
): Promise<boolean> {
  const expected = await hmacSHA256(key, data);
  return expected === signature;
}
