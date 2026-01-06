
import { bus } from '../lib/eventBus';
import type { Job, JobStatus } from '../types/job';

export type JobsAdapter = {
  list(): Promise<Job[]>;
  get(id: string): Promise<Job | undefined>;
  enqueue(input: Partial<Job> & { title: string; kind: string; payload?: any }): Promise<Job>;
  start(id: string): Promise<Job | undefined>;
  pause(id: string): Promise<Job | undefined>;
  cancel(id: string): Promise<Job | undefined>;
  remove(id: string): Promise<boolean>;
  subscribe(handler: (jobs: Job[] | { id: string; patch: Partial<Job> }) => void): () => void;
};

// Memory adapter (reference impl); can be replaced by HTTP/WS version
export function createMemoryJobsAdapter(seed: Job[] = []): JobsAdapter {
  let jobs = [...seed];
  const topic = 'jobs:patch';
  const emitFull = () => bus.emit(topic, jobs.map(j => ({...j})));
  const emitPatch = (id: string, patch: Partial<Job>) => bus.emit(topic, { id, patch });
  const find = (id: string) => jobs.find(j => j.id === id);
  const now = () => Date.now();
  const up = (id: string, patch: Partial<Job>) => {
    const j = find(id);
    if (!j) return;
    Object.assign(j, patch, { updatedAt: now() });
    emitPatch(id, patch);
  };

  function mkId() { return Math.random().toString(36).slice(2, 10); }

  // Simulate progress tick for running jobs
  const tick = () => {
    let changed = false;
    for (const j of jobs) {
      if (j.status === 'running') {
        const next = Math.min(100, (j.progress ?? 0) + Math.ceil(Math.random()*7));
        if (next !== j.progress) {
          j.progress = next;
          j.updatedAt = now();
          changed = true;
          bus.emit(topic, { id: j.id, patch: { progress: next } });
          if (next >= 100) {
            j.status = 'completed';
            j.updatedAt = now();
            bus.emit(topic, { id: j.id, patch: { status: 'completed' } });
          }
        }
      }
    }
    if (changed) { /* noop */ }
  };
  const interval = setInterval(tick, 1200);

  return {
    async list() {
      return jobs.map(j => ({...j}));
    },
    async get(id) { return find(id); },
    async enqueue(input) {
      const j: Job = {
        id: mkId(),
        title: input.title,
        kind: input.kind,
        createdAt: now(),
        updatedAt: now(),
        status: 'queued',
        progress: 0,
        payload: input.payload ?? {},
        error: null,
        meta: input.meta ?? {}
      };
      jobs.unshift(j);
      emitFull();
      return j;
    },
    async start(id) {
      const j = find(id); if (!j) return;
      j.status = 'running'; j.error = null; j.updatedAt = now();
      emitPatch(id, { status: 'running', error: null });
      return j;
    },
    async pause(id) {
      const j = find(id); if (!j) return;
      j.status = 'paused'; j.updatedAt = now();
      emitPatch(id, { status: 'paused' });
      return j;
    },
    async cancel(id) {
      const j = find(id); if (!j) return;
      j.status = 'canceled'; j.updatedAt = now();
      emitPatch(id, { status: 'canceled' });
      return j;
    },
    async remove(id) {
      const ix = jobs.findIndex(j => j.id === id);
      if (ix === -1) return false;
      jobs.splice(ix, 1);
      emitFull();
      return true;
    },
    subscribe(handler) {
      const off = bus.on(topic, handler as any);
      // Prime with current snapshot
      handler(jobs.map(j => ({...j})));
      return () => off();
    }
  };
}
