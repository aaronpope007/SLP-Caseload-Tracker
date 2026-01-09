/**
 * Utility functions for parsing JSON fields from database
 */

/**
 * Safely parse a JSON string field from the database
 * @param value - The JSON string from database (or null/undefined)
 * @param defaultValue - Default value if parsing fails or value is null
 * @returns Parsed value or default
 */
export function parseJsonField<T>(value: string | null | undefined, defaultValue: T): T;
export function parseJsonField<T>(value: string | null | undefined, defaultValue?: undefined): T | undefined;
export function parseJsonField<T>(value: string | null | undefined, defaultValue?: T): T | undefined {
  if (!value) return defaultValue;
  try {
    return JSON.parse(value) as T;
  } catch {
    return defaultValue;
  }
}

/**
 * Convert a value to JSON string for database storage
 * @param value - Value to stringify
 * @returns JSON string or null if value is null/undefined
 */
export function stringifyJsonField(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}
