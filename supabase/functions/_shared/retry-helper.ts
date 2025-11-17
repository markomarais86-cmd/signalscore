/**
 * Retry configuration for enrichment operations
 */
export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterFactor: number;
}

/**
 * Default retry configuration with exponential backoff
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitterFactor: 0.1,
};

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
  const exponentialDelay = Math.min(
    config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt),
    config.maxDelayMs
  );
  
  // Add jitter to prevent thundering herd
  const jitter = exponentialDelay * config.jitterFactor * (Math.random() * 2 - 1);
  return Math.floor(exponentialDelay + jitter);
}

/**
 * Retry an async operation with exponential backoff
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  shouldRetry?: (error: Error, attempt: number) => boolean
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      // Check if we should retry
      if (attempt === config.maxRetries) {
        break;
      }
      
      // Allow custom retry logic
      if (shouldRetry && !shouldRetry(lastError, attempt)) {
        break;
      }
      
      // Calculate delay and wait
      const delay = calculateDelay(attempt, config);
      console.log(`Retry attempt ${attempt + 1}/${config.maxRetries} after ${delay}ms delay`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

/**
 * Check if error is retryable (network, timeout, rate limit)
 */
export function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();
  
  // Network errors
  if (message.includes('network') || message.includes('timeout') || message.includes('econnrefused')) {
    return true;
  }
  
  // Rate limit errors
  if (message.includes('rate limit') || message.includes('429')) {
    return true;
  }
  
  // Server errors (5xx)
  if (message.includes('500') || message.includes('502') || message.includes('503') || message.includes('504')) {
    return true;
  }
  
  return false;
}

/**
 * Enhanced retry for HTTP requests with rate limit handling
 */
export async function withHttpRetry<T>(
  operation: () => Promise<Response>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<Response> {
  return withRetry(
    operation,
    config,
    (error, attempt) => {
      // Always retry rate limits and server errors
      if (isRetryableError(error)) {
        return true;
      }
      
      // Don't retry client errors (4xx except 429)
      return false;
    }
  );
}
