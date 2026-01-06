/**
 * Sync Status Bar (Latencia.md §4)
 *
 * Shows ledger synchronization status on cold start.
 * Instead of generic spinner, show authoritative progress:
 * - "Validando integridade do Ledger..."
 * - "Sincronizando 12 novos eventos..."
 * - "Ambiente Seguro Ativo." (Green)
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export type SyncState = 
  | 'connecting'
  | 'validating'
  | 'syncing'
  | 'ready'
  | 'error'
  | 'offline';

interface SyncStatusProps {
  /** Current sync state */
  state: SyncState;
  /** Number of events being synced */
  eventsCount?: number;
  /** Progress percentage (0-100) */
  progress?: number;
  /** Error message if state is 'error' */
  errorMessage?: string;
  /** Last sync timestamp */
  lastSyncAt?: number;
  /** Custom class */
  className?: string;
}

export const SyncStatus: React.FC<SyncStatusProps> = ({
  state,
  eventsCount = 0,
  progress = 0,
  errorMessage,
  lastSyncAt,
  className = '',
}) => {
  // Only show for non-ready states (or briefly for ready)
  const isVisible = state !== 'ready';

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className={`overflow-hidden ${className}`}
        >
          <div className={`
            flex items-center justify-between px-4 py-2
            text-xs font-medium
            ${getStateStyles(state)}
          `}>
            <div className="flex items-center gap-2">
              <StateIcon state={state} />
              <span>{getStateMessage(state, eventsCount)}</span>
            </div>
            
            {state === 'syncing' && progress > 0 && (
              <span className="font-mono">{progress}%</span>
            )}
            
            {state === 'error' && errorMessage && (
              <span className="text-error/80 truncate max-w-[200px]">
                {errorMessage}
              </span>
            )}
          </div>
          
          {/* Progress bar for syncing state */}
          {state === 'syncing' && (
            <motion.div
              className="h-0.5 bg-info"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/**
 * Compact version for header
 */
export const SyncIndicator: React.FC<{ state: SyncState }> = ({ state }) => {
  if (state === 'ready') {
    return (
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className="w-2 h-2 rounded-full bg-success"
        title="Ambiente Seguro Ativo"
      />
    );
  }

  return (
    <motion.div
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{ duration: 1, repeat: Infinity }}
      className={`w-2 h-2 rounded-full ${
        state === 'error' ? 'bg-error' : 
        state === 'offline' ? 'bg-text-tertiary' : 
        'bg-warning'
      }`}
      title={getStateMessage(state, 0)}
    />
  );
};

function getStateStyles(state: SyncState): string {
  switch (state) {
    case 'connecting':
      return 'bg-bg-surface text-text-secondary border-b border-border-subtle';
    case 'validating':
      return 'bg-warning/10 text-warning border-b border-warning/20';
    case 'syncing':
      return 'bg-info/10 text-info border-b border-info/20';
    case 'ready':
      return 'bg-success/10 text-success border-b border-success/20';
    case 'error':
      return 'bg-error/10 text-error border-b border-error/20';
    case 'offline':
      return 'bg-bg-hover text-text-tertiary border-b border-border-subtle';
    default:
      return '';
  }
}

function getStateMessage(state: SyncState, eventsCount: number): string {
  switch (state) {
    case 'connecting':
      return 'Conectando ao Ledger...';
    case 'validating':
      return 'Validando integridade do Ledger...';
    case 'syncing':
      return eventsCount > 0 
        ? `Sincronizando ${eventsCount} eventos...` 
        : 'Sincronizando dados...';
    case 'ready':
      return 'Ambiente Seguro Ativo';
    case 'error':
      return 'Erro de Sincronização';
    case 'offline':
      return 'Modo Offline';
    default:
      return '';
  }
}

const StateIcon: React.FC<{ state: SyncState }> = ({ state }) => {
  const iconClass = "w-4 h-4";

  switch (state) {
    case 'connecting':
      return (
        <motion.svg
          className={iconClass}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        >
          <path d="M21 12a9 9 0 11-6.219-8.56" />
        </motion.svg>
      );
      
    case 'validating':
      return (
        <motion.svg
          className={iconClass}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </motion.svg>
      );
      
    case 'syncing':
      return (
        <motion.svg
          className={iconClass}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
        >
          <polyline points="23 4 23 10 17 10" />
          <polyline points="1 20 1 14 7 14" />
          <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
        </motion.svg>
      );
      
    case 'ready':
      return (
        <motion.svg
          className={iconClass}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 15 }}
        >
          <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </motion.svg>
      );
      
    case 'error':
      return (
        <motion.svg
          className={iconClass}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          animate={{ x: [-2, 2, -2, 2, 0] }}
          transition={{ duration: 0.5 }}
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </motion.svg>
      );
      
    case 'offline':
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="1" y1="1" x2="23" y2="23" />
          <path d="M16.72 11.06A10.94 10.94 0 0119 12.55" />
          <path d="M5 12.55a10.94 10.94 0 015.17-2.39" />
          <path d="M10.71 5.05A16 16 0 0122.58 9" />
          <path d="M1.42 9a15.91 15.91 0 014.7-2.88" />
          <path d="M8.53 16.11a6 6 0 016.95 0" />
          <line x1="12" y1="20" x2="12.01" y2="20" />
        </svg>
      );
  }
};

export default SyncStatus;

