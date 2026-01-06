/**
 * Hold-to-Confirm Button (Latencia.md §3)
 *
 * For critical actions (L3/L5), transform click into a ritual.
 * User must hold for 500ms - this masks network latency and
 * gives weight to important decisions.
 *
 * Features:
 * - Progress bar fills while holding
 * - Haptic feedback on mobile
 * - "Stamp" animation on confirm
 */

import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface HoldButtonProps {
  /** Button label */
  children: React.ReactNode;
  /** Called when hold completes */
  onConfirm: () => void;
  /** Hold duration in ms (default 500) */
  holdDuration?: number;
  /** Risk level for styling */
  riskLevel?: 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5';
  /** Is the action loading after confirm */
  loading?: boolean;
  /** Disable the button */
  disabled?: boolean;
  /** Custom class */
  className?: string;
  /** Icon to show */
  icon?: React.ReactNode;
}

export const HoldButton: React.FC<HoldButtonProps> = ({
  children,
  onConfirm,
  holdDuration = 500,
  riskLevel = 'L0',
  loading = false,
  disabled = false,
  className = '',
  icon,
}) => {
  const [progress, setProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  const isHighRisk = ['L3', 'L4', 'L5'].includes(riskLevel);

  const triggerHaptic = useCallback(() => {
    if ('vibrate' in navigator) {
      navigator.vibrate(isHighRisk ? [50, 30, 50] : [30]);
    }
  }, [isHighRisk]);

  const handleStart = useCallback(() => {
    if (disabled || loading || confirmed) return;
    
    setIsHolding(true);
    startTimeRef.current = Date.now();
    
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const pct = Math.min((elapsed / holdDuration) * 100, 100);
      setProgress(pct);
      
      if (pct >= 100) {
        clearInterval(intervalRef.current!);
        setConfirmed(true);
        triggerHaptic();
        onConfirm();
        
        // Reset after animation
        setTimeout(() => {
          setConfirmed(false);
          setProgress(0);
        }, 1000);
      }
    }, 16); // ~60fps
  }, [disabled, loading, confirmed, holdDuration, onConfirm, triggerHaptic]);

  const handleEnd = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    setIsHolding(false);
    if (!confirmed) {
      setProgress(0);
    }
  }, [confirmed]);

  // Get colors based on risk level
  const getColors = () => {
    if (disabled) return 'bg-bg-hover border-border-subtle text-text-tertiary';
    
    switch (riskLevel) {
      case 'L5':
      case 'L4':
        return 'bg-error/10 border-error text-error hover:bg-error/20';
      case 'L3':
        return 'bg-warning/10 border-warning text-warning hover:bg-warning/20';
      default:
        return 'bg-accent/10 border-accent text-accent hover:bg-accent/20';
    }
  };

  const getProgressColor = () => {
    switch (riskLevel) {
      case 'L5':
      case 'L4':
        return 'bg-error';
      case 'L3':
        return 'bg-warning';
      default:
        return 'bg-accent';
    }
  };

  return (
    <motion.button
      className={`
        relative overflow-hidden
        px-6 py-3 rounded-lg font-bold text-sm
        border border-white/20 transition-colors
        select-none cursor-pointer
        ${getColors()}
        ${className}
      `}
      disabled={disabled || loading}
      onMouseDown={handleStart}
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
      onTouchStart={handleStart}
      onTouchEnd={handleEnd}
      whileTap={{ scale: 0.98 }}
    >
      {/* Progress fill */}
      <motion.div
        className={`absolute inset-0 ${getProgressColor()} opacity-20`}
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0 }}
      />
      
      {/* Content */}
      <span className="relative z-10 flex items-center justify-center gap-2">
        <AnimatePresence mode="wait">
          {confirmed ? (
            <motion.span
              key="confirmed"
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0 }}
              className="flex items-center gap-2"
            >
              <StampIcon />
              CONFIRMADO
            </motion.span>
          ) : loading ? (
            <motion.span
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2"
            >
              <Spinner />
              Processando...
            </motion.span>
          ) : (
            <motion.span
              key="default"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2"
            >
              {icon}
              {isHolding ? 'Segure...' : children}
            </motion.span>
          )}
        </AnimatePresence>
      </span>
      
      {/* Risk indicator */}
      {isHighRisk && !confirmed && (
        <span className="absolute top-1 right-1 text-[8px] font-mono opacity-60">
          {riskLevel}
        </span>
      )}
    </motion.button>
  );
};

const StampIcon = () => (
  <motion.svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="currentColor"
    initial={{ y: -20 }}
    animate={{ y: 0 }}
    transition={{ type: 'spring', stiffness: 500, damping: 15 }}
  >
    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14l-5-5 1.41-1.41L12 14.17l4.59-4.58L18 11l-6 6z" />
  </motion.svg>
);

const Spinner = () => (
  <motion.svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    animate={{ rotate: 360 }}
    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
  >
    <path d="M21 12a9 9 0 11-6.219-8.56" />
  </motion.svg>
);

export default HoldButton;

