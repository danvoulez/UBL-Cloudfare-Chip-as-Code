
# Messenger — Stability & Wiring Patch (v1)

This patch makes the UI more stable and **fully wireable**. It introduces:

- **Functional Job Cards** with clear states (queued/running/paused/completed/failed/canceled).
- **Wireable Jobs Adapter** so you can swap the data source (in‑memory / HTTP / WebSocket) without touching UI.
- **Event Bus** (`eventBus.ts`) used by JobBoard+JobCard and available for the rest of the app.
- **Resilient UI**: error boundary, suspense-friendly patterns, safe default CSS (no layout shifts), and consistent spacing.

## What’s included

- `src/lib/eventBus.ts` — lightweight pub/sub with typed channels.
- `src/types/job.ts` — canonical job types + helpers.
- `src/services/jobsAdapter.ts` — interface + default memory adapter.
- `src/hooks/useJobs.ts` — reducer-based state, stable updates, pluggable adapter.
- `src/components/JobCard.tsx` — fully wired card (buttons/actions/disabled states).
- `src/components/JobBoard.tsx` — list/grid with filters and bulk actions (optional).
- `src/components/ErrorBoundary.tsx` — catch UI errors.
- `src/index.patch.css` — non-intrusive tokens + small utility fixes.
- `src/wiring.example.ts` — how to connect `JobBoard` + adapter in your app.
- `contracts/job.schema.json` — JSON schema for jobs (for gateway/IPC).
- `scripts/smoke-jobs.ts` — local smoke to simulate job lifecycle via adapter.

## Quick integrate (safe, additive)

1) Copy the files into your project root, preserving paths.
2) Import the patch CSS **once** near your app entry:

```ts
import './index.patch.css';
```

3) Mount the `JobBoard` (for example inside a right panel / route):
```tsx
import React from 'react';
import { JobBoard } from './src/components/JobBoard';
import { createMemoryJobsAdapter } from './src/services/jobsAdapter';

export default function JobsPanel() {
  const adapter = React.useMemo(() => createMemoryJobsAdapter(), []);
  return <JobBoard adapter={adapter} />;
}
```

4) (Optional) Expose the adapter globally to wire from anywhere:
```ts
// e.g. src/bootstrap.ts
import { createMemoryJobsAdapter } from './src/services/jobsAdapter';
// @ts-ignore
window.__OFFICE__ = window.__OFFICE__ || {};
// @ts-ignore
window.__OFFICE__.jobs = createMemoryJobsAdapter();
```

Then from a message action or devtools console:
```js
window.__OFFICE__.jobs.enqueue({
  title: 'Transcode 1080p',
  kind: 'media/transcode',
  payload: { fileId: 'abc123', profile: '1080p' }
})
```

## Replace with your real backend

Implement `JobsAdapter` methods (`list`, `enqueue`, `start`, `pause`, `cancel`, `remove`, `subscribe`) and pass your adapter to `<JobBoard adapter={yourAdapter} />`. The UI stays the same.

## Proof-of-done

- `scripts/smoke-jobs.ts` drives job lifecycle in-memory.
- Buttons on JobCard change availability based on status.
- Job progress is persisted in adapter and propagated via event bus.
- No unmounted‑update warnings; reducer logic is idempotent.
