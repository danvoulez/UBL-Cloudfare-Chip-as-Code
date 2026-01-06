/**
 * Ghost Card / Skeleton (Latencia.md §2)
 *
 * Placeholder for incoming Job Cards.
 * Shows pulsing skeleton while the AI generates content.
 * Occupies visual space to reduce anxiety.
 */

import React from 'react';
import { motion } from 'framer-motion';

interface GhostCardProps {
  /** The job ID being generated */
  jobId?: string;
  /** Type hint for skeleton shape */
  type?: 'formalization' | 'progress' | 'result' | 'unknown';
  /** Custom class */
  className?: string;
}

export const GhostCard: React.FC<GhostCardProps> = ({
  jobId,
  type = 'unknown',
  className = '',
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`
        bg-bg-surface border border-border-default rounded-lg p-5
        max-w-[440px] my-3 ${className}
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <SkeletonBox className="w-10 h-10 rounded-md" />
        <SkeletonBox className="w-24 h-6 rounded-full" />
      </div>
      
      {/* Title */}
      <SkeletonBox className="w-3/4 h-5 rounded mb-2" />
      
      {/* Description */}
      <SkeletonBox className="w-full h-4 rounded mb-1" />
      <SkeletonBox className="w-2/3 h-4 rounded mb-4" />
      
      {/* Type-specific content */}
      {type === 'formalization' && (
        <div className="space-y-2 mb-4 bg-bg-base/40 p-3 rounded-md border border-border-subtle">
          <div className="flex justify-between">
            <SkeletonBox className="w-20 h-3 rounded" />
            <SkeletonBox className="w-24 h-3 rounded" />
          </div>
          <div className="flex justify-between">
            <SkeletonBox className="w-24 h-3 rounded" />
            <SkeletonBox className="w-16 h-3 rounded" />
          </div>
          <div className="pt-3 mt-3 flex justify-between">
            <SkeletonBox className="w-20 h-4 rounded" />
            <SkeletonBox className="w-28 h-4 rounded" />
          </div>
        </div>
      )}
      
      {type === 'progress' && (
        <div className="mb-4">
          <div className="flex justify-between mb-1">
            <SkeletonBox className="w-24 h-3 rounded" />
            <SkeletonBox className="w-8 h-3 rounded" />
          </div>
          <SkeletonBox className="w-full h-1.5 rounded-full" />
        </div>
      )}
      
      {/* Buttons */}
      <div className="flex gap-2">
        <SkeletonBox className="flex-1 h-10 rounded-md" />
        <SkeletonBox className="w-24 h-10 rounded-md" />
      </div>
      
      {/* Job ID hint */}
      {jobId && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-3 text-center text-xs text-text-tertiary"
        >
          <motion.span
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            Preparando Job {jobId}...
          </motion.span>
        </motion.div>
      )}
    </motion.div>
  );
};

const SkeletonBox: React.FC<{ className?: string }> = ({ className = '' }) => (
  <motion.div
    className={`bg-bg-hover ${className}`}
    animate={{
      opacity: [0.5, 0.8, 0.5],
    }}
    transition={{
      duration: 1.5,
      repeat: Infinity,
      ease: 'easeInOut',
    }}
  />
);

/**
 * Message skeleton for loading states
 */
export const GhostMessage: React.FC<{ align?: 'left' | 'right' }> = ({ align = 'left' }) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className={`flex ${align === 'right' ? 'justify-end' : 'justify-start'} mb-3`}
  >
    <div className={`max-w-[70%] ${align === 'right' ? 'items-end' : 'items-start'}`}>
      <div className={`
        p-3 rounded-2xl
        ${align === 'right' 
          ? 'bg-accent/20 rounded-br-sm' 
          : 'bg-bg-surface rounded-bl-sm'
        }
      `}>
        <SkeletonBox className="w-48 h-4 rounded mb-1" />
        <SkeletonBox className="w-32 h-4 rounded" />
      </div>
      <div className="flex items-center gap-1 mt-1 px-1">
        <SkeletonBox className="w-10 h-3 rounded" />
        <SkeletonBox className="w-4 h-4 rounded" />
      </div>
    </div>
  </motion.div>
);

export default GhostCard;

