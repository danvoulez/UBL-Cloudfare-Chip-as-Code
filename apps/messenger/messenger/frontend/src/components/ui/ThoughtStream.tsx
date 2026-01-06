/**
 * AI Thought Stream (Latencia.md §2)
 *
 * Shows what the AI agent is doing in real-time.
 * Instead of generic "Typing...", narrate the actual work:
 * - "Lendo contexto..."
 * - "Verificando estoque..."
 * - "Gerando Card de Proposta..."
 *
 * This transforms waiting into engagement.
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ThoughtStep {
  id: string;
  text: string;
  icon?: 'thinking' | 'reading' | 'searching' | 'calculating' | 'writing' | 'tool';
  timestamp: number;
}

interface ThoughtStreamProps {
  /** Agent name */
  agentName: string;
  /** Current thought steps (from SSE events) */
  steps: ThoughtStep[];
  /** Is agent currently active */
  isActive: boolean;
  /** Show in header (compact) or inline (full) */
  variant?: 'header' | 'inline';
  /** Custom class */
  className?: string;
}

export const ThoughtStream: React.FC<ThoughtStreamProps> = ({
  agentName,
  steps,
  isActive,
  variant = 'header',
  className = '',
}) => {
  const [currentStep, setCurrentStep] = useState<ThoughtStep | null>(null);
  const [dots, setDots] = useState('');

  // Animate dots
  useEffect(() => {
    if (!isActive) return;
    
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 400);
    
    return () => clearInterval(interval);
  }, [isActive]);

  // Show latest step
  useEffect(() => {
    if (steps.length > 0) {
      setCurrentStep(steps[steps.length - 1]);
    } else {
      setCurrentStep(null);
    }
  }, [steps]);

  if (!isActive) return null;

  if (variant === 'header') {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={`flex items-center gap-2 text-xs text-text-secondary ${className}`}
      >
        <BrainPulse />
        <span className="text-accent font-medium">{agentName}</span>
        <span>está:</span>
        <AnimatePresence mode="wait">
          {currentStep ? (
            <motion.span
              key={currentStep.id}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="text-text-primary font-medium"
            >
              {currentStep.text}{dots}
            </motion.span>
          ) : (
            <motion.span
              key="thinking"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-text-primary font-medium"
            >
              Pensando{dots}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>
    );
  }

  // Inline variant - shows full thought history
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className={`
        bg-bg-surface/50 border border-border-subtle rounded-lg p-3
        ${className}
      `}
    >
      <div className="flex items-center gap-2 mb-2">
        <BrainPulse />
        <span className="text-xs font-bold text-accent">{agentName}</span>
        <span className="text-xs text-text-tertiary">está trabalhando...</span>
      </div>
      
      <div className="space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar">
        {steps.map((step, index) => (
          <motion.div
            key={step.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className="flex items-center gap-2 text-xs"
          >
            <StepIcon type={step.icon || 'thinking'} />
            <span className={index === steps.length - 1 ? 'text-text-primary' : 'text-text-tertiary'}>
              {step.text}
            </span>
            {index === steps.length - 1 && isActive && (
              <span className="text-accent animate-pulse">{dots}</span>
            )}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

const BrainPulse = () => (
  <motion.div
    animate={{ scale: [1, 1.1, 1] }}
    transition={{ duration: 1.5, repeat: Infinity }}
    className="text-accent"
  >
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z" />
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z" />
    </svg>
  </motion.div>
);

const StepIcon: React.FC<{ type: ThoughtStep['icon'] }> = ({ type }) => {
  const iconClass = "w-3 h-3 text-text-tertiary";
  
  switch (type) {
    case 'reading':
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
      );
    case 'searching':
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
      );
    case 'calculating':
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="4" y="2" width="16" height="20" rx="2" />
          <line x1="8" y1="6" x2="16" y2="6" />
          <line x1="8" y1="10" x2="16" y2="10" />
          <line x1="8" y1="14" x2="10" y2="14" />
          <line x1="14" y1="14" x2="16" y2="14" />
          <line x1="8" y1="18" x2="10" y2="18" />
          <line x1="14" y1="18" x2="16" y2="18" />
        </svg>
      );
    case 'writing':
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 19l7-7 3 3-7 7-3-3z" />
          <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
        </svg>
      );
    case 'tool':
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      );
    default: // thinking
      return (
        <motion.div
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="1" />
            <circle cx="19" cy="12" r="1" />
            <circle cx="5" cy="12" r="1" />
          </svg>
        </motion.div>
      );
  }
};

export default ThoughtStream;

