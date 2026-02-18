import { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ChevronLeft, ChevronRight, Maximize, Grid } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SlideRenderer, SlideDefinition, SLIDE_ORDER } from './SlideRenderer';
import { FullscreenPresenter } from './FullscreenPresenter';
import { SlideLayout } from './SlideLayout';
import type { BrandedReportData } from '@/utils/branded-pdf-export';
import './slide-styles.css';

interface SlideDeckProps {
  data: BrandedReportData;
  logoUrl?: string | null;
  brandColor?: string;
  onBack: () => void;
}

export function SlideDeck({ data, logoUrl, brandColor, onBack }: SlideDeckProps) {
  const slides = SLIDE_ORDER;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isGrid, setIsGrid] = useState(false);

  const goTo = useCallback((idx: number) => {
    setCurrentIndex(Math.max(0, Math.min(slides.length - 1, idx)));
    setIsGrid(false);
  }, [slides.length]);

  const next = useCallback(() => goTo(currentIndex + 1), [currentIndex, goTo]);
  const prev = useCallback(() => goTo(currentIndex - 1), [currentIndex, goTo]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
      else if (e.key === 'Escape') { setIsFullscreen(false); setIsGrid(false); }
      else if (e.key === 'F5') { e.preventDefault(); setIsFullscreen(true); }
      else if (e.key === 'g' || e.key === 'G') { setIsGrid(v => !v); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [next, prev]);

  const currentSlide = slides[currentIndex];

  if (isFullscreen) {
    return (
      <FullscreenPresenter onExit={() => setIsFullscreen(false)}>
        <SlideRenderer
          slide={currentSlide}
          data={data}
          logoUrl={logoUrl}
          brandColor={brandColor}
          className="w-screen h-screen"
        />
      </FullscreenPresenter>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card flex-shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <span className="text-sm text-muted-foreground">
            Slide {currentIndex + 1} of {slides.length}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setIsGrid(v => !v)}>
            <Grid className="h-4 w-4 mr-1" /> {isGrid ? 'Slide' : 'Grid'}
          </Button>
          <Button variant="default" size="sm" onClick={() => setIsFullscreen(true)}>
            <Maximize className="h-4 w-4 mr-1" /> Present
          </Button>
        </div>
      </div>

      {isGrid ? (
        /* Grid view */
        <div className="flex-1 overflow-auto p-6">
          <div className="grid grid-cols-3 gap-6 max-w-[1400px] mx-auto">
            {slides.map((slide, idx) => (
              <button
                key={slide.id}
                onClick={() => goTo(idx)}
                className={cn(
                  'relative aspect-video rounded-lg overflow-hidden border-2 transition-all hover:ring-2 hover:ring-primary',
                  idx === currentIndex ? 'border-primary ring-2 ring-primary' : 'border-border'
                )}
              >
                <SlideRenderer
                  slide={slide}
                  data={data}
                  logoUrl={logoUrl}
                  brandColor={brandColor}
                  fixedScale={0.22}
                  className="pointer-events-none"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-background/80 px-2 py-1 text-xs text-muted-foreground">
                  {idx + 1}. {slide.title}
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* Editor view: sidebar + canvas */
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar thumbnails */}
          <div className="w-52 flex-shrink-0 border-r border-border overflow-y-auto bg-card p-3 space-y-2">
            {slides.map((slide, idx) => (
              <button
                key={slide.id}
                onClick={() => goTo(idx)}
                className={cn(
                  'w-full aspect-video rounded border overflow-hidden relative transition-all',
                  idx === currentIndex ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-muted-foreground'
                )}
              >
                <SlideRenderer
                  slide={slide}
                  data={data}
                  logoUrl={logoUrl}
                  brandColor={brandColor}
                  fixedScale={0.095}
                  className="pointer-events-none"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-background/80 text-[10px] text-center text-muted-foreground py-0.5">
                  {idx + 1}
                </div>
              </button>
            ))}
          </div>

          {/* Canvas */}
          <div className="flex-1 flex items-center justify-center p-8 relative bg-muted/10">
            <div className="w-full max-w-[1200px] aspect-video relative">
              <SlideRenderer
                slide={currentSlide}
                data={data}
                logoUrl={logoUrl}
                brandColor={brandColor}
              />
            </div>

            {/* Nav arrows */}
            <button
              onClick={prev}
              disabled={currentIndex === 0}
              className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-card/80 border border-border hover:bg-card disabled:opacity-30 transition"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={next}
              disabled={currentIndex === slides.length - 1}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-card/80 border border-border hover:bg-card disabled:opacity-30 transition"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
