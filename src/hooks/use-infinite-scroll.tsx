import { useEffect, useRef, useCallback, useState } from 'react';
import { useLocation } from 'react-router-dom';

interface UseInfiniteScrollOptions {
  onLoadMore: () => void;
  hasMore: boolean;
  isLoading: boolean;
  rootMargin?: string;
  threshold?: number;
  prefetchThreshold?: number; // Percentage to trigger prefetch (0.5 = 50%)
  saveScrollPosition?: boolean;
}

/**
 * Hook for implementing infinite scroll functionality
 * Uses Intersection Observer API to detect when user scrolls near the bottom
 * Enhanced with prefetching and scroll position restoration
 */
export function useInfiniteScroll({
  onLoadMore,
  hasMore,
  isLoading,
  rootMargin = '100px',
  threshold = 0.1,
  prefetchThreshold = 0.7,
  saveScrollPosition = true,
}: UseInfiniteScrollOptions) {
  const observerTarget = useRef<HTMLDivElement>(null);
  const prefetchObserverTarget = useRef<HTMLDivElement>(null);
  const [isPrefetching, setIsPrefetching] = useState(false);
  const location = useLocation();
  const scrollKey = `scroll-${location.pathname}`;

  // Restore scroll position on mount
  useEffect(() => {
    if (saveScrollPosition) {
      const savedPosition = sessionStorage.getItem(scrollKey);
      if (savedPosition) {
        const position = parseInt(savedPosition, 10);
        // Delay to allow content to render
        requestAnimationFrame(() => {
          window.scrollTo(0, position);
        });
      }
    }
  }, [scrollKey, saveScrollPosition]);

  // Save scroll position on scroll
  useEffect(() => {
    if (!saveScrollPosition) return;

    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          sessionStorage.setItem(scrollKey, window.scrollY.toString());
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [scrollKey, saveScrollPosition]);

  const handleIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      
      // Load more when:
      // 1. Element is visible (intersecting)
      // 2. Not currently loading
      // 3. There's more data to load
      if (entry.isIntersecting && !isLoading && hasMore) {
        onLoadMore();
      }
    },
    [onLoadMore, isLoading, hasMore]
  );

  // Prefetch handler - triggers earlier than main load
  const handlePrefetch = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      
      if (entry.isIntersecting && !isLoading && !isPrefetching && hasMore) {
        setIsPrefetching(true);
        // Prefetch is handled by the same onLoadMore, 
        // but we track it separately to avoid duplicate calls
        onLoadMore();
        // Reset prefetch state after a short delay
        setTimeout(() => setIsPrefetching(false), 500);
      }
    },
    [onLoadMore, isLoading, isPrefetching, hasMore]
  );

  useEffect(() => {
    const element = observerTarget.current;
    if (!element) return;

    const observer = new IntersectionObserver(handleIntersect, {
      root: null, // viewport
      rootMargin,
      threshold,
    });

    observer.observe(element);

    return () => {
      if (element) {
        observer.unobserve(element);
      }
    };
  }, [handleIntersect, rootMargin, threshold]);

  // Prefetch observer with larger margin
  useEffect(() => {
    const element = prefetchObserverTarget.current;
    if (!element) return;

    const prefetchMargin = `${Math.round(window.innerHeight * prefetchThreshold)}px`;
    const observer = new IntersectionObserver(handlePrefetch, {
      root: null,
      rootMargin: prefetchMargin,
      threshold: 0,
    });

    observer.observe(element);

    return () => {
      if (element) {
        observer.unobserve(element);
      }
    };
  }, [handlePrefetch, prefetchThreshold]);

  return { 
    observerTarget, 
    prefetchObserverTarget,
    isPrefetching 
  };
}
