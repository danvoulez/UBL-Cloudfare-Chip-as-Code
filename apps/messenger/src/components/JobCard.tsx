
import React from 'react';
import type { Job } from '../types/job';
import { canStart, canPause, canCancel, isTerminal } from '../types/job';

export type JobCardProps = {
  job: Job;
  onStart?: (id: string) => void;
  onPause?: (id: string) => void;
  onCancel?: (id: string) => void;
  onRemove?: (id: string) => void;
  compact?: boolean;
};

const pillClass = (s: string) => ({
  queued:   'bg-amber-100 text-amber-800 border-amber-200',
  running:  'bg-blue-100 text-blue-800 border-blue-200',
  paused:   'bg-slate-100 text-slate-800 border-slate-200',
  completed:'bg-emerald-100 text-emerald-800 border-emerald-200',
  failed:   'bg-rose-100 text-rose-800 border-rose-200',
  canceled: 'bg-zinc-100 text-zinc-700 border-zinc-200',
} as any)[s] ?? 'bg-zinc-100 text-zinc-700 border-zinc-200';

export function JobCard(props: JobCardProps) {
  const { job, compact } = props;
  const progress = Math.max(0, Math.min(100, job.progress ?? 0));
  const disabled = {
    start: !canStart(job.status),
    pause: !canPause(job.status),
    cancel: !canCancel(job.status),
    remove: !isTerminal(job.status),
  };
  return (
    <div className={"rounded-2xl border p-3 md:p-4 shadow-sm bg-white/70 backdrop-blur " + (compact ? "text-sm" : "")}>
      <div className="flex items-start gap-3">
        <div className="size-9 shrink-0 rounded-xl bg-zinc-100 grid place-items-center">{iconFor(job.kind)}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium truncate">{job.title}</h3>
            <span className={"inline-flex items-center rounded-full border px-2 py-0.5 text-xs " + pillClass(job.status)}>
              {job.status}
            </span>
            {typeof job.progress === 'number' && job.status !== 'completed' && (
              <span className="ml-auto text-xs tabular-nums">{progress}%</span>
            )}
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-100">
            <div
              className="h-full bg-gradient-to-r from-zinc-400 to-zinc-600 transition-[width] duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          {job.error && <div className="mt-2 text-xs text-rose-700">⚠ {job.error}</div>}
          <div className="mt-3 flex items-center gap-2">
            <Action onClick={() => props.onStart?.(job.id)} disabled={disabled.start} label="Start" />
            <Action onClick={() => props.onPause?.(job.id)} disabled={disabled.pause} label="Pause" />
            <Action onClick={() => props.onCancel?.(job.id)} disabled={disabled.cancel} label="Cancel" />
            <div className="ml-auto"></div>
            <Action onClick={() => props.onRemove?.(job.id)} disabled={disabled.remove} label="Remove" subtle />
          </div>
          <div className="mt-2 text-[10px] text-zinc-500">
            <span>{job.kind}</span>
            <span className="mx-1">•</span>
            <span>updated {timeago(job.updatedAt)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Action({ label, onClick, disabled, subtle=false }:{label:string; onClick?:()=>void; disabled?:boolean; subtle?:boolean}) {
  const base = "inline-flex items-center rounded-xl px-3 py-1.5 text-xs font-medium border transition active:scale-[.98]";
  const solid = "bg-zinc-900 text-white border-zinc-900 hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed";
  const ghost = "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed";
  return <button className={`${base} ${subtle?ghost:solid}`} onClick={onClick} disabled={!!disabled}>{label}</button>;
}

function iconFor(kind: string) {
  if (kind.startsWith('media/')) return '🎬';
  if (kind.startsWith('embed/')) return '🧭';
  if (kind.startsWith('llm/')) return '🧠';
  return '⚙️';
}

function timeago(ts: number) {
  const d = Math.max(0, Date.now() - ts);
  const s = Math.floor(d/1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s/60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m/60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h/24);
  return `${days}d ago`;
}
