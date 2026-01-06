import { clsx, type ClassValue } from 'clsx';

/**
 * Merge class names with clsx
 * Usage: cn('base-class', condition && 'conditional-class', 'always-applied')
 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

