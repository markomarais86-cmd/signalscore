import { ReactNode, useRef, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface SlideLayoutProps {
  children: ReactNode;
  className?: string;
  /** If provided, use this fixed scale instead of auto-calculating */
  fixedScale?: number;
}

export function SlideLayout({ children, className, fixedScale }: SlideLayoutProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(fixedScale ?? 0.5);

  useEffect(() => {
    if (fixedScale !== undefined) {
      setScale(fixedScale);
      return;
    }
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        setScale(Math.min(width / 1920, height / 1080));
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [fixedScale]);

  return (
    <div ref={containerRef} className={cn('relative w-full h-full overflow-hidden', className)}>
      <div
        className="slide-wrapper slide-content"
        style={{ transform: `scale(${scale})` }}
      >
        {children}
      </div>
    </div>
  );
}
