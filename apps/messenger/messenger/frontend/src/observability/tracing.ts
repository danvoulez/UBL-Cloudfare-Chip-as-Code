/**
 * # Frontend Distributed Tracing
 * 
 * OpenTelemetry-compatible tracing for Messenger frontend.
 * Sends traces to backend /tracing endpoint or OTLP collector.
 */

interface Span {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  startTime: number;
  endTime?: number;
  attributes?: Record<string, string | number | boolean>;
  events?: Array<{ name: string; time: number; attributes?: Record<string, string> }>;
  status?: 'ok' | 'error';
  statusMessage?: string;
}

class Tracer {
  private spans: Map<string, Span> = new Map();
  private currentTraceId?: string;
  private currentSpanId?: string;
  private flushInterval: number = 10000; // 10 seconds
  private intervalId?: number;

  constructor() {
    this.start();
  }

  /**
   * Generate a random ID for trace/span
   */
  private generateId(): string {
    return Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Start a new span
   */
  startSpan(name: string, attributes?: Record<string, string | number | boolean>): string {
    const traceId = this.currentTraceId || this.generateId();
    const spanId = this.generateId();
    
    if (!this.currentTraceId) {
      this.currentTraceId = traceId;
    }

    const span: Span = {
      traceId,
      spanId,
      parentSpanId: this.currentSpanId,
      name,
      startTime: performance.now(),
      attributes: attributes || {},
    };

    this.spans.set(spanId, span);
    this.currentSpanId = spanId;

    return spanId;
  }

  /**
   * End a span
   */
  endSpan(spanId: string, status?: 'ok' | 'error', statusMessage?: string): void {
    const span = this.spans.get(spanId);
    if (!span) return;

    span.endTime = performance.now();
    if (status) {
      span.status = status;
    }
    if (statusMessage) {
      span.statusMessage = statusMessage;
    }

    // If this was the current span, pop it
    if (this.currentSpanId === spanId) {
      this.currentSpanId = span.parentSpanId;
    }

    // If this was the root span, clear trace
    if (!span.parentSpanId) {
      this.currentTraceId = undefined;
    }
  }

  /**
   * Add event to a span
   */
  addEvent(spanId: string, eventName: string, attributes?: Record<string, string>): void {
    const span = this.spans.get(spanId);
    if (!span) return;

    if (!span.events) {
      span.events = [];
    }

    span.events.push({
      name: eventName,
      time: performance.now(),
      attributes,
    });
  }

  /**
   * Set attribute on a span
   */
  setAttribute(spanId: string, key: string, value: string | number | boolean): void {
    const span = this.spans.get(spanId);
    if (!span) return;

    if (!span.attributes) {
      span.attributes = {};
    }
    span.attributes[key] = value;
  }

  /**
   * Start automatic flushing
   */
  start(): void {
    if (this.intervalId) return;
    
    this.intervalId = window.setInterval(() => {
      this.flush();
    }, this.flushInterval);
  }

  /**
   * Stop automatic flushing
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  /**
   * Flush completed spans to backend
   */
  async flush(): Promise<void> {
    const completedSpans = Array.from(this.spans.values())
      .filter(span => span.endTime !== undefined);

    if (completedSpans.length === 0) return;

    // Remove completed spans from map
    completedSpans.forEach(span => {
      this.spans.delete(span.spanId);
    });

    try {
      const baseUrl = localStorage.getItem('ubl_api_base_url') || 
                     import.meta.env.VITE_API_BASE_URL || 
                     'http://localhost:8080';
      
      await fetch(`${baseUrl}/tracing/spans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ spans: completedSpans }),
        keepalive: true,
      });
    } catch (error) {
      console.warn('Failed to send traces:', error);
    }
  }

  /**
   * Flush on page unload
   */
  flushOnUnload(): void {
    // End all active spans
    this.spans.forEach((span, spanId) => {
      if (!span.endTime) {
        this.endSpan(spanId, 'error', 'Page unloaded');
      }
    });

    this.flush();
  }
}

// Singleton instance
export const tracer = new Tracer();

// Flush on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    tracer.flushOnUnload();
  });
}

/**
 * Trace a function execution
 */
export function trace<T>(
  name: string,
  fn: () => T | Promise<T>,
  attributes?: Record<string, string | number | boolean>
): T | Promise<T> {
  const spanId = tracer.startSpan(name, attributes);
  
  try {
    const result = fn();
    
    if (result instanceof Promise) {
      return result
        .then(value => {
          tracer.endSpan(spanId, 'ok');
          return value;
        })
        .catch(error => {
          tracer.endSpan(spanId, 'error', error.message);
          throw error;
        });
    } else {
      tracer.endSpan(spanId, 'ok');
      return result;
    }
  } catch (error: any) {
    tracer.endSpan(spanId, 'error', error?.message || 'Unknown error');
    throw error;
  }
}

/**
 * Predefined tracing helpers
 */
export const frontendTracing = {
  /**
   * Trace API call
   */
  apiCall(endpoint: string, fn: () => Promise<any>): Promise<any> {
    return trace(`api.${endpoint}`, fn, { endpoint }) as Promise<any>;
  },

  /**
   * Trace message send
   */
  messageSend(conversationId: string, fn: () => Promise<any>): Promise<any> {
    return trace('message.send', fn, { conversation_id: conversationId }) as Promise<any>;
  },

  /**
   * Trace job action
   */
  jobAction(action: string, jobId: string, fn: () => Promise<any>): Promise<any> {
    return trace(`job.${action}`, fn, { action, job_id: jobId }) as Promise<any>;
  },

  /**
   * Trace component render
   */
  componentRender(componentName: string, fn: () => void): void {
    trace(`component.${componentName}`, fn, { component: componentName });
  },
};

