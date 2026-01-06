import React from 'react';
import { Input } from './ui/Input';
import { cn } from '../lib/cn';

type Thread = {
  id: string;
  title: string;
  lastMessage?: string;
  unread?: number;
  avatarUrl?: string;
};

interface SidebarProps {
  threads: Thread[];
  activeId?: string;
  onSelect?: (id: string) => void;
  onNewChat?: () => void;
}

export default function Sidebar({ threads, activeId, onSelect, onNewChat }: SidebarProps) {
  const [q, setQ] = React.useState('');
  const filtered = React.useMemo(() => {
    const v = q.trim().toLowerCase();
    if (!v) return threads;
    return threads.filter(t => (t.title || '').toLowerCase().includes(v) || (t.lastMessage || '').toLowerCase().includes(v));
  }, [q, threads]);

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-r border-outline/40 bg-surface-1">
      <div className="flex items-center gap-2 p-3">
        <Input
          placeholder="Buscar conversas…"
          value={q}
          onChange={(e) => setQ(e.currentTarget.value)}
          prefix={<span className="i-lucide-search h-4 w-4" aria-hidden />}
        />
        <button
          onClick={onNewChat}
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-outline bg-surface-2 text-on-surface hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Nova conversa"
          title="Nova conversa"
        >
          <span className="i-lucide-plus h-5 w-5" />
        </button>
      </div>

      <div className="scroll-thin flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <div className="p-6 text-center text-sm text-on-surface/60">Nenhuma conversa</div>
        )}
        <ul className="px-2 pb-2">
          {filtered.map((t) => (
            <li key={t.id}>
              <button
                onClick={() => onSelect?.(t.id)}
                className={cn(
                  'group flex w-full items-center gap-3 rounded-lg p-2.5 text-left hover:bg-surface-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  t.id === activeId && 'bg-surface-3 ring-1 ring-primary/30'
                )}
              >
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-surface-4">
                  {/* Avatar fallback */}
                  <span className="absolute inset-0 grid place-items-center text-sm text-on-surface/70">
                    {(t.title || 'X').slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-medium text-on-surface">{t.title}</p>
                    {t.unread ? (
                      <span className="ml-2 inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-on-primary">
                        {t.unread}
                      </span>
                    ) : null}
                  </div>
                  <p className="truncate text-xs text-on-surface/60">{t.lastMessage || '—'}</p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}