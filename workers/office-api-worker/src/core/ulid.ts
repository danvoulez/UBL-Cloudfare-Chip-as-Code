// core/ulid.ts
// ULID (Universally Unique Lexicographically Sortable Identifier) generation

const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const TIME_LEN = 10;
const RANDOM_LEN = 16;

/**
 * Generate ULID
 */
export function generateULID(): string {
  const now = Date.now();
  return encodeTime(now, TIME_LEN) + encodeRandom(RANDOM_LEN);
}

/**
 * Generate ULID with custom timestamp
 */
export function generateULIDFromTime(timestamp: number): string {
  return encodeTime(timestamp, TIME_LEN) + encodeRandom(RANDOM_LEN);
}

function encodeTime(now: number, len: number): string {
  let str = '';
  for (let i = len; i > 0; i--) {
    const mod = now % 32;
    str = ENCODING[mod] + str;
    now = Math.floor(now / 32);
  }
  return str;
}

function encodeRandom(len: number): string {
  let str = '';
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  
  for (let i = 0; i < len; i++) {
    str += ENCODING[bytes[i] % 32];
  }
  return str;
}

/**
 * Decode ULID to get timestamp
 */
export function decodeULID(ulid: string): { timestamp: number; random: string } {
  const timePart = ulid.substring(0, TIME_LEN);
  const randomPart = ulid.substring(TIME_LEN);
  
  let timestamp = 0;
  for (let i = 0; i < TIME_LEN; i++) {
    const char = timePart[i];
    const value = ENCODING.indexOf(char);
    timestamp = timestamp * 32 + value;
  }
  
  return { timestamp, random: randomPart };
}

/**
 * Check if string is valid ULID
 */
export function isValidULID(str: string): boolean {
  if (str.length !== TIME_LEN + RANDOM_LEN) return false;
  
  for (const char of str) {
    if (!ENCODING.includes(char)) return false;
  }
  
  return true;
}
