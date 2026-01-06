/**
 * Jobs API Service
 * Handles all job-related API calls to the Messenger backend
 */

import { api } from './apiClient';
import { Job, JobStatus, ApprovalRequest } from '../types';

// ============================================
// TYPES
// ============================================

export interface CreateJobRequest {
  conversation_id: string;
  title: string;
  description?: string;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  estimated_duration?: string;
}

export interface JobListResponse {
  jobs: Job[];
  total: number;
  page: number;
  limit: number;
}

export interface JobUpdateEvent {
  type: 'job_created' | 'job_updated' | 'job_completed' | 'job_failed' | 'approval_required';
  job_id: string;
  data: Partial<Job>;
}

// Backend WsEvent types (from Rust backend)
interface WsJobUpdate {
  type: 'JobUpdate';
  payload: {
    job_id: string;
    status: string;
    progress: number;
    current_step: string | null;
  };
}

interface WsJobComplete {
  type: 'JobComplete';
  payload: {
    job_id: string;
    summary: string;
    artifact_count: number;
  };
}

interface WsApprovalNeeded {
  type: 'ApprovalNeeded';
  payload: {
    job_id: string;
    action: string;
    reason: string;
  };
}

interface WsConnected {
  type: 'Connected';
  payload: {
    session_id: string;
  };
}

type WsEvent = WsJobUpdate | WsJobComplete | WsApprovalNeeded | WsConnected | { type: 'Ping' } | { type: 'Pong' };

// ============================================
// API CALLS
// ============================================

/**
 * Create a new job
 */
export async function createJob(request: CreateJobRequest): Promise<Job> {
  return api.post<Job>('/api/jobs', request);
}

/**
 * Get a specific job by ID
 */
export async function getJob(jobId: string): Promise<Job> {
  return api.get<Job>(`/api/jobs/${jobId}`);
}

/**
 * List jobs, optionally filtered by conversation
 */
export async function listJobs(params?: {
  conversationId?: string;
  status?: JobStatus;
  page?: number;
  limit?: number;
}): Promise<JobListResponse> {
  const searchParams = new URLSearchParams();
  
  if (params?.conversationId) {
    searchParams.set('conversation_id', params.conversationId);
  }
  if (params?.status) {
    searchParams.set('status', params.status);
  }
  if (params?.page) {
    searchParams.set('page', params.page.toString());
  }
  if (params?.limit) {
    searchParams.set('limit', params.limit.toString());
  }
  
  const query = searchParams.toString();
  return api.get<JobListResponse>(`/api/jobs${query ? `?${query}` : ''}`);
}

/**
 * Approve a job and trigger execution
 */
export async function approveJob(jobId: string): Promise<Job> {
  return api.post<Job>(`/api/jobs/${jobId}/approve`);
}

/**
 * Reject a job
 */
export async function rejectJob(jobId: string, reason?: string): Promise<Job> {
  return api.post<Job>(`/api/jobs/${jobId}/reject`, { reason });
}

/**
 * Cancel a running job
 */
export async function cancelJob(jobId: string): Promise<Job> {
  return api.post<Job>(`/api/jobs/${jobId}/cancel`);
}

/**
 * Get pending approvals for a job
 */
export async function getPendingApprovals(jobId: string): Promise<ApprovalRequest[]> {
  return api.get<ApprovalRequest[]>(`/api/jobs/${jobId}/approvals`);
}

/**
 * Respond to an approval request
 */
export async function respondToApproval(
  jobId: string,
  approvalId: string,
  decision: 'approve' | 'reject',
  comment?: string
): Promise<void> {
  return api.post(`/api/jobs/${jobId}/approvals/${approvalId}`, {
    decision,
    comment
  });
}

// ============================================
// WEBSOCKET SUBSCRIPTION
// ============================================

type JobEventHandler = (event: JobUpdateEvent) => void;

let ws: WebSocket | null = null;
let handlers: Set<JobEventHandler> = new Set();
let reconnectTimeout: number | null = null;

/**
 * Get WebSocket URL from current location
 */
function getWebSocketUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  
  // Check for explicit backend URL
  const envBase = (import.meta as any).env?.VITE_API_BASE_URL as string | undefined;
  if (envBase) {
    try {
      const url = new URL(envBase);
      const wsProtocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${wsProtocol}//${url.host}/ws`;
    } catch {
      // fall through
    }
  }
  
  return `${protocol}//${host}/ws`;
}

/**
 * Connect to WebSocket for real-time job updates
 */
export function connectJobUpdates(): void {
  if (ws && ws.readyState === WebSocket.OPEN) {
    return; // Already connected
  }
  
  const url = getWebSocketUrl();
  
  try {
    ws = new WebSocket(url);
    
    ws.onopen = () => {
      console.log('[Jobs] WebSocket connected');
      // Clear any pending reconnect
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
    };
    
    ws.onmessage = (event) => {
      try {
        const wsEvent = JSON.parse(event.data) as WsEvent;
        
        // Transform WsEvent to JobUpdateEvent for hook consumers
        let jobEvent: JobUpdateEvent | null = null;
        
        switch (wsEvent.type) {
          case 'JobUpdate':
            jobEvent = {
              type: 'job_updated',
              job_id: wsEvent.payload.job_id,
              data: {
                status: wsEvent.payload.status as any,
                progress: wsEvent.payload.progress,
                currentStep: wsEvent.payload.current_step || undefined,
              }
            };
            break;
            
          case 'JobComplete':
            jobEvent = {
              type: 'job_completed',
              job_id: wsEvent.payload.job_id,
              data: {
                status: 'completed',
                result: {
                  summary: wsEvent.payload.summary,
                  artifacts: [], // Will be fetched on refresh
                }
              }
            };
            break;
            
          case 'ApprovalNeeded':
            jobEvent = {
              type: 'approval_required',
              job_id: wsEvent.payload.job_id,
              data: {
                status: 'awaiting_approval',
              }
            };
            break;
            
          case 'Connected':
            console.log('[Jobs] Server confirmed session:', wsEvent.payload.session_id);
            return;
            
          case 'Ping':
            // Respond with pong
            ws?.send(JSON.stringify({ type: 'Pong' }));
            return;
            
          case 'Pong':
            return;
        }
        
        if (jobEvent) {
          handlers.forEach(handler => handler(jobEvent!));
        }
      } catch (e) {
        console.error('[Jobs] Failed to parse WebSocket message:', e);
      }
    };
    
    ws.onclose = () => {
      console.log('[Jobs] WebSocket closed');
      ws = null;
      
      // Reconnect after delay
      if (handlers.size > 0) {
        reconnectTimeout = window.setTimeout(() => {
          console.log('[Jobs] Attempting to reconnect...');
          connectJobUpdates();
        }, 3000);
      }
    };
    
    ws.onerror = (error) => {
      console.error('[Jobs] WebSocket error:', error);
    };
  } catch (e) {
    console.error('[Jobs] Failed to create WebSocket:', e);
  }
}

/**
 * Disconnect WebSocket
 */
export function disconnectJobUpdates(): void {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  
  if (ws) {
    ws.close();
    ws = null;
  }
}

/**
 * Subscribe to job update events
 */
export function subscribeToJobUpdates(handler: JobEventHandler): () => void {
  handlers.add(handler);
  
  // Connect if not already connected
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    connectJobUpdates();
  }
  
  // Return unsubscribe function
  return () => {
    handlers.delete(handler);
    
    // Disconnect if no more handlers
    if (handlers.size === 0) {
      disconnectJobUpdates();
    }
  };
}

// ============================================
// EXPORT
// ============================================

export const jobsApi = {
  create: createJob,
  get: getJob,
  list: listJobs,
  approve: approveJob,
  reject: rejectJob,
  cancel: cancelJob,
  getPendingApprovals,
  respondToApproval,
  subscribe: subscribeToJobUpdates,
  connect: connectJobUpdates,
  disconnect: disconnectJobUpdates
};

export default jobsApi;

