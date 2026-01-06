
import * as React from 'react';
import type { JobsAdapter } from '../services/jobsAdapter';
import type { Job } from '../types/job';

type State = { items: Job[]; loading: boolean; error?: string };
type Action =
  | { type: 'prime'; items: Job[] }
  | { type: 'patch'; id: string; patch: Partial<Job> }
  | { type: 'loading' }
  | { type: 'error'; error: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'prime':
      return { items: action.items, loading: false };
    case 'patch':
      return {
        ...state,
        items: state.items.map(j => (j.id === action.id ? { ...j, ...action.patch } : j))
      };
    case 'loading': return { ...state, loading: true };
    case 'error': return { ...state, loading: false, error: action.error };
  }
}

export function useJobs(adapter: JobsAdapter) {
  const [state, dispatch] = React.useReducer(reducer, { items: [], loading: true });

  React.useEffect(() => {
    let mounted = true;
    dispatch({ type: 'loading' });
    const off = adapter.subscribe((payload) => {
      if (!mounted) return;
      if (Array.isArray(payload)) {
        dispatch({ type: 'prime', items: payload });
      } else if (payload && typeof payload === 'object' && 'id' in payload) {
        dispatch({ type: 'patch', id: payload.id as string, patch: payload.patch as Partial<Job> });
      }
    });
    return () => { mounted = false; off(); };
  }, [adapter]);

  return {
    ...state,
    enqueue: adapter.enqueue,
    start: adapter.start,
    pause: adapter.pause,
    cancel: adapter.cancel,
    remove: adapter.remove,
  };
}
