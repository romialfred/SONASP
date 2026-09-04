import { supabase } from '@/lib/supabase';
import type { PermissionMap } from '@/services/userPermissionsService';
import type { OperationalCapabilityMap } from '@/lib/capabilities';
import type { UserRole } from '@/types/auth';

export interface CreateUserRequest {
  email: string;
  full_name: string;
  phone?: string;
  job_title?: string;
  department?: string;
  role: UserRole;
  is_active?: boolean;
  mining_company_id?: string | null;
  account_type?: string;
  organization_id?: string;
  organization_code?: string;
  organization_name?: string;
  permissions?: PermissionMap;
  capabilities?: OperationalCapabilityMap;
  responsibilities?: OperationalCapabilityMap;
  collector_id?: string;
  access_portal_id?: string;
  access_role_id?: string;
  actor_category_code?: string;
  resource_type?: string | null;
  resource_id?: string | null;
  access_restrictions?: Array<{
    module_id: string;
    permission_code: string;
    denied: true;
    reason: string;
  }>;
}

export interface CreateUserResponse {
  success: boolean;
  user?: {
    id: string;
    email: string;
    full_name: string;
    role: string;
    account_type?: string | null;
  };
  email_sent?: boolean;
  requires_password_change?: boolean;
  requires_mfa_enrollment?: boolean;
  message?: string;
  error?: string;
}

export interface WelcomeEnrollmentState {
  last_login_at?: string | null;
  password_changed_at?: string | null;
  mfa_enrolled_at?: string | null;
  must_change_password?: boolean;
}

export interface ResendWelcomeEmailResponse extends CreateUserResponse {
  previous_link_replaced?: boolean;
}

/** Un compte déjà connecté, protégé par MFA et sans changement imposé est enrôlé. */
export function requiresWelcomeRecovery(state: WelcomeEnrollmentState): boolean {
  const etatDisponible = state.last_login_at !== undefined
    || state.password_changed_at !== undefined
    || state.mfa_enrolled_at !== undefined
    || state.must_change_password !== undefined;
  if (!etatDisponible) return false;
  return state.must_change_password === true
    || !state.mfa_enrolled_at
    || (!state.password_changed_at && !state.last_login_at);
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
        body: JSON.stringify({
          ...data,
          // À la création, seuls les choix actifs sont attribués. Ne pas envoyer
          // tout le catalogue décoché : un nouveau code sans effet peut autrement
          // bloquer Admin/Owner sur une version antérieure du service.
          // Les valeurs invalides restent visibles pour le validateur serveur.
          capabilities: undefined,
          responsibilities: Object.fromEntries(Object.entries(
            data.responsibilities ?? data.capabilities ?? {},
          ).filter(([, allowed]) => allowed !== false)),
        }),
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
        ? 'La réponse du service de création a expiré. Vérifiez la liste des comptes avant de réessayer.'
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
      `${supabaseUrl}/functions/v1/reset-user-password`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': anonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_id: userId }),
        signal: controleur.signal,
      }
    );

    const result = await response.json().catch(() => ({})) as CreateUserResponse;

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Le service de récupération n’est pas déployé. Contactez l’administrateur technique.');
      }
      throw new Error(result.error || 'La récupération du compte a échoué.');
    }

    return result;
  } catch (error: any) {
    const estDelai = error?.name === 'AbortError';
    const estReseau = error instanceof TypeError;
    return {
      success: false,
      error: estDelai
        ? 'Le service de récupération ne répond pas.'
        : estReseau
          ? 'Le service de récupération est momentanément inaccessible.'
          : error.message || 'Une erreur inattendue est survenue.',
    };
  } finally {
    window.clearTimeout(delai);
  }
}

/**
 * Génère un nouveau lien de bienvenue pour un enrôlement resté incomplet.
 * Le lien précédent est remplacé côté serveur et n'est jamais exposé au client.
 */
export async function resendWelcomeEmail(userId: string): Promise<ResendWelcomeEmailResponse> {
  const controleur = new AbortController();
  const delai = window.setTimeout(() => controleur.abort(), 25_000);
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('Votre session d’administration n’est pas disponible.');
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !anonKey) {
      throw new Error('La connexion au service d’administration n’est pas configurée.');
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/resend-welcome-email`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id: userId }),
      signal: controleur.signal,
    });
    const result = await response.json().catch(() => ({})) as ResendWelcomeEmailResponse;
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Le service de renvoi du courriel de bienvenue n’est pas déployé.');
      }
      throw new Error(result.error || 'Le courriel de bienvenue n’a pas pu être renvoyé.');
    }
    if (result.success !== true || result.email_sent !== true || result.previous_link_replaced !== true) {
      throw new Error('Le serveur n’a pas confirmé le remplacement du lien de bienvenue.');
    }
    return result;
  } catch (error: any) {
    const estDelai = error?.name === 'AbortError';
    const estReseau = error instanceof TypeError;
    return {
      success: false,
      error: estDelai
        ? 'Le service d’enrôlement ne répond pas.'
        : estReseau
          ? 'Le service d’enrôlement est momentanément inaccessible.'
          : error.message || 'Une erreur inattendue est survenue.',
    };
  } finally {
    window.clearTimeout(delai);
  }
}
