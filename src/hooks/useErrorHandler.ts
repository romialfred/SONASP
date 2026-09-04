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
  '23505': 'Cet enregistrement existe déjà.',
  '23503': 'Cette action est impossible, car elle compromettrait l’intégrité des données liées.',
  '23502': 'Un champ obligatoire n’a pas été renseigné.',
  '23514': 'La validation des données a échoué. Vérifiez les valeurs saisies.',

  // Custom constraint errors
  'check_weight_positive': 'Le poids doit être un nombre positif.',
  'check_airport_weight_positive': 'Le poids constaté à l’aéroport doit être positif.',
  'check_refinery_weight_positive': 'Le poids constaté à la raffinerie doit être positif.',
  'check_melting_weights_positive': 'Les poids de fonte doivent être positifs et le poids après fonte doit être inférieur au poids avant fonte.',
  'check_fineness_range': 'La teneur doit être comprise entre 0 et 100 %.',
  'check_metal_retained_range': 'Le métal retenu doit être compris entre 0 et 100 %.',

  // Status transition errors
  'Invalid status transition': 'Ce changement de statut n’est pas autorisé dans le circuit de traitement.',
  'Permission denied': 'Vous ne disposez pas des autorisations nécessaires pour effectuer cette action.',
  'Shipping date cannot be in the future': 'La date d’expédition doit être égale ou antérieure à la date du jour.',
  'Airport receipt date cannot be before shipping date': 'La réception à l’aéroport doit être postérieure à l’expédition.',
  'Refinery receipt date cannot be before airport receipt date': 'La réception à la raffinerie doit être postérieure à la réception à l’aéroport.',
  'Cannot set batch status to in_inventory': 'Utilisez le formulaire d’entrée en stock pour transférer les lots vers l’inventaire.',

  // Variance errors
  'variance': 'L’écart de poids dépasse les limites admissibles.',

  // Generic errors
  'PGRST116': 'Aucune donnée ne correspond à votre demande.',
  'PGRST301': 'Vous ne disposez pas des autorisations nécessaires pour accéder à cette ressource.',
  'auth/user-not-found': 'Échec de l’authentification : utilisateur introuvable.',
  'auth/invalid-credentials': 'Adresse électronique ou mot de passe incorrect.',
  'network': 'Erreur réseau. Vérifiez votre connexion, puis réessayez.',
};

/**
 * Parse Supabase/PostgreSQL error
 */
function parseSupabaseError(error: PostgrestError): ErrorDetails {
  const { message, code, details, hint } = error;

  // Look for custom error message
  let userMessage = 'Une erreur est survenue lors du traitement de votre demande.';

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
      message: 'Une erreur est survenue lors du traitement de votre demande.',
      details: error.message,
      originalError: error
    };
  }

  if (typeof error === 'string') {
    return {
      message: 'Une erreur est survenue lors du traitement de votre demande.',
      details: error,
      originalError: error
    };
  }

  return {
    message: 'Une erreur inattendue est survenue.',
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
