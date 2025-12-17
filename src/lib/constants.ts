/**
 * Application-wide constants
 * Centralizes magic numbers and configuration values
 */

// ============= Pagination =============
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 25,
  ACCOUNTS_PAGE_SIZE: 25,
  LEADS_PAGE_SIZE: 50,
  MAX_EXPORT_RECORDS: 50000,
} as const;

// ============= Timing (milliseconds) =============
export const TIMING = {
  // Polling intervals
  INSIGHTS_REFRESH_INTERVAL: 5 * 60 * 1000, // 5 minutes
  ENRICHMENT_POLL_INTERVAL: 2000, // 2 seconds
  REALTIME_DEBOUNCE: 500,
  SEARCH_DEBOUNCE: 300,
  
  // Timeouts
  JOB_STALL_THRESHOLD: 5 * 60 * 1000, // 5 minutes
  AUTO_RESUME_DELAY: 2000,
  TOAST_DURATION: 5000,
  
  // Animation delays
  FADE_DURATION: 300,
} as const;

// ============= AI & Enrichment =============
export const ENRICHMENT = {
  DEFAULT_BATCH_SIZE: 500,
  MAX_BATCH_SIZE: 1000,
  DEFAULT_CONCURRENCY: 5,
  MAX_RETRY_COUNT: 3,
  
  // Confidence thresholds
  HIGH_CONFIDENCE: 0.8,
  MEDIUM_CONFIDENCE: 0.5,
  LOW_CONFIDENCE: 0.3,
} as const;

// ============= Scoring =============
export const SCORING = {
  HIGH_FIT_THRESHOLD: 70,
  MEDIUM_FIT_THRESHOLD: 40,
  
  // Data quality thresholds
  HIGH_QUALITY_THRESHOLD: 80,
  MEDIUM_QUALITY_THRESHOLD: 50,
  
  // Required fields for quality calculation
  QUALITY_FIELDS: ['name', 'domain', 'industry_norm', 'employee_count', 'revenue_range', 'country'] as const,
} as const;

// ============= Data Sources =============
export const DATA_SOURCES = {
  CRM_TYPES: ['crm', 'both', 'closed_won'] as const,
  DATABASE_TYPE: 'database' as const,
} as const;

// ============= Rate Limiting =============
export const RATE_LIMITS = {
  DEFAULT_MAX_REQUESTS: 100,
  DEFAULT_WINDOW_SECONDS: 60,
  AI_ENDPOINT_MAX_REQUESTS: 30,
  AI_ENDPOINT_WINDOW_SECONDS: 60,
} as const;

// ============= UI Constants =============
export const UI = {
  // Table row heights
  TABLE_ROW_HEIGHT: 48,
  COMPACT_TABLE_ROW_HEIGHT: 36,
  
  // Max items before truncation
  MAX_VISIBLE_TAGS: 3,
  MAX_VISIBLE_REASONS: 5,
  
  // Chart dimensions
  DEFAULT_CHART_HEIGHT: 300,
  MINI_CHART_HEIGHT: 150,
} as const;

// ============= Error Codes =============
export const ERROR_CODES = {
  // Client errors
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  
  // Server errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  
  // Domain-specific
  JOB_NOT_FOUND: 'JOB_NOT_FOUND',
  JOB_ALREADY_RUNNING: 'JOB_ALREADY_RUNNING',
  ENRICHMENT_FAILED: 'ENRICHMENT_FAILED',
  SCORING_FAILED: 'SCORING_FAILED',
  AI_PROVIDER_ERROR: 'AI_PROVIDER_ERROR',
} as const;
