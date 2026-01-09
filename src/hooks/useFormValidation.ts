import { useState, useCallback } from 'react';
import { ApiError } from '../utils/api';

/**
 * Validation error detail (matches API response format)
 */
interface ValidationErrorDetail {
  field: string;
  message: string;
}

/**
 * Form validation state and helpers
 * 
 * Usage:
 * ```tsx
 * const { fieldErrors, setFieldErrors, hasError, getError, clearError, handleApiError, clearAllErrors } = useFormValidation();
 * 
 * // In your submit handler:
 * try {
 *   await api.students.create(data);
 * } catch (error) {
 *   if (handleApiError(error)) {
 *     // Validation errors are now in fieldErrors
 *     return;
 *   }
 *   // Handle other errors
 * }
 * 
 * // In your form:
 * <TextField
 *   error={hasError('name')}
 *   helperText={getError('name')}
 *   onChange={() => clearError('name')}
 * />
 * ```
 */
export function useFormValidation() {
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  /**
   * Check if a field has an error
   */
  const hasError = useCallback((fieldName: string): boolean => {
    return !!fieldErrors[fieldName];
  }, [fieldErrors]);

  /**
   * Get the error message for a field
   */
  const getError = useCallback((fieldName: string): string | undefined => {
    return fieldErrors[fieldName];
  }, [fieldErrors]);

  /**
   * Clear error for a specific field (call on field change)
   */
  const clearError = useCallback((fieldName: string) => {
    setFieldErrors(prev => {
      if (prev[fieldName]) {
        const { [fieldName]: _, ...rest } = prev;
        return rest;
      }
      return prev;
    });
  }, []);

  /**
   * Clear all field errors
   */
  const clearAllErrors = useCallback(() => {
    setFieldErrors({});
  }, []);

  /**
   * Handle an API error, extracting validation errors if present
   * Returns true if validation errors were found and set
   */
  const handleApiError = useCallback((error: unknown): boolean => {
    if (error instanceof ApiError && error.isValidationError() && error.validationErrors) {
      const errors: Record<string, string> = {};
      error.validationErrors.forEach((e: ValidationErrorDetail) => {
        errors[e.field] = e.message;
      });
      setFieldErrors(errors);
      return true;
    }
    return false;
  }, []);

  /**
   * Set field errors from an array of validation details
   */
  const setValidationErrors = useCallback((errors: ValidationErrorDetail[]) => {
    const errorMap: Record<string, string> = {};
    errors.forEach(e => {
      errorMap[e.field] = e.message;
    });
    setFieldErrors(errorMap);
  }, []);

  return {
    fieldErrors,
    setFieldErrors,
    hasError,
    getError,
    clearError,
    clearAllErrors,
    handleApiError,
    setValidationErrors,
  };
}

export default useFormValidation;

