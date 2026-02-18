import { useCallback, useEffect, useRef, useState } from 'react';

interface FullscreenPresenterProps {
  children: React.ReactNode;
  onExit: () => void;
}

export function FullscreenPresenter({ children, onExit }: FullscreenPresenterProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cursorVisible, setCursorVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const hideCursor = useCallback(() => {
    setCursorVisible(false);
  }, []);

  const showCursor = useCallback(() => {
    setCursorVisible(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(hideCursor, 3000);
  }, [hideCursor]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    el.requestFullscreen?.().catch(() => {
      // Fallback: just stay in the fixed overlay
    });

    const handleFsChange = () => {
      if (!document.fullscreenElement) {
        onExit();
      }
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      clearTimeout(timerRef.current);
    };
  }, [onExit]);

  return (
    <div
      ref={containerRef}
      className={`fullscreen-presenter ${cursorVisible ? 'cursor-visible' : ''}`}
      onMouseMove={showCursor}
    >
      <div className="w-full h-full">
        {children}
      </div>
    </div>
  );
}
