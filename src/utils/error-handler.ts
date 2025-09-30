export interface AppError {
  message: string;
  code?: string;
  details?: string;
}

export function handleError(error: unknown): AppError {
  // Handle Supabase errors
  if (error && typeof error === 'object' && 'message' in error) {
    const err = error as { message: string; code?: string; details?: string };
    
    // Common database errors
    if (err.code === '23505') {
      return {
        message: 'This record already exists',
        code: err.code,
        details: 'A record with this identifier already exists in the database'
      };
    }
    
    if (err.code === '23503') {
      return {
        message: 'Referenced record not found',
        code: err.code,
        details: 'This record references another record that does not exist'
      };
    }
    
    if (err.message?.includes('duplicate key')) {
      return {
        message: 'Duplicate record detected',
        details: 'Some records already exist and will be updated'
      };
    }
    
    if (err.message?.includes('violates foreign key constraint')) {
      return {
        message: 'Invalid reference',
        details: 'This record references data that does not exist'
      };
    }

    if (err.message?.includes('permission denied') || err.message?.includes('JWT')) {
      return {
        message: 'Access denied',
        details: 'You do not have permission to perform this action'
      };
    }

    return {
      message: err.message,
      code: err.code,
      details: err.details
    };
  }

  // Handle generic errors
  if (error instanceof Error) {
    return {
      message: error.message,
    };
  }

  // Handle unknown errors
  return {
    message: 'An unexpected error occurred',
    details: 'Please try again or contact support if the problem persists'
  };
}

export function getErrorMessage(error: unknown): string {
  const appError = handleError(error);
  return appError.details 
    ? `${appError.message}: ${appError.details}`
    : appError.message;
}