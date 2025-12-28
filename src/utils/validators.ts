/**
 * Runtime Type Validation Utilities
 * 
 * Provides runtime validation for API responses and data structures
 * to ensure type safety at runtime, not just compile time.
 */

import type { Student, Goal, Session, Activity, Evaluation, School, Teacher, CaseManager } from '../types';
import { logError } from './logger';

/**
 * Type guard to check if a value is a string
 */
function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Type guard to check if a value is a number
 */
function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value);
}

/**
 * Type guard to check if a value is a boolean
 */
function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

/**
 * Type guard to check if a value is an array
 */
function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/**
 * Type guard to check if a value is an object (and not null/array)
 */
function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Validates a Student object
 */
export function validateStudent(data: unknown): data is Student {
  if (!isObject(data)) return false;
  
  return (
    isString(data.id) &&
    isString(data.name) &&
    isNumber(data.age) &&
    isString(data.grade) &&
    isArray(data.concerns) &&
    isString(data.status) &&
    (data.status === 'active' || data.status === 'discharged') &&
    isString(data.dateAdded) &&
    isString(data.school)
  );
}

/**
 * Validates a Goal object
 */
export function validateGoal(data: unknown): data is Goal {
  if (!isObject(data)) return false;
  
  return (
    isString(data.id) &&
    isString(data.studentId) &&
    isString(data.description) &&
    isString(data.baseline) &&
    isString(data.target) &&
    isString(data.status) &&
    (data.status === 'in-progress' || data.status === 'achieved' || data.status === 'modified') &&
    isString(data.dateCreated)
  );
}

/**
 * Validates a Session object
 */
export function validateSession(data: unknown): data is Session {
  if (!isObject(data)) return false;
  
  return (
    isString(data.id) &&
    isString(data.studentId) &&
    isString(data.date) &&
    isArray(data.goalsTargeted) &&
    isArray(data.activitiesUsed) &&
    isArray(data.performanceData) &&
    isString(data.notes)
  );
}

/**
 * Validates an array of items using a validator function
 */
export function validateArray<T>(
  data: unknown,
  validator: (item: unknown) => item is T
): data is T[] {
  if (!isArray(data)) return false;
  return data.every(validator);
}

/**
 * Safely validates API response and logs errors if validation fails
 * Returns the validated data or null if validation fails
 */
export function validateApiResponse<T>(
  data: unknown,
  validator: (item: unknown) => item is T,
  context: string = 'API response'
): T | null {
  try {
    if (validator(data)) {
      return data;
    } else {
      logError(`Invalid ${context}`, new Error(`Validation failed for ${context}`));
      return null;
    }
  } catch (error) {
    logError(`Error validating ${context}`, error);
    return null;
  }
}

/**
 * Validates an array API response
 */
export function validateApiArrayResponse<T>(
  data: unknown,
  itemValidator: (item: unknown) => item is T,
  context: string = 'API array response'
): T[] | null {
  try {
    if (isArray(data)) {
      const validated = data.filter((item): item is T => itemValidator(item));
      if (validated.length !== data.length) {
        logError(`Some items in ${context} failed validation`, new Error(`Expected all items to be valid`));
      }
      return validated;
    } else {
      logError(`Invalid ${context}: expected array`, new Error(`Validation failed for ${context}`));
      return null;
    }
  } catch (error) {
    logError(`Error validating ${context}`, error);
    return null;
  }
}

/**
 * Type-safe error handler
 * Converts unknown error to Error or returns a default message
 */
export function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  if (isString(error)) {
    return new Error(error);
  }
  if (isObject(error) && isString(error.message)) {
    return new Error(error.message);
  }
  return new Error('An unknown error occurred');
}

/**
 * Gets error message from unknown error type
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (isString(error)) {
    return error;
  }
  if (isObject(error) && isString(error.message)) {
    return error.message;
  }
  return 'An unknown error occurred';
}

