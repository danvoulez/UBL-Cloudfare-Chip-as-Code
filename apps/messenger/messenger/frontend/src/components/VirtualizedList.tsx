import React, { CSSProperties, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';

export type VirtualizedListHandle = {
  scrollToBottom: () => void;
};

type Props<T> = {
  items: T[];
  itemHeight: number; // fixed height in px
  overscan?: number;
  className?: string;
  style?: CSSProperties;
  renderRow: (item: T, index: number) => React.ReactNode;
};

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function useRaf() {
  const rafRef = useRef<number | null>(null);
  return (fn: () => void) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      fn();
      rafRef.current = null;
    });
  };
}

export const VirtualizedList = React.forwardRef<VirtualizedListHandle, Props<any>>(function VirtualizedList<T>(
  { items, itemHeight, overscan = 6, className, style, renderRow }: Props<T>,
  ref,
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportH, setViewportH] = useState(0);
  const [autoStick, setAutoStick] = useState(true); // follow tail when user is at bottom
  const raf = useRaf();

  const total = items.length;
  const totalHeight = total * itemHeight;

  const firstIndex = clamp(Math.floor(scrollTop / itemHeight) - overscan, 0, Math.max(total - 1, 0));
  const lastIndex = clamp(
    Math.floor((scrollTop + viewportH) / itemHeight) + overscan,
    0,
    Math.max(total - 1, 0),
  );
  const slice = useMemo(() => items.slice(firstIndex, lastIndex + 1), [items, firstIndex, lastIndex]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => {
      const top = el.scrollTop;
      const atBottom = el.scrollHeight - (el.scrollTop + el.clientHeight) < itemHeight * 1.5;
      raf(() => {
        setScrollTop(top);
        setAutoStick(atBottom);
      });
    };
    const onResize = () => {
      raf(() => setViewportH(el.clientHeight));
    };
    onResize();
    el.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    return () => {
      el.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
    };
  }, [raf]);

  useImperativeHandle(ref, () => ({
    scrollToBottom() {
      const el = containerRef.current;
      if (!el) return;
      el.scrollTop = el.scrollHeight;
    },
  }));

  // If new items arrive and user is near bottom, keep sticking to tail
  useEffect(() => {
    if (!autoStick) return;
    const el = containerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [items.length, autoStick]);

  const offsetY = firstIndex * itemHeight;

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ overflow: 'auto', willChange: 'transform', ...style }}
    >
      <div style={{ position: 'relative', height: totalHeight, width: '100%' }}>
        <div style={{ position: 'absolute', top: offsetY, left: 0, right: 0 }}>
          {slice.map((item, i) => {
            const index = firstIndex + i;
            return (
              <div key={index} style={{ height: itemHeight, overflow: 'hidden' }}>
                {renderRow(item, index)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
});

export default VirtualizedList;
