import React from 'react';
import { cn } from '../../lib/cn';

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({ size = 'md', className }) => {
  const sizes = {
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-2',
    lg: 'w-10 h-10 border-3',
  };

  return (
    <div
      className={cn(
        'rounded-full border-accent/20 border-t-accent animate-spin',
        sizes[size],
        className
      )}
    />
  );
};

export const FullPageSpinner: React.FC<{ message?: string }> = ({ message }) => (
  <div className="fixed inset-0 bg-bg-base flex flex-col items-center justify-center gap-6">
    <Spinner size="lg" />
    {message && (
      <p className="text-text-tertiary text-xxs font-bold uppercase tracking-widest">
        {message}
      </p>
    )}
  </div>
);

