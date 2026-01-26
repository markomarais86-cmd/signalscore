/**
 * Input validation utilities for edge functions
 * Provides runtime validation to prevent malformed inputs and resource exhaustion
 */

// UUID regex pattern
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Email regex pattern (basic validation)
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Domain regex pattern - validates standard domain format
const DOMAIN_REGEX = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i;

// Control character regex for sanitization
const CONTROL_CHARS_REGEX = /[\x00-\x1F\x7F]/g;

/**
 * Validation error class
 */
export class ValidationError extends Error {
  public field: string;
  public code: string;

  constructor(message: string, field: string, code: string = 'VALIDATION_ERROR') {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.code = code;
  }
}

/**
 * Validate that a value is a valid UUID
 */
export function validateUUID(value: unknown, fieldName: string): string {
  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName} must be a string`, fieldName, 'INVALID_TYPE');
  }
  if (!UUID_REGEX.test(value)) {
    throw new ValidationError(`${fieldName} must be a valid UUID`, fieldName, 'INVALID_UUID');
  }
  return value;
}

/**
 * Validate that a value is a non-empty string with max length
 */
export function validateString(
  value: unknown, 
  fieldName: string, 
  options: { minLength?: number; maxLength?: number; required?: boolean } = {}
): string | undefined {
  const { minLength = 0, maxLength = 10000, required = false } = options;

  if (value === undefined || value === null) {
    if (required) {
      throw new ValidationError(`${fieldName} is required`, fieldName, 'REQUIRED');
    }
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName} must be a string`, fieldName, 'INVALID_TYPE');
  }

  if (value.length < minLength) {
    throw new ValidationError(
      `${fieldName} must be at least ${minLength} characters`, 
      fieldName, 
      'TOO_SHORT'
    );
  }

  if (value.length > maxLength) {
    throw new ValidationError(
      `${fieldName} must be at most ${maxLength} characters`, 
      fieldName, 
      'TOO_LONG'
    );
  }

  return value;
}

/**
 * Validate that a value is a valid email
 */
export function validateEmail(value: unknown, fieldName: string, required: boolean = true): string | undefined {
  if (value === undefined || value === null) {
    if (required) {
      throw new ValidationError(`${fieldName} is required`, fieldName, 'REQUIRED');
    }
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName} must be a string`, fieldName, 'INVALID_TYPE');
  }

  if (!EMAIL_REGEX.test(value)) {
    throw new ValidationError(`${fieldName} must be a valid email address`, fieldName, 'INVALID_EMAIL');
  }

  if (value.length > 255) {
    throw new ValidationError(`${fieldName} must be at most 255 characters`, fieldName, 'TOO_LONG');
  }

  return value.toLowerCase();
}

/**
 * Validate that a value is a valid domain name
 * Prevents SSRF, injection, and malformed domain attacks
 */
export function validateDomain(value: unknown, fieldName: string, required: boolean = false): string | undefined {
  if (value === undefined || value === null || value === '') {
    if (required) {
      throw new ValidationError(`${fieldName} is required`, fieldName, 'REQUIRED');
    }
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName} must be a string`, fieldName, 'INVALID_TYPE');
  }

  // Length check first - prevent resource exhaustion
  if (value.length > 255) {
    throw new ValidationError(`${fieldName} must be at most 255 characters`, fieldName, 'TOO_LONG');
  }

  // Normalize: trim, lowercase, remove protocol prefixes
  let normalized = value.trim().toLowerCase();
  normalized = normalized.replace(/^(https?:\/\/|\/\/)/i, '');
  normalized = normalized.replace(/^www\./i, '');
  normalized = normalized.replace(/\/.*$/, ''); // Remove paths
  normalized = normalized.replace(/\.$/, ''); // Remove trailing dot

  // Check for SSRF attempts (internal IP ranges, localhost, metadata endpoints)
  const ssrfPatterns = [
    /^localhost$/i,
    /^127\./,
    /^10\./,
    /^192\.168\./,
    /^172\.(1[6-9]|2[0-9]|3[01])\./,
    /^169\.254\./,  // AWS metadata
    /^0\./,
    /^\[/,  // IPv6
    /^metadata\./i,
    /^internal\./i,
  ];

  for (const pattern of ssrfPatterns) {
    if (pattern.test(normalized)) {
      throw new ValidationError(`${fieldName} contains invalid domain pattern`, fieldName, 'INVALID_DOMAIN');
    }
  }

  // Validate domain format
  if (!DOMAIN_REGEX.test(normalized)) {
    throw new ValidationError(`${fieldName} must be a valid domain (e.g., example.com)`, fieldName, 'INVALID_DOMAIN');
  }

  return normalized;
}

/**
 * Sanitize text by removing control characters
 * Used for company names, titles, etc. before API calls or database storage
 */
export function sanitizeText(value: unknown, fieldName: string, options: { 
  maxLength?: number; 
  required?: boolean;
  allowHtml?: boolean;
} = {}): string | undefined {
  const { maxLength = 500, required = false, allowHtml = false } = options;

  if (value === undefined || value === null || value === '') {
    if (required) {
      throw new ValidationError(`${fieldName} is required`, fieldName, 'REQUIRED');
    }
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName} must be a string`, fieldName, 'INVALID_TYPE');
  }

  if (value.length > maxLength) {
    throw new ValidationError(`${fieldName} must be at most ${maxLength} characters`, fieldName, 'TOO_LONG');
  }

  // Remove control characters
  let sanitized = value.replace(CONTROL_CHARS_REGEX, '');

  // Remove HTML tags if not allowed (basic XSS prevention)
  if (!allowHtml) {
    sanitized = sanitized.replace(/<[^>]*>/g, '');
  }

  // Trim whitespace
  sanitized = sanitized.trim();

  return sanitized;
}

/**
 * Validate that a value is a number within a range
 */
export function validateNumber(
  value: unknown,
  fieldName: string,
  options: { min?: number; max?: number; required?: boolean; integer?: boolean } = {}
): number | undefined {
  const { min, max, required = false, integer = false } = options;

  if (value === undefined || value === null) {
    if (required) {
      throw new ValidationError(`${fieldName} is required`, fieldName, 'REQUIRED');
    }
    return undefined;
  }

  const num = typeof value === 'string' ? parseFloat(value) : value;

  if (typeof num !== 'number' || isNaN(num)) {
    throw new ValidationError(`${fieldName} must be a number`, fieldName, 'INVALID_TYPE');
  }

  if (integer && !Number.isInteger(num)) {
    throw new ValidationError(`${fieldName} must be an integer`, fieldName, 'NOT_INTEGER');
  }

  if (min !== undefined && num < min) {
    throw new ValidationError(`${fieldName} must be at least ${min}`, fieldName, 'TOO_SMALL');
  }

  if (max !== undefined && num > max) {
    throw new ValidationError(`${fieldName} must be at most ${max}`, fieldName, 'TOO_LARGE');
  }

  return num;
}

/**
 * Validate that a value is an array with constraints
 */
export function validateArray<T>(
  value: unknown,
  fieldName: string,
  options: {
    minLength?: number;
    maxLength?: number;
    required?: boolean;
    itemValidator?: (item: unknown, index: number) => T;
  } = {}
): T[] | undefined {
  const { minLength = 0, maxLength = 100, required = false, itemValidator } = options;

  if (value === undefined || value === null) {
    if (required) {
      throw new ValidationError(`${fieldName} is required`, fieldName, 'REQUIRED');
    }
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new ValidationError(`${fieldName} must be an array`, fieldName, 'INVALID_TYPE');
  }

  if (value.length < minLength) {
    throw new ValidationError(
      `${fieldName} must have at least ${minLength} items`, 
      fieldName, 
      'TOO_FEW_ITEMS'
    );
  }

  if (value.length > maxLength) {
    throw new ValidationError(
      `${fieldName} must have at most ${maxLength} items`, 
      fieldName, 
      'TOO_MANY_ITEMS'
    );
  }

  if (itemValidator) {
    return value.map((item, index) => itemValidator(item, index));
  }

  return value as T[];
}

/**
 * Validate a string array with individual string constraints
 */
export function validateStringArray(
  value: unknown,
  fieldName: string,
  options: { 
    maxLength?: number; 
    maxItemLength?: number; 
    required?: boolean 
  } = {}
): string[] | undefined {
  const { maxLength = 50, maxItemLength = 200, required = false } = options;

  return validateArray(value, fieldName, {
    maxLength,
    required,
    itemValidator: (item, index) => {
      if (typeof item !== 'string') {
        throw new ValidationError(
          `${fieldName}[${index}] must be a string`, 
          `${fieldName}[${index}]`, 
          'INVALID_TYPE'
        );
      }
      if (item.length > maxItemLength) {
        throw new ValidationError(
          `${fieldName}[${index}] must be at most ${maxItemLength} characters`, 
          `${fieldName}[${index}]`, 
          'TOO_LONG'
        );
      }
      return item;
    },
  });
}

/**
 * Validate an enum value
 */
export function validateEnum<T extends string>(
  value: unknown,
  fieldName: string,
  allowedValues: readonly T[],
  required: boolean = true
): T | undefined {
  if (value === undefined || value === null) {
    if (required) {
      throw new ValidationError(`${fieldName} is required`, fieldName, 'REQUIRED');
    }
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new ValidationError(`${fieldName} must be a string`, fieldName, 'INVALID_TYPE');
  }

  if (!allowedValues.includes(value as T)) {
    throw new ValidationError(
      `${fieldName} must be one of: ${allowedValues.join(', ')}`, 
      fieldName, 
      'INVALID_ENUM'
    );
  }

  return value as T;
}

/**
 * Validate boolean value
 */
export function validateBoolean(
  value: unknown, 
  fieldName: string, 
  required: boolean = false
): boolean | undefined {
  if (value === undefined || value === null) {
    if (required) {
      throw new ValidationError(`${fieldName} is required`, fieldName, 'REQUIRED');
    }
    return undefined;
  }

  if (typeof value !== 'boolean') {
    throw new ValidationError(`${fieldName} must be a boolean`, fieldName, 'INVALID_TYPE');
  }

  return value;
}

/**
 * Parse and validate JSON body from request
 */
export async function parseAndValidateBody<T>(
  req: Request,
  validator: (body: unknown) => T
): Promise<T> {
  let body: unknown;
  
  try {
    body = await req.json();
  } catch {
    throw new ValidationError('Invalid JSON body', 'body', 'INVALID_JSON');
  }

  return validator(body);
}

/**
 * Create a validation error response
 */
export function validationErrorResponse(error: ValidationError, corsHeaders: Record<string, string>): Response {
  return new Response(
    JSON.stringify({
      error: 'Validation error',
      details: {
        field: error.field,
        message: error.message,
        code: error.code,
      },
    }),
    {
      status: 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    }
  );
}
