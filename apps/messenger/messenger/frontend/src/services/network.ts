/**
 * Network Service
 * Handles network requests with retry logic and error handling
 */

export class NetworkService {
  private static retryCount = 3;
  private static retryDelay = 1000;

  static async execute<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < this.retryCount; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on auth errors
        if ((error as any).message?.includes('401') || (error as any).message?.includes('403')) {
          throw error;
        }
        
        // Wait before retrying
        if (attempt < this.retryCount - 1) {
          await new Promise(resolve => setTimeout(resolve, this.retryDelay * (attempt + 1)));
        }
      }
    }
    
    throw lastError || new Error('Network request failed');
  }
}
