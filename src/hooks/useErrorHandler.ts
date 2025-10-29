/**
 * Error Handler Hook
 *
 * Provides comprehensive error handling for database operations,
 * API calls, and validation errors with user-friendly messages.
 *
 * Features:
 * - Automatic error parsing and translation
 * - User-friendly error messages
 * - Detailed logging for debugging
 * - Integration with notification system
 * - Multilingual support
 */

import { useState, useCallback } from 'react';
import { PostgrestError } from '@supabase/supabase-js';

export interface ErrorDetails {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
  originalError?: unknown;
}

export interface UseErrorHandlerReturn {
  error: ErrorDetails | null;
  handleError: (error: unknown, context?: string) => void;
  clearError: () => void;
  isError: boolean;
}

/**
 * Error message translations
 */
const ERROR_MESSAGES: Record<string, string> = {
  // PostgreSQL constraint errors
  '23505': 'This record already exists in the database',
  '23503': 'Cannot perform this action because it would break data relationships',
  '23502': 'Required field is missing',
  '23514': 'Data validation failed - please check your input values',

  // Custom constraint errors
  'check_weight_positive': 'Weight must be a positive number',
  'check_airport_weight_positive': 'Airport weight must be a positive number',
  'check_refinery_weight_positive': 'Refinery weight must be a positive number',
  'check_melting_weights_positive': 'Melting weights must be positive and weight after melting must be less than weight before',
  'check_fineness_range': 'Fineness must be between 0 and 100%',
  'check_metal_retained_range': 'Metal retained must be between 0 and 100%',

  // Status transition errors
  'Invalid status transition': 'This status change is not allowed in the workflow',
  'Permission denied': 'You do not have permission to perform this action',
  'Shipping date cannot be in the future': 'Shipping date must be today or in the past',
  'Airport receipt date cannot be before shipping date': 'Airport receipt must be after shipping date',
  'Refinery receipt date cannot be before airport receipt date': 'Refinery receipt must be after airport receipt',
  'Cannot set batch status to in_inventory': 'Use the Add Inventory Entry form to move batches to inventory',

  // Variance errors
  'variance': 'Weight variance exceeds acceptable limits',

  // Generic errors
  'PGRST116': 'No data found matching your request',
  'PGRST301': 'You do not have permission to access this resource',
  'auth/user-not-found': 'Authentication failed - user not found',
  'auth/invalid-credentials': 'Invalid email or password',
  'network': 'Network error - please check your connection',
};

/**
 * Parse Supabase/PostgreSQL error
 */
function parseSupabaseError(error: PostgrestError): ErrorDetails {
  const { message, code, details, hint } = error;

  // Look for custom error message
  let userMessage = message;

  // Check for PostgreSQL error codes
  if (code && ERROR_MESSAGES[code]) {
    userMessage = ERROR_MESSAGES[code];
  }

  // Check for constraint violations in message
  for (const [key, value] of Object.entries(ERROR_MESSAGES)) {
    if (message.toLowerCase().includes(key.toLowerCase())) {
      userMessage = value;
      break;
    }
  }

  return {
    message: userMessage,
    code,
    details,
    hint,
    originalError: error
  };
}

/**
 * Parse generic error
 */
function parseGenericError(error: unknown): ErrorDetails {
  if (error instanceof Error) {
    // Check for known error patterns
    const errorMessage = error.message.toLowerCase();

    for (const [key, value] of Object.entries(ERROR_MESSAGES)) {
      if (errorMessage.includes(key.toLowerCase())) {
        return {
          message: value,
          details: error.message,
          originalError: error
        };
      }
    }

    return {
      message: error.message,
      originalError: error
    };
  }

  if (typeof error === 'string') {
    return {
      message: error,
      originalError: error
    };
  }

  return {
    message: 'An unexpected error occurred',
    originalError: error
  };
}

/**
 * Format error for logging
 */
function formatErrorForLogging(error: ErrorDetails, context?: string): string {
  const parts = ['ERROR'];

  if (context) {
    parts.push(`[${context}]`);
  }

  parts.push(error.message);

  if (error.code) {
    parts.push(`(Code: ${error.code})`);
  }

  if (error.details) {
    parts.push(`\nDetails: ${error.details}`);
  }

  if (error.hint) {
    parts.push(`\nHint: ${error.hint}`);
  }

  return parts.join(' ');
}

/**
 * Custom hook for error handling
 */
export function useErrorHandler(): UseErrorHandlerReturn {
  const [error, setError] = useState<ErrorDetails | null>(null);

  const handleError = useCallback((error: unknown, context?: string) => {
    let parsedError: ErrorDetails;

    // Parse based on error type
    if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
      // Supabase/PostgreSQL error
      parsedError = parseSupabaseError(error as PostgrestError);
    } else {
      // Generic error
      parsedError = parseGenericError(error);
    }

    // Log to console for debugging
    console.error(formatErrorForLogging(parsedError, context));

    // Set error state
    setError(parsedError);

    // Return parsed error for immediate use
    return parsedError;
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    error,
    handleError,
    clearError,
    isError: error !== null
  };
}

/**
 * Error boundary wrapper for async operations
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  handler: (error: unknown) => void,
  context?: string
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    handler(error);
    console.error(`Error in ${context || 'operation'}:`, error);
    return null;
  }
}

/**
 * Retry operation with exponential backoff
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries - 1) {
        const delay = initialDelay * Math.pow(2, attempt);
        console.log(`Retry attempt ${attempt + 1} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Check if error is network related
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return message.includes('network') ||
           message.includes('fetch') ||
           message.includes('connection') ||
           message.includes('timeout');
  }
  return false;
}

/**
 * Check if error is authentication related
 */
export function isAuthError(error: unknown): boolean {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code: string }).code;
    return code?.startsWith('auth/') ||
           code === 'PGRST301' ||
           code === '401';
  }
  return false;
}

/**
 * Check if error is validation related
 */
export function isValidationError(error: unknown): boolean {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code: string }).code;
    return code?.startsWith('23') || // PostgreSQL constraint violations
           code === 'PGRST204'; // Supabase validation error
  }
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return message.includes('validation') ||
           message.includes('invalid') ||
           message.includes('must be') ||
           message.includes('required');
  }
  return false;
}

/**
 * Get user-friendly error action
 */
export function getErrorAction(error: ErrorDetails): string {
  if (isNetworkError(error.originalError)) {
    return 'Please check your internet connection and try again.';
  }

  if (isAuthError(error.originalError)) {
    return 'Please log in again to continue.';
  }

  if (isValidationError(error.originalError)) {
    return 'Please review your input and correct any errors.';
  }

  if (error.hint) {
    return error.hint;
  }

  return 'Please try again or contact support if the problem persists.';
}

/**
 * Format error for user display
 */
export function formatErrorMessage(error: ErrorDetails): string {
  const parts = [error.message];

  const action = getErrorAction(error);
  if (action) {
    parts.push(action);
  }

  return parts.join('\n\n');
}
