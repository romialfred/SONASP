import { supabase } from '@/lib/supabase';
import type { PermissionMap } from '@/services/userPermissionsService';

export interface CreateUserRequest {
  email: string;
  full_name: string;
  phone?: string;
  role: string;
  is_active?: boolean;
  mining_company_id?: string | null;
  permissions?: PermissionMap;
}

export interface CreateUserResponse {
  success: boolean;
  user?: {
    id: string;
    email: string;
    full_name: string;
    role: string;
  };
  email_sent?: boolean;
  requires_password_change?: boolean;
  requires_mfa_enrollment?: boolean;
  message?: string;
  error?: string;
}

/**
 * Create a new user via Edge Function
 */
export async function createUser(data: CreateUserRequest): Promise<CreateUserResponse> {
  const controleur = new AbortController();
  const delai = window.setTimeout(() => controleur.abort(), 25_000);
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error('Not authenticated');
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !anonKey) {
      throw new Error('La connexion au service d’administration n’est pas configurée.');
    }

    const response = await fetch(
      `${supabaseUrl}/functions/v1/create-user`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': anonKey,
          'Content-Type': 'application/json',
          'X-Client-Info': 'sonasp-account-administration',
        },
        body: JSON.stringify(data),
        signal: controleur.signal,
      }
    );

    const result = await response.json().catch(() => ({})) as CreateUserResponse;

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Le service de création de compte n’est pas déployé. Contactez l’administrateur technique.');
      }
      throw new Error(result.error || 'La création du compte a échoué. Réessayez dans un instant.');
    }

    return result;
  } catch (error: any) {
    const estDelai = error?.name === 'AbortError';
    const estReseau = error instanceof TypeError;
    return {
      success: false,
      error: estDelai
        ? 'Le service de création ne répond pas. Aucun compte n’a été validé.'
        : estReseau
          ? 'Le service de création de compte est momentanément inaccessible.'
          : error.message || 'Une erreur inattendue est survenue.',
    };
  } finally {
    window.clearTimeout(delai);
  }
}

/**
 * Reset user password via Edge Function
 */
export async function resetUserPassword(userId: string): Promise<CreateUserResponse> {
  try {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error('Not authenticated');
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    if (!supabaseUrl) {
      throw new Error('Supabase URL not configured');
    }

    console.log('[userManagementService] Resetting password for user:', userId);

    const response = await fetch(
      `${supabaseUrl}/functions/v1/reset-user-password`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: userId }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error('[userManagementService] Error response:', result);
      throw new Error(result.error || 'Failed to reset password');
    }

    console.log('[userManagementService] Password reset successfully:', result);
    return result;
  } catch (error: any) {
    console.error('[userManagementService] Error resetting password:', error);
    return {
      success: false,
      error: error.message || 'An unexpected error occurred',
    };
  }
}

/**
 * Check if user activation system is available
 */
export async function checkActivationSystemAvailable(): Promise<boolean> {
  try {
    // Check if the activation token function exists
    const { error } = await supabase.rpc('validate_activation_token', {
      p_token: 'test_token',
    });

    // If no error (function exists), return true
    // Even if the token is invalid, the function exists
    return !error || !error.message.includes('function');
  } catch (error) {
    console.warn('[userManagementService] Activation system not available:', error);
    return false;
  }
}
