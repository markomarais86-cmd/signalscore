import { getCorsHeaders } from './cors.ts';

/**
 * Standard API response format for all edge functions
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Create a successful JSON response with proper CORS headers
 */
export function successResponse<T>(data: T, status = 200, origin: string | null = null): Response {
  const body: ApiResponse<T> = {
    success: true,
    data,
  };
  
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...getCorsHeaders(origin),
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Create an error JSON response with proper CORS headers
 */
export function errorResponse(
  code: string,
  message: string,
  status = 400,
  details?: unknown,
  origin: string | null = null
): Response {
  const body: ApiResponse = {
    success: false,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  };
  
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...getCorsHeaders(origin),
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Handle CORS preflight requests with proper origin validation
 */
export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    const origin = req.headers.get('origin');
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(origin),
    });
  }
  return null;
}

/**
 * Common error codes for consistent error handling
 */
export const ErrorCodes = {
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

/**
 * Helper to safely parse JSON request body
 */
export async function parseJsonBody<T = Record<string, unknown>>(req: Request): Promise<T | null> {
  try {
    const text = await req.text();
    if (!text) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/**
 * Validate required fields in request body
 */
export function validateRequired(
  body: Record<string, unknown> | null,
  requiredFields: string[]
): { valid: true; } | { valid: false; missing: string[] } {
  if (!body) {
    return { valid: false, missing: requiredFields };
  }
  
  const missing = requiredFields.filter(field => 
    body[field] === undefined || body[field] === null
  );
  
  if (missing.length > 0) {
    return { valid: false, missing };
  }
  
  return { valid: true };
}
