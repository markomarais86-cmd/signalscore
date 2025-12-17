/**
 * Centralized logger that only outputs in development mode.
 * Use this instead of console.log throughout the application.
 */

const isDev = import.meta.env.DEV;

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerOptions {
  /** Force logging even in production (use sparingly) */
  force?: boolean;
}

/**
 * Logger utility that respects environment.
 * - In development: All logs are shown
 * - In production: Only errors and forced logs are shown
 */
export const logger = {
  /**
   * Debug level - for verbose debugging info
   * Only shows in development
   */
  debug: (message: string, ...args: unknown[]) => {
    if (isDev) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  },

  /**
   * Info level - for general information
   * Only shows in development
   */
  info: (message: string, ...args: unknown[]) => {
    if (isDev) {
      console.log(`[INFO] ${message}`, ...args);
    }
  },

  /**
   * Warn level - for warnings that might need attention
   * Only shows in development
   */
  warn: (message: string, ...args: unknown[]) => {
    if (isDev) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  },

  /**
   * Error level - for errors
   * Always shows (including production)
   */
  error: (message: string, ...args: unknown[]) => {
    console.error(`[ERROR] ${message}`, ...args);
  },

  /**
   * Log with custom prefix/tag
   * Only shows in development
   */
  tagged: (tag: string, message: string, ...args: unknown[]) => {
    if (isDev) {
      console.log(`[${tag}] ${message}`, ...args);
    }
  },

  /**
   * Force log even in production (use very sparingly)
   */
  force: (message: string, ...args: unknown[]) => {
    console.log(message, ...args);
  },

  /**
   * Create a scoped logger with a prefix
   */
  scope: (prefix: string) => ({
    debug: (message: string, ...args: unknown[]) => logger.tagged(prefix, message, ...args),
    info: (message: string, ...args: unknown[]) => logger.tagged(prefix, message, ...args),
    warn: (message: string, ...args: unknown[]) => {
      if (isDev) console.warn(`[${prefix}] ${message}`, ...args);
    },
    error: (message: string, ...args: unknown[]) => console.error(`[${prefix}] ${message}`, ...args),
  }),
};

// Scoped loggers for common areas
export const realtimeLogger = logger.scope('Realtime');
export const authLogger = logger.scope('Auth');
export const enrichmentLogger = logger.scope('Enrichment');
export const scoringLogger = logger.scope('Scoring');
export const apiLogger = logger.scope('API');

export default logger;
