/**
 * Optimistic UI Hooks
 *
 * Problem: Full UBL cycle (User -> UBL -> Office -> UBL -> SSE -> User)
 * has physical latency (1-3 seconds). Users perceive this as "lag".
 *
 * Solution: Update UI immediately (optimistically), then reconcile
 * when the real response arrives via SSE. Rollback if error.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';

// =============================================================================
// TYPES
// =============================================================================

export interface OptimisticUpdate<T> {
  /** Unique ID for this update */
  id: string;
  /** The optimistic data applied immediately */
  optimisticData: T;
  /** Timestamp when the update was applied */
  appliedAt: number;
  /** Status of the update */
  status: 'pending' | 'confirmed' | 'failed';
  /** Error message if failed */
  error?: string;
}

export interface UseOptimisticOptions<T> {
  /** Timeout for pending updates (ms) - default 30000 */
  timeout?: number;
  /** Callback when update is confirmed */
  onConfirm?: (id: string, data: T) => void;
  /** Callback when update fails */
  onError?: (id: string, error: string, data: T) => void;
  /** Show toast notifications */
  showToast?: boolean;
}

// =============================================================================
// useOptimistic HOOK
// =============================================================================

/**
 * Hook for optimistic UI updates with automatic reconciliation
 *
 * @example
 * ```tsx
 * const { data, applyOptimistic, confirmUpdate, revertUpdate } = useOptimistic<Job[]>([]);
 *
 * // When user clicks "Approve"
 * const handleApprove = async (jobId: string) => {
 *   // Apply optimistic update immediately
 *   const updateId = applyOptimistic(
 *     jobs.map(j => j.id === jobId ? { ...j, status: 'approved' } : j)
 *   );
 *
 *   try {
 *     await api.approveJob(jobId);
 *     // SSE will confirm, or you can confirm manually
 *   } catch (e) {
 *     revertUpdate(updateId, e.message);
 *   }
 * };
 *
 * // When SSE confirms the update
 * useEffect(() => {
 *   sse.on('job.updated', (event) => {
 *     confirmUpdate(event.updateId);
 *   });
 * }, []);
 * ```
 */
export function useOptimistic<T>(
  initialData: T,
  options: UseOptimisticOptions<T> = {}
): {
  data: T;
  pendingUpdates: OptimisticUpdate<T>[];
  applyOptimistic: (newData: T) => string;
  confirmUpdate: (id: string) => void;
  revertUpdate: (id: string, error?: string) => void;
  hasPendingUpdates: boolean;
} {
  const {
    timeout = 30000,
    onConfirm,
    onError,
    showToast = true,
  } = options;

  // Confirmed (source of truth) data
  const [confirmedData, setConfirmedData] = useState<T>(initialData);
  // List of pending optimistic updates
  const [pendingUpdates, setPendingUpdates] = useState<OptimisticUpdate<T>[]>([]);
  // Ref to store the latest confirmed data for rollback
  const confirmedRef = useRef<T>(initialData);

  // Keep ref in sync
  useEffect(() => {
    confirmedRef.current = confirmedData;
  }, [confirmedData]);

  // Clean up timed-out updates
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setPendingUpdates(prev => {
        const timedOut = prev.filter(
          u => u.status === 'pending' && now - u.appliedAt > timeout
        );
        
        timedOut.forEach(u => {
          console.warn(`[Optimistic] Update ${u.id} timed out`);
          if (showToast) {
            toast.error('Update timed out. Please try again.');
          }
          onError?.(u.id, 'Timeout', u.optimisticData);
        });
        
        return prev.filter(u => !timedOut.includes(u));
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [timeout, onError, showToast]);

  /**
   * Apply an optimistic update immediately
   * @returns Update ID for confirmation/rollback
   */
  const applyOptimistic = useCallback((newData: T): string => {
    const id = `opt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    
    const update: OptimisticUpdate<T> = {
      id,
      optimisticData: newData,
      appliedAt: Date.now(),
      status: 'pending',
    };

    setPendingUpdates(prev => [...prev, update]);
    
    console.debug(`[Optimistic] Applied update ${id}`);
    return id;
  }, []);

  /**
   * Confirm an optimistic update (data is now canonical)
   */
  const confirmUpdate = useCallback((id: string) => {
    setPendingUpdates(prev => {
      const update = prev.find(u => u.id === id);
      if (update) {
        // The optimistic data becomes confirmed
        setConfirmedData(update.optimisticData);
        onConfirm?.(id, update.optimisticData);
        console.debug(`[Optimistic] Confirmed update ${id}`);
        
        // Remove from pending
        return prev.filter(u => u.id !== id);
      }
      return prev;
    });
  }, [onConfirm]);

  /**
   * Revert an optimistic update (rollback to confirmed data)
   */
  const revertUpdate = useCallback((id: string, error?: string) => {
    setPendingUpdates(prev => {
      const update = prev.find(u => u.id === id);
      if (update) {
        console.warn(`[Optimistic] Reverted update ${id}: ${error}`);
        
        if (showToast && error) {
          toast.error(`Operation failed: ${error}`);
        }
        
        onError?.(id, error || 'Unknown error', update.optimisticData);
        
        // Remove from pending (UI will revert to confirmed data)
        return prev.filter(u => u.id !== id);
      }
      return prev;
    });
  }, [onError, showToast]);

  // Compute the displayed data: latest pending update or confirmed data
  const data = pendingUpdates.length > 0
    ? pendingUpdates[pendingUpdates.length - 1].optimisticData
    : confirmedData;

  return {
    data,
    pendingUpdates,
    applyOptimistic,
    confirmUpdate,
    revertUpdate,
    hasPendingUpdates: pendingUpdates.length > 0,
  };
}

// =============================================================================
// useOptimisticList HOOK (for lists)
// =============================================================================

/**
 * Specialized hook for optimistic updates on lists
 */
export function useOptimisticList<T extends { id: string }>(
  initialItems: T[],
  options: UseOptimisticOptions<T[]> = {}
) {
  const optimistic = useOptimistic<T[]>(initialItems, options);

  /**
   * Optimistically update a single item
   */
  const updateItem = useCallback((
    itemId: string,
    updates: Partial<T>
  ): string => {
    return optimistic.applyOptimistic(
      optimistic.data.map(item =>
        item.id === itemId ? { ...item, ...updates } : item
      )
    );
  }, [optimistic]);

  /**
   * Optimistically add an item
   */
  const addItem = useCallback((item: T): string => {
    return optimistic.applyOptimistic([item, ...optimistic.data]);
  }, [optimistic]);

  /**
   * Optimistically remove an item
   */
  const removeItem = useCallback((itemId: string): string => {
    return optimistic.applyOptimistic(
      optimistic.data.filter(item => item.id !== itemId)
    );
  }, [optimistic]);

  return {
    ...optimistic,
    updateItem,
    addItem,
    removeItem,
  };
}

// =============================================================================
// useOptimisticMutation HOOK (for API calls)
// =============================================================================

/**
 * Hook that combines optimistic updates with API mutation
 */
export function useOptimisticMutation<TData, TVariables, TResult = void>(
  options: {
    mutationFn: (variables: TVariables) => Promise<TResult>;
    optimisticUpdate: (currentData: TData, variables: TVariables) => TData;
    onSuccess?: (result: TResult, variables: TVariables) => void;
    onError?: (error: Error, variables: TVariables) => void;
    timeout?: number;
    showToast?: boolean;
  }
) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const {
    data,
    applyOptimistic,
    confirmUpdate,
    revertUpdate,
    hasPendingUpdates,
  } = useOptimistic<TData | null>(null, {
    timeout: options.timeout,
    showToast: options.showToast,
  });

  const mutate = useCallback(async (
    currentData: TData,
    variables: TVariables
  ): Promise<TResult | undefined> => {
    setIsLoading(true);
    setError(null);

    // Apply optimistic update
    const optimisticData = options.optimisticUpdate(currentData, variables);
    const updateId = applyOptimistic(optimisticData);

    try {
      const result = await options.mutationFn(variables);
      confirmUpdate(updateId);
      options.onSuccess?.(result, variables);
      return result;
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      setError(err);
      revertUpdate(updateId, err.message);
      options.onError?.(err, variables);
      return undefined;
    } finally {
      setIsLoading(false);
    }
  }, [applyOptimistic, confirmUpdate, revertUpdate, options]);

  return {
    mutate,
    isLoading,
    error,
    hasPendingUpdates,
    data,
  };
}

export default useOptimistic;

