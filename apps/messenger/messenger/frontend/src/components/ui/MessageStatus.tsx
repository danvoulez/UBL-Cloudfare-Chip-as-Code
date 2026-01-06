/**
 * Message Status Indicator (Latencia.md §1)
 *
 * The "Seal" metaphor - messages evolve from draft to official document.
 * Each state has distinct visual feedback to mask latency.
 *
 * States:
 * - sending: Gray, spinning clock (optimistic)
 * - signing: Pen icon pulsing (hashing/signing)
 * - confirmed: Lock/Shield icon (ledger accepted)
 * - read: Double blue checks (recipient opened)
 * - error: Red X (failed)
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export type MessageState = 'sending' | 'signing' | 'confirmed' | 'read' | 'error';

interface MessageStatusProps {
  state: MessageState;
  timestamp?: number;
  className?: string;
}

export const MessageStatus: React.FC<MessageStatusProps> = ({
  state,
  timestamp,
  className = '',
}) => {
  return (
    <div className={`flex items-center gap-1.5 text-xs ${className}`}>
      {timestamp && (
        <span className="text-text-tertiary font-mono">
          {new Date(timestamp).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit' 
          })}
        </span>
      )}
      
      <AnimatePresence mode="wait">
        <motion.div
          key={state}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.5, opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <StatusIcon state={state} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

const StatusIcon: React.FC<{ state: MessageState }> = ({ state }) => {
  switch (state) {
    case 'sending':
      return (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="text-text-tertiary"
        >
          <ClockIcon />
        </motion.div>
      );

    case 'signing':
      return (
        <motion.div
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 0.5, repeat: Infinity }}
          className="text-warning"
        >
          <PenIcon />
        </motion.div>
      );

    case 'confirmed':
      return (
        <motion.div
          initial={{ scale: 1.5 }}
          animate={{ scale: 1 }}
          className="text-success"
        >
          <LockIcon />
        </motion.div>
      );

    case 'read':
      return (
        <div className="flex text-info">
          <CheckIcon />
          <CheckIcon className="-ml-1" />
        </div>
      );

    case 'error':
      return (
        <motion.div
          animate={{ x: [-2, 2, -2, 2, 0] }}
          transition={{ duration: 0.3 }}
          className="text-error"
        >
          <ErrorIcon />
        </motion.div>
      );
  }
};

// Icons
const ClockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12,6 12,12 16,14" />
  </svg>
);

const PenIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 19l7-7 3 3-7 7-3-3z" />
    <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
    <path d="M2 2l7.586 7.586" />
    <circle cx="11" cy="11" r="2" />
  </svg>
);

const LockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0110 0v4" />
  </svg>
);

const CheckIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={className}>
    <polyline points="20,6 9,17 4,12" />
  </svg>
);

const ErrorIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <line x1="15" y1="9" x2="9" y2="15" />
    <line x1="9" y1="9" x2="15" y2="15" />
  </svg>
);

export default MessageStatus;

