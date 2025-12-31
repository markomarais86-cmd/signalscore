import * as Sentry from "@sentry/react";
import { logger } from '@/lib/logger';

const sentryLogger = logger.scope('Sentry');

export function initializeSentry() {
  try {
    const sentryDsn = import.meta.env.VITE_SENTRY_DSN;
    
    // Only initialize if DSN is provided and in production
    if (!sentryDsn || !import.meta.env.PROD) {
      sentryLogger.debug('Disabled in development mode or no DSN');
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
    
    sentryLogger.info('Initialized successfully');
  } catch (error) {
    sentryLogger.error('Failed to initialize:', error);
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
    sentryLogger.error('Failed to capture exception:', e);
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
    sentryLogger.error('Failed to set user context:', e);
  }
}

export function clearUserContext() {
  try {
    if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
      Sentry.setUser(null);
    }
  } catch (e) {
    sentryLogger.error('Failed to clear user context:', e);
  }
}
