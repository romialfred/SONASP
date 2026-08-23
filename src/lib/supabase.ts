import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const AUTH_STORAGE_KEY = 'sonasp-auth';
const LEGACY_AUTH_STORAGE_KEY = 'gold-shipper-auth';
const AUTH_PERSISTENCE_KEY = 'sonasp-auth-persistence';

/**
 * Les jetons ne doivent jamais survivre à la fermeture de l'onglet. Une
 * ancienne version autorisait localStorage et relisait même ce stockage en
 * secours, ce qui réouvrait une session après un redémarrage du navigateur.
 */
const authStorage = {
  getItem(key: string) {
    return window.sessionStorage.getItem(key);
  },
  setItem(key: string, value: string) {
    window.sessionStorage.setItem(key, value);
    window.localStorage.removeItem(key);
  },
  removeItem(key: string) {
    window.sessionStorage.removeItem(key);
    window.localStorage.removeItem(key);
  },
};

export function configureAuthPersistence(_legacyRememberMe?: boolean) {
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
  window.localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
  window.sessionStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
  window.localStorage.removeItem(AUTH_PERSISTENCE_KEY);
}

// Purge unique de la persistance héritée. La session courante de l'onglet, si
// elle existe, reste intacte dans sessionStorage.
if (typeof window !== 'undefined') configureAuthPersistence();

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: authStorage,
    storageKey: AUTH_STORAGE_KEY,
    flowType: 'pkce',
    // Prevent automatic sign-out on token expiry
    // Token will be refreshed automatically before expiry
    // Disable debug logs to prevent console spam
    debug: false,
  },
  global: {
    headers: {
      'X-Client-Info': 'sonasp-web',
    },
  },
  db: {
    schema: 'public',
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
