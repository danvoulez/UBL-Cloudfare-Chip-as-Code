
export type JobStatus = 'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'canceled';

export type Job = {
  id: string;
  title: string;
  kind: string;         // e.g., 'media/transcode', 'embed/index', 'llm/generate'
  createdAt: number;
  updatedAt: number;
  status: JobStatus;
  progress?: number;    // 0..100
  error?: string | null;
  payload?: Record<string, any>;
  meta?: Record<string, any>;
};

export const canStart = (s: JobStatus) => s === 'queued' || s === 'paused' || s === 'failed';
export const canPause = (s: JobStatus) => s === 'running';
export const canCancel = (s: JobStatus) => s === 'queued' || s === 'running' || s === 'paused';
export const isTerminal = (s: JobStatus) => s === 'completed' || s === 'failed' || s === 'canceled';
