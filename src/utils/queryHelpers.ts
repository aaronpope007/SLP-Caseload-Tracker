/**
 * Utility functions for building query strings
 */

/**
 * Build a query string from an object of parameters
 * Filters out undefined and null values
 * 
 * @param params - Object with query parameters
 * @returns Query string (e.g., "?key1=value1&key2=value2") or empty string
 * 
 * @example
 * buildQueryString({ studentId: '123', school: 'School Name' })
 * // Returns: "?studentId=123&school=School%20Name"
 */
export function buildQueryString(
  params: Record<string, string | number | undefined | null>
): string {
  const searchParams = new URLSearchParams();
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  });
  
  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

