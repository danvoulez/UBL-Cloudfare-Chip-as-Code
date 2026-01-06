import React from 'react';
import { cn } from '../../lib/cn';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const base =
  'inline-flex items-center justify-center rounded-md font-medium transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ' +
  'disabled:opacity-60 disabled:cursor-not-allowed';

const variants: Record<string, string> = {
  primary: 'bg-primary text-on-primary hover:bg-primary/90 focus-visible:ring-primary',
  secondary: 'bg-surface-2 text-on-surface hover:bg-surface-3 focus-visible:ring-surface-4',
  ghost: 'bg-transparent text-on-surface hover:bg-surface-2 focus-visible:ring-surface-4',
  danger: 'bg-error text-white hover:bg-error/90 focus-visible:ring-error'
};

const sizes: Record<string, string> = {
  sm: 'h-8 px-3 text-sm gap-2',
  md: 'h-10 px-4 text-sm gap-2.5',
  lg: 'h-12 px-5 text-base gap-3',
  icon: 'h-10 w-10'
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading = false, disabled, leftIcon, rightIcon, children, ...props }, ref) => {
    const isDisabled = disabled || loading;
    return (
      <button
        ref={ref}
        className={cn(base, variants[variant], sizes[size], className)}
        aria-busy={loading || undefined}
        aria-disabled={isDisabled || undefined}
        disabled={isDisabled}
        {...props}
      >
        {leftIcon && <span className="inline-flex">{leftIcon}</span>}
        <span className={cn('inline-flex items-center', loading && 'opacity-75')}>{children}</span>
        {rightIcon && <span className="inline-flex">{rightIcon}</span>}
        {loading && (
          <span className="ml-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent align-[-2px]" />
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
export default Button;