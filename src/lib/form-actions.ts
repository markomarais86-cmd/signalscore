// Form action utilities for React 19 useActionState pattern

export interface FormState<T = unknown> {
  success: boolean;
  error: string | null;
  data?: T;
}

export const initialFormState: FormState = {
  success: false,
  error: null,
};

export function createFormState<T>(data?: T): FormState<T> {
  return {
    success: true,
    error: null,
    data,
  };
}

export function createErrorState(error: string): FormState {
  return {
    success: false,
    error,
  };
}

// Validation helpers
export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validatePassword(password: string, minLength = 8): boolean {
  return password.length >= minLength;
}

// Extract form data helper
export function getFormValue(formData: FormData, key: string): string {
  return (formData.get(key) as string) || '';
}
