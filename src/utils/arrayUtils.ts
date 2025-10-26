/**
 * Utility functions for safe array operations
 */

/**
 * Ensures the value is an array. If not, wraps it in an array or returns empty array.
 * @param value - Value that may or may not be an array
 * @returns Always returns an array
 */
export function ensureArray<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

/**
 * Safely extracts data from a service response that may have { success, data } shape
 * @param response - Response from service that might be { success, data } or direct data
 * @returns Array of items, always safe to map
 */
export function extractArrayData<T>(response: any): T[] {
  // Handle null/undefined
  if (response == null) return [];

  // Handle { success: true, data: [...] } shape
  if (typeof response === 'object' && 'data' in response) {
    return ensureArray(response.data);
  }

  // Handle direct array
  return ensureArray(response);
}

/**
 * Type guard to check if value is an array
 */
export const isArray = Array.isArray;
