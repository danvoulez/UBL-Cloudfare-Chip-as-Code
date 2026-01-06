
import React from 'react';
import type { JobsAdapter } from '../services/jobsAdapter';
import { useJobs } from '../hooks/useJobs';
import { JobCard } from './JobCard';

export function JobBoard({ adapter }: { adapter: JobsAdapter }) {
  const { items, loading, error, enqueue, start, pause, cancel, remove } = useJobs(adapter);
  const [filter, setFilter] = React.useState<'all'|'active'|'done'>('all');

  const filtered = React.useMemo(() => {
    if (filter === 'all') return items;
    if (filter === 'active') return items.filter(j => ['queued','running','paused'].includes(j.status));
    return items.filter(j => ['completed','failed','canceled'].includes(j.status));
  }, [items, filter]);

  return (
    <div className="flex h-full flex-col gap-3 p-3 md:p-4">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">Jobs</h2>
        <div className="ml-auto flex items-center gap-2">
          <FilterTab label="All" active={filter==='all'} onClick={() => setFilter('all')} />
          <FilterTab label="Active" active={filter==='active'} onClick={() => setFilter('active')} />
          <FilterTab label="Done" active={filter==='done'} onClick={() => setFilter('done')} />
          <button
            className="ml-2 inline-flex items-center rounded-xl bg-zinc-900 text-white border border-zinc-900 px-3 py-1.5 text-xs font-medium active:scale-[.98]"
            onClick={() => enqueue({ title: 'Demo job', kind: 'llm/generate', payload: { prompt: 'Hello' } })}
          >
            + New
          </button>
        </div>
      </div>
      {loading && <div className="text-sm text-zinc-500">Loading…</div>}
      {error && <div className="text-sm text-rose-700">⚠ {error}</div>}
      <div className="grid grid-cols-1 gap-3">
        {filtered.map(job => (
          <JobCard
            key={job.id}
            job={job}
            onStart={(id) => start(id)}
            onPause={(id) => pause(id)}
            onCancel={(id) => cancel(id)}
            onRemove={(id) => remove(id)}
          />
        ))}
        {!filtered.length && !loading && (
          <div className="rounded-xl border border-dashed p-6 text-sm text-zinc-500">No jobs yet.</div>
        )}
      </div>
    </div>
  );
}

function FilterTab({ label, active, onClick }:{label:string; active?:boolean; onClick:()=>void}) {
  const base = "text-xs rounded-xl border px-2.5 py-1 font-medium transition";
  const on  = "bg-zinc-900 text-white border-zinc-900";
  const off = "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50";
  return <button className={`${base} ${active?on:off}`} onClick={onClick}>{label}</button>;
}
