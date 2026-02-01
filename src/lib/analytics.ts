/**
 * Google Analytics 4 utility for LaunchPulse
 * Provides type-safe event tracking functions
 */

// Extend Window interface for gtag
declare global {
  interface Window {
    gtag?: (
      command: 'config' | 'event' | 'set',
      targetId: string,
      config?: Record<string, unknown>
    ) => void;
    dataLayer?: unknown[];
  }
}

// Check if GA is available (only in production)
const isGAAvailable = (): boolean => {
  return typeof window !== 'undefined' && typeof window.gtag === 'function';
};

/**
 * Track a page view (called automatically on route changes)
 */
export const trackPageView = (path: string, title?: string): void => {
  if (!isGAAvailable()) return;
  
  window.gtag?.('event', 'page_view', {
    page_path: path,
    page_title: title || document.title,
  });
};

/**
 * Track user sign up
 */
export const trackSignUp = (method: string = 'email'): void => {
  if (!isGAAvailable()) return;
  
  window.gtag?.('event', 'sign_up', {
    method,
  });
};

/**
 * Track user login
 */
export const trackLogin = (method: string = 'email'): void => {
  if (!isGAAvailable()) return;
  
  window.gtag?.('event', 'login', {
    method,
  });
};

/**
 * Track CTA button clicks
 */
export const trackCTAClick = (ctaName: string, location: string): void => {
  if (!isGAAvailable()) return;
  
  window.gtag?.('event', 'cta_click', {
    cta_name: ctaName,
    location,
  });
};

/**
 * Track pricing page view
 */
export const trackPricingView = (): void => {
  if (!isGAAvailable()) return;
  
  window.gtag?.('event', 'pricing_view', {});
};

/**
 * Track demo request form submission
 */
export const trackDemoRequest = (source: string): void => {
  if (!isGAAvailable()) return;
  
  window.gtag?.('event', 'demo_request', {
    source,
  });
};

/**
 * Track contact form submission
 */
export const trackContactFormSubmit = (): void => {
  if (!isGAAvailable()) return;
  
  window.gtag?.('event', 'contact_form_submit', {});
};

/**
 * Track generic custom events
 */
export const trackEvent = (
  eventName: string,
  params?: Record<string, string | number | boolean>
): void => {
  if (!isGAAvailable()) return;
  
  window.gtag?.('event', eventName, params);
};

/**
 * Track which A/B variant was shown to the user
 * Used for SEO meta description experiments and other A/B tests
 */
export const trackABVariant = (
  experimentId: string,
  variantId: string,
  pagePath: string
): void => {
  if (!isGAAvailable()) return;
  
  window.gtag?.('event', 'ab_experiment_view', {
    experiment_id: experimentId,
    variant_id: variantId,
    page_path: pagePath,
  });
};
