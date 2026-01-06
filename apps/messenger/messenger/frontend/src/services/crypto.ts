/**
 * UBL Frontend Cryptography
 * 
 * Implements Ed25519 signing using WebAuthn PRF extension.
 * The PRF extension allows extracting stable cryptographic material from a passkey,
 * which we use to derive an Ed25519 signing key.
 * 
 * Flow:
 * 1. User authenticates with passkey (normal WebAuthn)
 * 2. We request PRF extension with a stable salt
 * 3. PRF returns 32 bytes of material derived from passkey secret
 * 4. We use those 32 bytes as Ed25519 seed
 * 5. Sign messages client-side before sending to API
 * 
 * References:
 * - WebAuthn PRF: https://w3c.github.io/webauthn/#prf-extension
 * - Ed25519: RFC 8032
 */

// ============================================================================
// Types
// ============================================================================

export interface SigningKey {
  publicKeyHex: string;
  /** Internal use only - derived Ed25519 seed */
  _seed: Uint8Array;
}

export interface SignedLink {
  version: number;
  container_id: string;
  expected_sequence: number;
  previous_hash: string;
  atom_hash: string;
  intent_class: string;
  physics_delta: string;
  author_pubkey: string;
  signature: string;
  pact: any | null;
  atom?: any;
}

export interface LinkToSign {
  version: number;
  container_id: string;
  expected_sequence: number;
  previous_hash: string;
  atom_hash: string;
  intent_class: string;
  physics_delta: string;
  pact?: any | null;
  atom?: any;
}

// ============================================================================
// PRF Salt - Must be stable per user/app
// ============================================================================

/**
 * Stable salt for PRF derivation.
 * This should be the same across all sessions to get consistent key material.
 * Using a fixed salt tied to the application domain.
 */
const UBL_PRF_SALT = new TextEncoder().encode('ubl-ed25519-signing-v1');

// ============================================================================
// Ed25519 Implementation (Pure TypeScript)
// ============================================================================

/**
 * Ed25519 constants and utilities
 * Based on RFC 8032 and tweetnacl reference implementation
 */

// Field prime p = 2^255 - 19
const P = 2n ** 255n - 19n;

// Group order
const L = 2n ** 252n + 27742317777372353535851937790883648493n;

// Base point x coordinate
const Bx = 15112221349535807912866137220509078935008241517919253862909182699782852816284n;
// Base point y coordinate
const By = 46316835694926478169428394003475163141307993866256225615783033603165251855960n;

// d constant
const D = -121665n * modInverse(121666n, P) % P;

// sqrt(-1) mod p
const I = modPow(2n, (P - 1n) / 4n, P);

function mod(a: bigint, m: bigint): bigint {
  return ((a % m) + m) % m;
}

function modPow(base: bigint, exp: bigint, m: bigint): bigint {
  let result = 1n;
  base = mod(base, m);
  while (exp > 0n) {
    if (exp % 2n === 1n) {
      result = mod(result * base, m);
    }
    exp = exp / 2n;
    base = mod(base * base, m);
  }
  return result;
}

function modInverse(a: bigint, m: bigint): bigint {
  return modPow(a, m - 2n, m);
}

// Point operations (extended coordinates)
type Point = [bigint, bigint, bigint, bigint]; // (X, Y, Z, T) where x=X/Z, y=Y/Z, xy=T/Z

const ZERO: Point = [0n, 1n, 1n, 0n];

function pointAdd(p1: Point, p2: Point): Point {
  const [X1, Y1, Z1, T1] = p1;
  const [X2, Y2, Z2, T2] = p2;

  const A = mod((Y1 - X1) * (Y2 - X2), P);
  const B = mod((Y1 + X1) * (Y2 + X2), P);
  const C = mod(T1 * 2n * D * T2, P);
  const DD = mod(Z1 * 2n * Z2, P);
  const E = mod(B - A, P);
  const F = mod(DD - C, P);
  const G = mod(DD + C, P);
  const H = mod(B + A, P);
  const X3 = mod(E * F, P);
  const Y3 = mod(G * H, P);
  const T3 = mod(E * H, P);
  const Z3 = mod(F * G, P);

  return [X3, Y3, Z3, T3];
}

function pointDouble(p: Point): Point {
  const [X1, Y1, Z1, _] = p;
  const A = mod(X1 * X1, P);
  const B = mod(Y1 * Y1, P);
  const C = mod(2n * Z1 * Z1, P);
  const H = mod(A + B, P);
  const E = mod(H - mod((X1 + Y1) * (X1 + Y1), P), P);
  const G = mod(A - B, P);
  const F = mod(C + G, P);
  const X3 = mod(E * F, P);
  const Y3 = mod(G * H, P);
  const T3 = mod(E * H, P);
  const Z3 = mod(F * G, P);

  return [X3, Y3, Z3, T3];
}

function scalarMult(s: bigint, p: Point): Point {
  let result: Point = ZERO;
  let addend = p;

  while (s > 0n) {
    if (s & 1n) {
      result = pointAdd(result, addend);
    }
    addend = pointDouble(addend);
    s >>= 1n;
  }

  return result;
}

function pointToBytes(p: Point): Uint8Array {
  const [X, Y, Z, _] = p;
  const zi = modInverse(Z, P);
  const x = mod(X * zi, P);
  const y = mod(Y * zi, P);

  const bytes = new Uint8Array(32);
  let yVal = y;
  for (let i = 0; i < 32; i++) {
    bytes[i] = Number(yVal & 0xffn);
    yVal >>= 8n;
  }
  bytes[31] ^= Number(x & 1n) << 7;
  return bytes;
}

// Base point in extended coordinates
function getBasePoint(): Point {
  const x = Bx;
  const y = By;
  const t = mod(x * y, P);
  return [x, y, 1n, t];
}

// ============================================================================
// SHA-512 (for Ed25519 key derivation and signing)
// ============================================================================

/**
 * SHA-512 implementation
 * Required for Ed25519 key derivation and signing
 */
async function sha512(data: Uint8Array): Promise<Uint8Array> {
  const hash = await crypto.subtle.digest('SHA-512', data);
  return new Uint8Array(hash);
}

function clamp(bytes: Uint8Array): bigint {
  const clamped = new Uint8Array(bytes);
  clamped[0] &= 248;
  clamped[31] &= 127;
  clamped[31] |= 64;
  return bytesToBigInt(clamped.slice(0, 32));
}

function bytesToBigInt(bytes: Uint8Array): bigint {
  let result = 0n;
  for (let i = bytes.length - 1; i >= 0; i--) {
    result = (result << 8n) | BigInt(bytes[i]);
  }
  return result;
}

function bigIntToBytes(n: bigint, length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  for (let i = 0; i < length; i++) {
    bytes[i] = Number(n & 0xffn);
    n >>= 8n;
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ============================================================================
// Ed25519 Key Derivation and Signing
// ============================================================================

/**
 * Derive Ed25519 keypair from 32-byte seed
 */
async function deriveKeypair(seed: Uint8Array): Promise<{ publicKey: Uint8Array; privateKey: Uint8Array }> {
  if (seed.length !== 32) {
    throw new Error('Seed must be 32 bytes');
  }

  // Hash seed to get private scalar and prefix
  const h = await sha512(seed);
  const s = clamp(h);

  // Compute public key: A = sB
  const A = scalarMult(s, getBasePoint());
  const publicKey = pointToBytes(A);

  // Private key is the seed (used with hash for signing)
  return { publicKey, privateKey: seed };
}

/**
 * Sign a message with Ed25519
 */
async function ed25519Sign(message: Uint8Array, seed: Uint8Array): Promise<Uint8Array> {
  // 1. Hash seed
  const h = await sha512(seed);
  const s = clamp(h);
  const prefix = h.slice(32, 64);

  // 2. Compute public key
  const A = scalarMult(s, getBasePoint());
  const publicKey = pointToBytes(A);

  // 3. r = H(prefix || message) mod L
  const rHash = await sha512(concat(prefix, message));
  const r = mod(bytesToBigInt(rHash), L);

  // 4. R = rB
  const R = scalarMult(r, getBasePoint());
  const Rbytes = pointToBytes(R);

  // 5. k = H(R || A || message) mod L
  const kHash = await sha512(concat(Rbytes, publicKey, message));
  const k = mod(bytesToBigInt(kHash), L);

  // 6. s = (r + k*s) mod L
  const S = mod(r + k * s, L);
  const Sbytes = bigIntToBytes(S, 32);

  // 7. Signature = R || S
  return concat(Rbytes, Sbytes);
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

// ============================================================================
// WebAuthn PRF Extension
// ============================================================================

/**
 * Check if WebAuthn PRF extension is likely supported
 * Note: Actual support depends on the authenticator
 */
export function isPRFLikelySupported(): boolean {
  return 'PublicKeyCredential' in window && 'credentials' in navigator;
}

/**
 * Extract PRF material from a WebAuthn authentication
 * Must be called with a valid credential ID from a previous registration
 */
export async function extractPRFMaterial(
  credentialId: ArrayBuffer,
  allowedCredentials: PublicKeyCredentialDescriptor[]
): Promise<Uint8Array | null> {
  try {
    // Create PRF inputs
    const prfInputs = {
      eval: {
        first: UBL_PRF_SALT,
      },
    };

    // Request authentication with PRF extension
    const credential = await navigator.credentials.get({
      publicKey: {
        challenge: crypto.getRandomValues(new Uint8Array(32)),
        allowCredentials: allowedCredentials,
        userVerification: 'required',
        extensions: {
          // @ts-ignore - PRF extension typing
          prf: prfInputs,
        },
      },
    }) as PublicKeyCredential | null;

    if (!credential) {
      return null;
    }

    // Extract PRF results
    const extensions = credential.getClientExtensionResults() as any;
    if (extensions.prf?.results?.first) {
      return new Uint8Array(extensions.prf.results.first);
    }

    console.warn('PRF extension not supported by authenticator');
    return null;
  } catch (error) {
    console.error('Failed to extract PRF material:', error);
    return null;
  }
}

// ============================================================================
// Signing Key Management
// ============================================================================

let cachedSigningKey: SigningKey | null = null;

/**
 * Derive a signing key from PRF material
 */
export async function deriveSigningKey(prfMaterial: Uint8Array): Promise<SigningKey> {
  // PRF output might not be exactly 32 bytes, so hash it to get a consistent seed
  const seed = (await sha512(prfMaterial)).slice(0, 32);
  const { publicKey } = await deriveKeypair(seed);

  cachedSigningKey = {
    publicKeyHex: bytesToHex(publicKey),
    _seed: seed,
  };

  return cachedSigningKey;
}

/**
 * Get the cached signing key, if any
 */
export function getCachedSigningKey(): SigningKey | null {
  return cachedSigningKey;
}

/**
 * Clear the cached signing key (e.g., on logout)
 */
export function clearSigningKey(): void {
  if (cachedSigningKey) {
    cachedSigningKey._seed.fill(0);
    cachedSigningKey = null;
  }
}

// ============================================================================
// Link Signing
// ============================================================================

/**
 * Canonicalize JSON for signing (sorted keys, no whitespace)
 */
function canonicalize(obj: any): string {
  if (obj === null || obj === undefined) {
    return 'null';
  }
  if (typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalize).join(',') + ']';
  }
  const keys = Object.keys(obj).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + canonicalize(obj[k])).join(',') + '}';
}

/**
 * Sign a link with the cached signing key
 * Returns null if no signing key is available
 */
export async function signLink(link: LinkToSign): Promise<SignedLink | null> {
  if (!cachedSigningKey) {
    console.warn('No signing key available - link will not be signed client-side');
    return null;
  }

  // Build canonical signing data (must match server verification)
  const signingData = {
    version: link.version,
    container_id: link.container_id,
    expected_sequence: link.expected_sequence,
    previous_hash: link.previous_hash,
    atom_hash: link.atom_hash,
    intent_class: link.intent_class,
    physics_delta: link.physics_delta,
    pact: link.pact || null,
  };

  const signingBytes = new TextEncoder().encode(canonicalize(signingData));
  const signature = await ed25519Sign(signingBytes, cachedSigningKey._seed);

  return {
    ...link,
    author_pubkey: cachedSigningKey.publicKeyHex,
    signature: bytesToHex(signature),
    pact: link.pact || null,
  };
}

/**
 * Hash data with BLAKE3 (stub - uses SHA-256 as fallback)
 * For production, consider using a BLAKE3 WASM library
 */
export async function hashAtom(atom: any): Promise<string> {
  const canonical = canonicalize(atom);
  const bytes = new TextEncoder().encode(canonical);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return bytesToHex(new Uint8Array(hash));
}

// ============================================================================
// Fallback: Server-Side Signing
// ============================================================================

/**
 * If PRF is not available, the server can sign on behalf of the user
 * using the "boundary" key. This is less secure but maintains functionality.
 */
export function isClientSideSigningAvailable(): boolean {
  return cachedSigningKey !== null;
}

/**
 * Export public key for registration in id_subjects
 */
export function getPublicKeyForRegistration(): string | null {
  return cachedSigningKey?.publicKeyHex || null;
}
