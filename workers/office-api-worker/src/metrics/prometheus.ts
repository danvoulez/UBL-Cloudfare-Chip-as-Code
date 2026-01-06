// metrics/prometheus.ts
// Prometheus metrics collection

export interface Metric {
  name: string;
  value: number;
  labels?: Record<string, string>;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
}

export class MetricsCollector {
  private metrics: Metric[] = [];
  
  /**
   * Increment counter
   */
  increment(name: string, labels?: Record<string, string>): void {
    this.metrics.push({
      name,
      value: 1,
      labels,
      type: 'counter'
    });
  }
  
  /**
   * Set gauge value
   */
  gauge(name: string, value: number, labels?: Record<string, string>): void {
    this.metrics.push({
      name,
      value,
      labels,
      type: 'gauge'
    });
  }
  
  /**
   * Record histogram value
   */
  histogram(name: string, value: number, labels?: Record<string, string>): void {
    this.metrics.push({
      name,
      value,
      labels,
      type: 'histogram'
    });
  }
  
  /**
   * Export metrics in Prometheus format
   */
  export(): string {
    const lines: string[] = [];
    const grouped = this.groupByType();
    
    for (const [type, metrics] of Object.entries(grouped)) {
      for (const metric of metrics) {
        const labelStr = metric.labels
          ? '{' + Object.entries(metric.labels).map(([k, v]) => `${k}="${v}"`).join(',') + '}'
          : '';
        lines.push(`${metric.name}${labelStr} ${metric.value}`);
      }
    }
    
    return lines.join('\n') + '\n';
  }
  
  /**
   * Clear all metrics
   */
  clear(): void {
    this.metrics = [];
  }
  
  private groupByType(): Record<string, Metric[]> {
    const grouped: Record<string, Metric[]> = {};
    for (const metric of this.metrics) {
      if (!grouped[metric.type]) {
        grouped[metric.type] = [];
      }
      grouped[metric.type].push(metric);
    }
    return grouped;
  }
}

// Global metrics collector instance
export const metrics = new MetricsCollector();

/**
 * Common metric names
 */
export const MetricNames = {
  // Request metrics
  REQUESTS_TOTAL: 'office_requests_total',
  REQUEST_DURATION: 'office_request_duration_seconds',
  REQUEST_ERRORS: 'office_request_errors_total',
  
  // Entity metrics
  ENTITIES_ACTIVE: 'office_entities_active',
  SESSIONS_TOTAL: 'office_sessions_total',
  
  // Token metrics
  TOKENS_CONSUMED: 'office_tokens_consumed_total',
  TOKEN_BUDGET_REMAINING: 'office_token_budget_remaining',
  
  // File metrics
  FILES_INDEXED: 'office_files_indexed_total',
  ANCHORS_EXTRACTED: 'office_anchors_extracted_total',
  
  // Handover metrics
  HANDOVERS_CREATED: 'office_handovers_created_total',
  
  // Evidence metrics
  EVIDENCE_QUERIES: 'office_evidence_queries_total',
  
  // Version graph metrics
  VERSION_GRAPHS_COMPUTED: 'office_version_graphs_computed_total'
} as const;
