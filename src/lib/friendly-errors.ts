/**
 * Converts technical error messages to user-friendly messages
 * These are shown in toasts and error displays
 */

const ERROR_MAPPINGS: Record<string, string> = {
  // Database errors
  'statement timeout': 'Processing a large dataset. This may take a few minutes.',
  'PGRST116': 'Unable to find the requested data. Please try again.',
  'column': 'We\'re updating our system. Please try again shortly.',
  'violates row-level security': 'Unable to save changes. Please contact support if this continues.',
  'infinite recursion': 'A configuration error occurred. Please contact support.',
  
  // Network errors
  'Failed to fetch': 'Connection issue. We\'ll retry automatically.',
  'NetworkError': 'Connection issue. Please check your internet connection.',
  'timeout': 'The request took too long. Please try again.',
  'ECONNREFUSED': 'Unable to connect to our servers. Please try again.',
  
  // Edge function errors
  '500': 'Our servers are busy. Please try again in a moment.',
  '502': 'Our servers are updating. Please try again in a moment.',
  '503': 'Service temporarily unavailable. Please try again shortly.',
  '504': 'The request took too long. Please try again.',
  'edge function': 'Our servers are busy. Please try again in a moment.',
  
  // Auth errors
  'JWT': 'Your session has expired. Please refresh the page.',
  'unauthorized': 'Please sign in to continue.',
  'forbidden': 'You don\'t have permission to perform this action.',
  
  // Rate limiting
  'rate limit': 'Too many requests. Please wait a moment and try again.',
  'too many requests': 'Too many requests. Please wait a moment and try again.',
  
  // Generic fallbacks
  'unknown': 'Something went wrong. Please try again.',
};

/**
 * Convert a technical error message to a user-friendly message
 */
export function friendlyErrorMessage(error: string | null | undefined): string {
  if (!error) {
    return 'Something went wrong. Please try again.';
  }
  
  const lowerError = error.toLowerCase();
  
  // Check each mapping
  for (const [key, friendlyMessage] of Object.entries(ERROR_MAPPINGS)) {
    if (lowerError.includes(key.toLowerCase())) {
      return friendlyMessage;
    }
  }
  
  // If the error is already reasonably friendly (short and no technical terms), use it
  if (error.length < 100 && !containsTechnicalTerms(error)) {
    return error;
  }
  
  // Default fallback
  return 'Something went wrong. Please try again.';
}

/**
 * Check if a message contains technical terms that shouldn't be shown to users
 */
function containsTechnicalTerms(message: string): boolean {
  const technicalTerms = [
    'sql', 'postgres', 'supabase', 'rpc', 'rls', 'jwt', 
    'function', 'edge', 'api', 'http', 'json', 'null',
    'undefined', 'exception', 'stack', 'trace', 'error at',
    'cannot read', 'is not defined', 'unexpected token',
    'syntax error', 'type error', 'reference error'
  ];
  
  const lowerMessage = message.toLowerCase();
  return technicalTerms.some(term => lowerMessage.includes(term));
}

/**
 * Log the original error while showing a friendly message
 */
export function handleError(error: unknown, context?: string): string {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  // Log the full error for debugging
  console.error(`[${context || 'Error'}]`, error);
  
  // Return friendly message for display
  return friendlyErrorMessage(errorMessage);
}

/**
 * Get a user-friendly error message for use in toasts
 * Logs the original error and returns a friendly message
 */
export function toastError(error: unknown, fallback = 'Operation failed'): string {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  // Log the full error for debugging
  console.error('[Error]', error);
  
  // Return friendly message for display
  return friendlyErrorMessage(errorMessage) || fallback;
}
