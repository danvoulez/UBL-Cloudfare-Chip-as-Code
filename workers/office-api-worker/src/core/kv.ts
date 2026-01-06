// core/kv.ts
// KV Namespace wrapper utilities

export interface KVOptions {
  expirationTtl?: number;
  expiration?: number;
  metadata?: Record<string, any>;
}

/**
 * Get value from KV
 */
export async function kvGet(env: any, namespace: string, key: string): Promise<any> {
  const kv = env[namespace] as KVNamespace;
  if (!kv) throw new Error(`KV namespace ${namespace} not found`);
  
  const value = await kv.get(key);
  if (!value) return null;
  
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

/**
 * Put value in KV
 */
export async function kvPut(
  env: any,
  namespace: string,
  key: string,
  value: any,
  options?: KVOptions
): Promise<void> {
  const kv = env[namespace] as KVNamespace;
  if (!kv) throw new Error(`KV namespace ${namespace} not found`);
  
  const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
  
  await kv.put(key, stringValue, options);
}

/**
 * Delete value from KV
 */
export async function kvDelete(env: any, namespace: string, key: string): Promise<void> {
  const kv = env[namespace] as KVNamespace;
  if (!kv) throw new Error(`KV namespace ${namespace} not found`);
  
  await kv.delete(key);
}

/**
 * List keys in KV
 */
export async function kvList(
  env: any,
  namespace: string,
  options?: { prefix?: string; limit?: number; cursor?: string }
): Promise<{ keys: string[]; cursor?: string }> {
  const kv = env[namespace] as KVNamespace;
  if (!kv) throw new Error(`KV namespace ${namespace} not found`);
  
  const result = await kv.list(options);
  return {
    keys: result.keys.map(k => k.name),
    cursor: result.cursor || undefined
  };
}
