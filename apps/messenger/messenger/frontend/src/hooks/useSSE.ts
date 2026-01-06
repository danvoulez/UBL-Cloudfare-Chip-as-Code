/**
 * useSSE Hook
 * React hook for SSE subscription
 */

import { useEffect, useRef } from 'react';
import { SSEClient, SSEEvent, SSEEventHandler } from '../services/sse';
import { getBaseUrl } from '../services/apiClient';

export function useSSE(
  tenantId: string = 'default',
  handlers: Partial<Record<string, SSEEventHandler>> = {}
) {
  const clientRef = useRef<SSEClient | null>(null);

  useEffect(() => {
    const baseUrl = getBaseUrl();
    const client = new SSEClient(baseUrl, tenantId);

    // Register handlers
    Object.entries(handlers).forEach(([eventType, handler]) => {
      if (handler) {
        client.on(eventType as any, handler);
      }
    });

    // Connect
    client.connect();

    clientRef.current = client;

    // Cleanup
    return () => {
      client.disconnect();
    };
  }, [tenantId, JSON.stringify(Object.keys(handlers))]);

  return {
    client: clientRef.current,
    getCursor: () => clientRef.current?.getCursor() || '0:0',
  };
}

