/**
 * # Frontend Metrics
 * 
 * Client-side metrics collection for Messenger frontend.
 * Sends metrics to backend /metrics endpoint or analytics service.
 */

interface Metric {
  name: string;
  value: number;
  labels?: Record<string, string>;
  timestamp: number;
}

class MetricsCollector {
  private metrics: Metric[] = [];
  private flushInterval: number = 30000; // 30 seconds
  private intervalId?: number;

  constructor() {
    this.start();
  }

  /**
   * Record a counter metric
   */
  counter(name: string, value: number = 1, labels?: Record<string, string>): void {
    this.metrics.push({
      name: `messenger_${name}_total`,
      value,
      labels,
      timestamp: Date.now(),
    });
  }

  /**
   * Record a gauge metric
   */
  gauge(name: string, value: number, labels?: Record<string, string>): void {
    this.metrics.push({
      name: `messenger_${name}`,
      value,
      labels,
      timestamp: Date.now(),
    });
  }

  /**
   * Record a histogram metric (duration in milliseconds)
   */
  histogram(name: string, value: number, labels?: Record<string, string>): void {
    this.metrics.push({
      name: `messenger_${name}_duration_ms`,
      value,
      labels,
      timestamp: Date.now(),
    });
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
   * Flush metrics to backend
   */
  async flush(): Promise<void> {
    if (this.metrics.length === 0) return;

    const metricsToSend = [...this.metrics];
    this.metrics = [];

    try {
      const baseUrl = localStorage.getItem('ubl_api_base_url') || 
                     import.meta.env.VITE_API_BASE_URL || 
                     'http://localhost:8080';
      
      await fetch(`${baseUrl}/metrics/frontend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ metrics: metricsToSend }),
        keepalive: true, // Send even if page is unloading
      });
    } catch (error) {
      console.warn('Failed to send metrics:', error);
      // Re-add metrics to queue if send failed
      this.metrics.unshift(...metricsToSend);
    }
  }

  /**
   * Flush metrics on page unload
   */
  flushOnUnload(): void {
    if ('sendBeacon' in navigator) {
      const data = JSON.stringify({ metrics: this.metrics });
      navigator.sendBeacon(
        `${localStorage.getItem('ubl_api_base_url') || 'http://localhost:8080'}/metrics/frontend`,
        data
      );
    } else {
      this.flush();
    }
  }
}

// Singleton instance
export const metrics = new MetricsCollector();

// Flush on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    metrics.flushOnUnload();
  });
}

// Predefined metric helpers
export const frontendMetrics = {
  /**
   * Record message sent
   */
  messageSent(conversationId: string, success: boolean): void {
    metrics.counter('messages_sent', 1, {
      conversation_id: conversationId,
      status: success ? 'success' : 'error',
    });
  },

  /**
   * Record message received
   */
  messageReceived(conversationId: string): void {
    metrics.counter('messages_received', 1, {
      conversation_id: conversationId,
    });
  },

  /**
   * Record job action
   */
  jobAction(action: string, jobId: string, success: boolean): void {
    metrics.counter('job_actions', 1, {
      action,
      job_id: jobId,
      status: success ? 'success' : 'error',
    });
  },

  /**
   * Record page view
   */
  pageView(page: string): void {
    metrics.counter('page_views', 1, { page });
  },

  /**
   * Record API call duration
   */
  apiCallDuration(endpoint: string, duration: number, success: boolean): void {
    metrics.histogram('api_call', duration, {
      endpoint,
      status: success ? 'success' : 'error',
    });
  },

  /**
   * Record SSE connection status
   */
  sseConnection(connected: boolean): void {
    metrics.gauge('sse_connected', connected ? 1 : 0);
  },

  /**
   * Record active conversations count
   */
  activeConversations(count: number): void {
    metrics.gauge('active_conversations', count);
  },
};

