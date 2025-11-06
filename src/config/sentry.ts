import * as Sentry from "@sentry/react";

export function initializeSentry() {
  try {
    const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
    
    // Only initialize if DSN is provided and in production
    if (!sentryDsn || !import.meta.env.PROD) {
      if (import.meta.env.DEV) {
        console.log('Sentry: Disabled in development mode');
      }
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
      enabled: true,
      
      beforeSend(event, hint) {
        // Filter out non-critical errors if needed
        return event;
      },
    });
    
    console.log('Sentry initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Sentry:', error);
    // Don't throw - allow app to continue without Sentry
  }
}

export function captureException(error: Error, context?: Record<string, any>) {
  try {
    if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
      Sentry.captureException(error, {
        extra: context,
      });
    }
  } catch (e) {
    console.error('Failed to capture exception in Sentry:', e);
  }
}

export function setUserContext(user: { id: string; email?: string; username?: string }) {
  try {
    if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
      Sentry.setUser({
        id: user.id,
        email: user.email,
        username: user.username,
      });
    }
  } catch (e) {
    console.error('Failed to set user context in Sentry:', e);
  }
}

export function clearUserContext() {
  try {
    if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
      Sentry.setUser(null);
    }
  } catch (e) {
    console.error('Failed to clear user context in Sentry:', e);
  }
}
