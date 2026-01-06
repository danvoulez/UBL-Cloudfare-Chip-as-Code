/**
 * useJobs Hook
 * React hook for managing jobs with real-time updates
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Job, JobStatus } from '../types';
import { 
  jobsApi, 
  JobUpdateEvent, 
  CreateJobRequest,
  subscribeToJobUpdates 
} from '../services/jobsApi';

interface UseJobsOptions {
  conversationId?: string;
  autoConnect?: boolean;
}

interface UseJobsResult {
  jobs: Job[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  createJob: (request: CreateJobRequest) => Promise<Job>;
  approveJob: (jobId: string) => Promise<void>;
  rejectJob: (jobId: string, reason?: string) => Promise<void>;
  cancelJob: (jobId: string) => Promise<void>;
}

export function useJobs(options: UseJobsOptions = {}): UseJobsResult {
  const { conversationId, autoConnect = true } = options;
  
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const conversationIdRef = useRef(conversationId);
  conversationIdRef.current = conversationId;

  // Fetch jobs
  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await jobsApi.list({
        conversationId: conversationIdRef.current,
        limit: 100
      });
      
      setJobs(response.jobs);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle real-time job updates
  const handleJobUpdate = useCallback((event: JobUpdateEvent) => {
    setJobs(prevJobs => {
      const index = prevJobs.findIndex(j => j.id === event.job_id);
      
      if (index === -1) {
        // New job - add to list if it matches our filter
        if (event.type === 'job_created' && event.data) {
          const newJob = event.data as Job;
          if (!conversationIdRef.current || newJob.conversationId === conversationIdRef.current) {
            return [newJob, ...prevJobs];
          }
        }
        return prevJobs;
      }
      
      // Update existing job
      const updated = [...prevJobs];
      updated[index] = { ...updated[index], ...event.data };
      return updated;
    });
  }, []);

  // Initial load and WebSocket subscription
  useEffect(() => {
    refresh();
    
    if (autoConnect) {
      const unsubscribe = subscribeToJobUpdates(handleJobUpdate);
      return unsubscribe;
    }
  }, [refresh, autoConnect, handleJobUpdate]);

  // Re-fetch when conversation changes
  useEffect(() => {
    refresh();
  }, [conversationId, refresh]);

  // Actions
  const createJob = useCallback(async (request: CreateJobRequest): Promise<Job> => {
    const job = await jobsApi.create(request);
    setJobs(prev => [job, ...prev]);
    return job;
  }, []);

  const approveJob = useCallback(async (jobId: string): Promise<void> => {
    const updated = await jobsApi.approve(jobId);
    setJobs(prev => prev.map(j => j.id === jobId ? updated : j));
  }, []);

  const rejectJob = useCallback(async (jobId: string, reason?: string): Promise<void> => {
    const updated = await jobsApi.reject(jobId, reason);
    setJobs(prev => prev.map(j => j.id === jobId ? updated : j));
  }, []);

  const cancelJob = useCallback(async (jobId: string): Promise<void> => {
    const updated = await jobsApi.cancel(jobId);
    setJobs(prev => prev.map(j => j.id === jobId ? updated : j));
  }, []);

  return {
    jobs,
    loading,
    error,
    refresh,
    createJob,
    approveJob,
    rejectJob,
    cancelJob
  };
}

// Single job hook
export function useJob(jobId: string | null): {
  job: Job | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
} {
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(!!jobId);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!jobId) {
      setJob(null);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      const data = await jobsApi.get(jobId);
      setJob(data);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Subscribe to updates for this specific job
  useEffect(() => {
    if (!jobId) return;
    
    const unsubscribe = subscribeToJobUpdates((event) => {
      if (event.job_id === jobId && event.data) {
        setJob(prev => prev ? { ...prev, ...event.data } : null);
      }
    });
    
    return unsubscribe;
  }, [jobId]);

  return { job, loading, error, refresh };
}

export default useJobs;

