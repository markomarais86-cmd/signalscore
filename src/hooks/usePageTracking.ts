import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { getAllExperimentAssignments } from '@/lib/ab-testing';
import { trackPageView, setABTestUserProperties } from '@/lib/analytics';

/**
 * Hook to track page views on route changes for SPA
 * Also restores A/B experiment assignments for GA4 user properties
 * Place this inside a component that's within BrowserRouter
 */
export function usePageTracking(): void {
  const location = useLocation();

  useEffect(() => {
    // Track page view on route change
    trackPageView(location.pathname + location.search);
    
    // Restore experiment assignments on each page view
    // This ensures GA4 has user's variant info even on return visits
    const experiments = getAllExperimentAssignments();
    Object.entries(experiments).forEach(([expId, variantId]) => {
      setABTestUserProperties(expId, variantId);
    });
  }, [location]);
}
