import React from 'react';
import { cn } from '../../lib/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, hint, error, prefix, suffix, id, ...props }, ref) => {
    const inputId = id || React.useId();
    const describedBy: string[] = [];
    if (hint) describedBy.push(`${inputId}-hint`);
    if (error) describedBy.push(`${inputId}-error`);

    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className="mb-1.5 block text-xs font-medium text-on-surface/80">
            {label}
          </label>
        )}
        <div className={cn(
          'flex h-10 w-full items-center rounded-md border',
          'bg-surface-1 text-on-surface',
          'border-outline focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20',
          error && 'border-error focus-within:ring-error/20',
          className
        )}>
          {prefix && <span className="pl-3 text-on-surface/70">{prefix}</span>}
          <input
            id={inputId}
            ref={ref}
            className="flex-1 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-on-surface/40"
            aria-describedby={describedBy.length ? describedBy.join(' ') : undefined}
            {...props}
          />
          {suffix && <span className="pr-3 text-on-surface/70">{suffix}</span>}
        </div>
        {hint && !error && (
          <p id={`${inputId}-hint`} className="mt-1.5 text-xs text-on-surface/60">{hint}</p>
        )}
        {error && (
          <p id={`${inputId}-error`} className="mt-1.5 text-xs text-error">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
export default Input;