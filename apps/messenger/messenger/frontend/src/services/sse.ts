/**
 * SSE (Server-Sent Events) Client
 * Subscribes to Gateway delta stream for real-time updates
 */

export type SSEEventType = 
  | 'hello'
  | 'timeline.append'
  | 'job.update'
  | 'presence.update'
  | 'conversation.update'
  | 'heartbeat'
  | 'error';

export interface SSEEvent {
  type: SSEEventType;
  data: any;
  cursor?: string;
}

export type SSEEventHandler = (event: SSEEvent) => void;

export class SSEClient {
  private eventSource: EventSource | null = null;
  private handlers: Map<SSEEventType, SSEEventHandler[]> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private currentCursor: string = '0:0';

  constructor(
    private baseUrl: string,
    private tenantId: string = 'default'
  ) {}

  /**
   * Subscribe to SSE stream
   */
  connect(cursor?: string): void {
    if (this.eventSource) {
      this.disconnect();
    }

    const url = `${this.baseUrl}/v1/stream?tenant_id=${this.tenantId}${cursor ? `&cursor=${cursor}` : ''}`;
    this.eventSource = new EventSource(url);

    this.eventSource.onopen = () => {
      console.log('✅ SSE connected');
      this.reconnectAttempts = 0;
    };

    this.eventSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        this.handleEvent(data.type || 'message', data);
      } catch (err) {
        console.error('Failed to parse SSE message:', err);
      }
    };

    this.eventSource.addEventListener('hello', (e: any) => {
      const data = JSON.parse(e.data);
      this.currentCursor = data.cursor || '0:0';
      this.handleEvent('hello', data);
    });

    this.eventSource.addEventListener('timeline.append', (e: any) => {
      const data = JSON.parse(e.data);
      this.handleEvent('timeline.append', data);
    });

    this.eventSource.addEventListener('job.update', (e: any) => {
      const data = JSON.parse(e.data);
      this.handleEvent('job.update', data);
    });

    this.eventSource.addEventListener('presence.update', (e: any) => {
      const data = JSON.parse(e.data);
      this.handleEvent('presence.update', data);
    });

    this.eventSource.addEventListener('conversation.update', (e: any) => {
      const data = JSON.parse(e.data);
      this.handleEvent('conversation.update', data);
    });

    this.eventSource.addEventListener('heartbeat', () => {
      this.handleEvent('heartbeat', {});
    });

    this.eventSource.addEventListener('error', (e: any) => {
      const data = JSON.parse(e.data);
      this.handleEvent('error', data);
    });

    this.eventSource.onerror = () => {
      console.error('SSE connection error');
      this.eventSource?.close();
      this.reconnect();
    };
  }

  /**
   * Disconnect from SSE stream
   */
  disconnect(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  /**
   * Register event handler
   */
  on(eventType: SSEEventType, handler: SSEEventHandler): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);
  }

  /**
   * Remove event handler
   */
  off(eventType: SSEEventType, handler: SSEEventHandler): void {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Get current cursor for reconnection
   */
  getCursor(): string {
    return this.currentCursor;
  }

  private handleEvent(type: SSEEventType, data: any): void {
    const handlers = this.handlers.get(type);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler({ type, data, cursor: this.currentCursor });
        } catch (err) {
          console.error(`Error in SSE handler for ${type}:`, err);
        }
      });
    }
  }

  private reconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    setTimeout(() => {
      console.log(`Reconnecting SSE (attempt ${this.reconnectAttempts})...`);
      this.connect(this.currentCursor);
    }, delay);
  }
}

