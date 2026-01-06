// bindings.ts
// TypeScript bindings for Cloudflare Workers environment

export interface Env {
  // D1 Database
  OFFICE_DB: D1Database;
  
  // Vectorize Index
  OFFICE_VECTORS?: VectorizeIndex;
  
  // AI Binding
  AI?: Ai;
  
  // Durable Objects
  OFFICE_SESSION?: DurableObjectNamespace;
  
  // KV Namespaces
  OFFICE_FLAGS?: KVNamespace;
  OFFICE_CACHE?: KVNamespace;
  
  // R2 Buckets
  OFFICE_BLOB?: R2Bucket;
  
  // Secrets
  RECEIPT_PRIVATE_KEY?: string; // PEM (Ed25519)
  RECEIPT_HMAC_KEY?: string;    // base64
  
  // Configuration
  TOPK_DEFAULT?: number;
  EVIDENCE_MODE_DEFAULT?: string;
  
  // Environment
  ENVIRONMENT?: 'development' | 'staging' | 'production';
}
