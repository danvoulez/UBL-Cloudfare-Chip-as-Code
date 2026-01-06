// core/r2.ts
// R2 Bucket wrapper utilities

export interface R2PutOptions {
  httpMetadata?: {
    contentType?: string;
    contentEncoding?: string;
    cacheControl?: string;
  };
  customMetadata?: Record<string, string>;
}

/**
 * Get object from R2
 */
export async function r2Get(env: any, bucket: string, key: string): Promise<R2ObjectBody | null> {
  const r2 = env[bucket] as R2Bucket;
  if (!r2) throw new Error(`R2 bucket ${bucket} not found`);
  
  return await r2.get(key);
}

/**
 * Put object in R2
 */
export async function r2Put(
  env: any,
  bucket: string,
  key: string,
  value: ReadableStream | ArrayBuffer | ArrayBufferView | string,
  options?: R2PutOptions
): Promise<void> {
  const r2 = env[bucket] as R2Bucket;
  if (!r2) throw new Error(`R2 bucket ${bucket} not found`);
  
  await r2.put(key, value, options);
}

/**
 * Delete object from R2
 */
export async function r2Delete(env: any, bucket: string, key: string): Promise<void> {
  const r2 = env[bucket] as R2Bucket;
  if (!r2) throw new Error(`R2 bucket ${bucket} not found`);
  
  await r2.delete(key);
}

/**
 * List objects in R2
 */
export async function r2List(
  env: any,
  bucket: string,
  options?: { prefix?: string; limit?: number; cursor?: string }
): Promise<{ objects: R2Object[]; truncated: boolean; cursor?: string }> {
  const r2 = env[bucket] as R2Bucket;
  if (!r2) throw new Error(`R2 bucket ${bucket} not found`);
  
  const result = await r2.list(options);
  return {
    objects: result.objects,
    truncated: result.truncated,
    cursor: result.cursor || undefined
  };
}

/**
 * Head object metadata from R2
 */
export async function r2Head(env: any, bucket: string, key: string): Promise<R2Object | null> {
  const r2 = env[bucket] as R2Bucket;
  if (!r2) throw new Error(`R2 bucket ${bucket} not found`);
  
  return await r2.head(key);
}
