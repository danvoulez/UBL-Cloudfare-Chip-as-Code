/**
 * Live Progress Card
 * Shows task progress with live logs from Office via SSE
 */

import React, { useState, useEffect, useRef } from 'react';
import { Activity, Terminal, Pause, Play, XCircle, ExternalLink } from 'lucide-react';
import { JobCardData } from '../../types';

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
}

interface LiveProgressCardProps {
  card: JobCardData;
  sseUrl?: string; // SSE endpoint for live logs
  onCancel?: (jobId: string) => Promise<void>;
  onViewDetails?: (jobId: string) => void;
}

export const LiveProgressCard: React.FC<LiveProgressCardProps> = ({
  card,
  sseUrl,
  onCancel,
  onViewDetails,
}) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);

  // Connect to SSE for live logs
  useEffect(() => {
    if (!sseUrl || !showLogs || isPaused) return;

    const es = new EventSource(sseUrl, { withCredentials: true });
    esRef.current = es;

    es.onopen = () => {
      setIsConnected(true);
    };

    es.addEventListener('log', (event) => {
      try {
        const data = JSON.parse(event.data);
        const entry: LogEntry = {
          timestamp: data.timestamp || new Date().toISOString(),
          level: data.level || 'info',
          message: data.message || event.data,
        };
        setLogs(prev => [...prev.slice(-99), entry]); // Keep last 100 logs
      } catch {
        setLogs(prev => [...prev.slice(-99), {
          timestamp: new Date().toISOString(),
          level: 'info',
          message: event.data,
        }]);
      }
    });

    es.addEventListener('progress', (event) => {
      // Progress updates could be handled here if needed
      console.log('[SSE] Progress:', event.data);
    });

    es.onerror = () => {
      setIsConnected(false);
    };

    return () => {
      es.close();
      setIsConnected(false);
    };
  }, [sseUrl, showLogs, isPaused]);

  // Auto-scroll logs
  useEffect(() => {
    if (!isPaused && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isPaused]);

  const handleCancel = async () => {
    if (!onCancel) return;
    setIsCancelling(true);
    try {
      await onCancel(card.id);
    } finally {
      setIsCancelling(false);
    }
  };

  const getLevelColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'error': return 'text-error';
      case 'warn': return 'text-warning';
      case 'debug': return 'text-text-tertiary';
      default: return 'text-text-secondary';
    }
  };

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      });
    } catch {
      return '';
    }
  };

  return (
    <div className="mt-3 p-4 rounded-xl border border-info/30 bg-bg-base/50 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-info/10 text-info flex items-center justify-center relative">
            <Activity className="w-5 h-5" />
            {/* Pulse indicator */}
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-info rounded-full animate-pulse" />
          </div>
          <div>
            <div className="text-[10px] font-black text-text-tertiary uppercase tracking-wider">
              Em Execução
            </div>
            <h4 className="text-sm font-bold text-text-primary">{card.title}</h4>
          </div>
        </div>
        <span className="px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide bg-info/10 text-info flex items-center gap-1">
          <span className="w-1.5 h-1.5 bg-info rounded-full animate-pulse" />
          Running
        </span>
      </div>

      {/* Description */}
      {card.description && (
        <p className="text-[13px] text-text-secondary mb-3 leading-relaxed">
          {card.description}
        </p>
      )}

      {/* Progress Bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-[10px] text-text-tertiary mb-1">
          <span className="uppercase font-bold tracking-widest">Progresso</span>
          <span className="font-mono">{card.progress}%</span>
        </div>
        <div className="h-2 bg-bg-hover rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-info to-accent rounded-full transition-all duration-500 ease-out"
            style={{ width: `${card.progress}%` }}
          />
        </div>
      </div>

      {/* Current Step */}
      {card.metadata?.items && card.metadata.items.length > 0 && (
        <div className="mb-3 p-2 bg-bg-surface/50 rounded-lg">
          {card.metadata.items.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between text-[12px]">
              <span className="text-text-tertiary">{item.label}</span>
              <span className="text-text-primary font-medium">{item.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Live Logs Section */}
      <div className="mb-3">
        <button
          onClick={() => setShowLogs(!showLogs)}
          className="w-full flex items-center justify-between p-2 bg-bg-surface/50 hover:bg-bg-hover rounded-lg transition-colors"
        >
          <div className="flex items-center gap-2 text-[11px] font-bold text-text-secondary uppercase tracking-widest">
            <Terminal className="w-4 h-4" />
            Live Logs
          </div>
          <div className="flex items-center gap-2">
            {isConnected && (
              <span className="flex items-center gap-1 text-[10px] text-success">
                <span className="w-1.5 h-1.5 bg-success rounded-full animate-pulse" />
                Connected
              </span>
            )}
            <span className="text-[11px] text-text-tertiary">
              {showLogs ? '▲ Hide' : '▼ Show'}
            </span>
          </div>
        </button>

        {showLogs && (
          <div className="mt-2">
            {/* Log Controls */}
            <div className="flex items-center justify-between mb-2 px-2">
              <button
                onClick={() => setIsPaused(!isPaused)}
                className="flex items-center gap-1 text-[10px] text-text-tertiary hover:text-text-primary transition-colors"
              >
                {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                {isPaused ? 'Resume' : 'Pause'}
              </button>
              <button
                onClick={() => setLogs([])}
                className="text-[10px] text-text-tertiary hover:text-text-primary transition-colors"
              >
                Clear
              </button>
            </div>

            {/* Log Output */}
            <div className="bg-bg-base border border-border-subtle rounded-lg p-3 max-h-48 overflow-y-auto font-mono text-[11px] custom-scrollbar">
              {logs.length === 0 ? (
                <div className="text-text-tertiary italic">Waiting for logs...</div>
              ) : (
                logs.map((log, idx) => (
                  <div key={idx} className={`${getLevelColor(log.level)} mb-0.5`}>
                    <span className="text-text-tertiary opacity-50">[{formatTime(log.timestamp)}]</span>{' '}
                    <span className="opacity-70">[{log.level.toUpperCase()}]</span>{' '}
                    {log.message}
                  </div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-4 mt-1">
        {onViewDetails && (
          <button
            onClick={() => onViewDetails(card.id)}
            className="flex-1 py-2 px-3 bg-bg-surface hover:bg-bg-hover border border-border-default text-text-primary text-[11px] font-bold uppercase tracking-wide rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <ExternalLink className="w-3 h-3" />
            Ver Detalhes
          </button>
        )}
        {onCancel && (
          <button
            onClick={handleCancel}
            disabled={isCancelling}
            className="py-2 px-4 bg-error/10 hover:bg-error/20 text-error text-[11px] font-bold uppercase tracking-wide rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            <XCircle className="w-3 h-3" />
            {isCancelling ? 'Cancelando...' : 'Cancelar'}
          </button>
        )}
      </div>
    </div>
  );
};

export default LiveProgressCard;
