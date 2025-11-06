import * as Sentry from "@sentry/react";

export function initializeSentry() {
  const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
  
  // Only initialize if DSN is provided
  if (!sentryDsn) {
    console.warn('Sentry DSN not configured. Error tracking is disabled.');
    return;
  }

  Sentry.init({
    dsn: sentryDsn,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    // Performance Monitoring
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0, // 10% in production, 100% in dev
    // Session Replay
    replaysSessionSampleRate: 0.1, // 10% of sessions
    replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors
    
    environment: import.meta.env.MODE,
    enabled: import.meta.env.PROD, // Only enable in production
    
    beforeSend(event, hint) {
      // Filter out non-critical errors if needed
      const error = hint.originalException;
      
      // Don't send errors during development
      if (import.meta.env.DEV) {
        console.log('Sentry event (not sent in dev):', event);
        return null;
      }
      
      return event;
    },
  });
}

export function captureException(error: Error, context?: Record<string, any>) {
  Sentry.captureException(error, {
    extra: context,
  });
}

export function setUserContext(user: { id: string; email?: string; username?: string }) {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.username,
  });
}

export function clearUserContext() {
  Sentry.setUser(null);
}
