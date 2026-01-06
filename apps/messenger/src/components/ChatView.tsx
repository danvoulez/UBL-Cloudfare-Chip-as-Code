import React from 'react';
import { Button } from './ui/Button';
import { cn } from '../lib/cn';

type Message = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  time?: string;
  status?: 'sending' | 'sent' | 'read' | 'error';
};

interface ChatViewProps {
  title?: string;
  messages: Message[];
  onSend?: (text: string) => void;
  onAttach?: (file: File) => void;
  onBack?: () => void;
}

export default function ChatView({ title = 'Conversa', messages, onSend, onAttach, onBack }: ChatViewProps) {
  const [value, setValue] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const areaRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom on messages change
  React.useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  // Autosize textarea
  const autosize = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 220) + 'px';
  };

  const handleSend = async () => {
    const text = value.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await onSend?.(text);
      setValue('');
      autosize();
    } finally {
      setSending(false);
    }
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const onFile: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const f = e.currentTarget.files?.[0];
    if (f) onAttach?.(f);
    e.currentTarget.value = '';
  };

  return (
    <section className="flex h-full min-w-0 flex-1 flex-col bg-surface-1">
      {/* Header */}
      <header className="flex h-14 items-center gap-2 border-b border-outline/40 px-3">
        <button onClick={onBack} className="mr-1 hidden h-8 w-8 items-center justify-center rounded-md hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-primary md:inline-flex" aria-label="Voltar">
          <span className="i-lucide-arrow-left h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold leading-none text-on-surface">{title}</h2>
          <p className="mt-1 truncate text-xs text-on-surface/60">Conectado • Atualizado agora</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="icon" aria-label="Procurar">
            <span className="i-lucide-search h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Mais opções">
            <span className="i-lucide-more-vertical h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Messages */}
      <div ref={areaRef} className="scroll-thin flex-1 overflow-y-auto px-3 py-3">
        <div className="mx-auto max-w-3xl space-y-2">
          {messages.map((m) => (
            <div key={m.id} className={cn('flex w-full gap-2', m.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div className={cn(
                'max-w-[78%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm',
                m.role === 'user'
                  ? 'bg-primary text-on-primary rounded-br-sm'
                  : 'bg-surface-3 text-on-surface rounded-bl-sm'
              )}>
                {m.text}
                <div className="mt-1.5 flex items-center gap-2 text-[10px] text-on-surface/60">
                  <span>{m.time || ''}</span>
                  {m.status === 'sending' && <span className="i-lucide-clock h-3 w-3" />}
                  {m.status === 'sent' && <span className="i-lucide-check h-3 w-3" />}
                  {m.status === 'read' && <span className="i-lucide-check-check h-3 w-3" />}
                  {m.status === 'error' && <span className="i-lucide-alert-circle h-3 w-3 text-error" />}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Composer */}
      <footer className="border-t border-outline/40 p-3">
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <div className="relative flex min-h-[2.5rem] flex-1 items-center rounded-xl border border-outline bg-surface-2 px-2.5 py-2">
            <input type="file" onChange={onFile} className="absolute inset-0 h-full w-10 cursor-pointer opacity-0" aria-label="Anexar arquivo" />
            <button className="mr-1 inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-surface-3" title="Anexar" aria-label="Anexar">
              <span className="i-lucide-paperclip h-4 w-4" />
            </button>
            <textarea
              ref={inputRef}
              value={value}
              onChange={(e) => { setValue(e.currentTarget.value); autosize(); }}
              onKeyDown={onKeyDown}
              placeholder="Escrever uma mensagem…"
              rows={1}
              className="max-h-[220px] flex-1 resize-none bg-transparent px-2.5 py-1.5 text-sm outline-none placeholder:text-on-surface/50"
            />
          </div>
          <Button onClick={handleSend} disabled={!value.trim()} loading={sending} aria-label="Enviar mensagem">
            Enviar
          </Button>
        </div>
      </footer>
    </section>
  );
}