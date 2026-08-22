import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const AUTH_STORAGE_KEY = 'gold-shipper-auth';
const AUTH_PERSISTENCE_KEY = 'sonasp-auth-persistence';

type AuthPersistence = 'local' | 'session';

function persistenceTarget(): AuthPersistence {
  return window.localStorage.getItem(AUTH_PERSISTENCE_KEY) === 'session'
    ? 'session'
    : 'local';
}

/**
 * Supabase accepte un adaptateur de stockage. Il permet de respecter le choix
 * « Se souvenir de moi » sans recréer une authentification parallèle : le même
 * jeton GoTrue reste utilisé, dans localStorage seulement si la case est cochée
 * et dans sessionStorage sinon.
 */
const authStorage = {
  getItem(key: string) {
    const primary = persistenceTarget() === 'local' ? window.localStorage : window.sessionStorage;
    const secondary = primary === window.localStorage ? window.sessionStorage : window.localStorage;
    return primary.getItem(key) ?? secondary.getItem(key);
  },
  setItem(key: string, value: string) {
    const primary = persistenceTarget() === 'local' ? window.localStorage : window.sessionStorage;
    const secondary = primary === window.localStorage ? window.sessionStorage : window.localStorage;
    primary.setItem(key, value);
    secondary.removeItem(key);
  },
  removeItem(key: string) {
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  },
};

export function configureAuthPersistence(rememberMe: boolean) {
  const target: AuthPersistence = rememberMe ? 'local' : 'session';
  const source = target === 'local' ? window.sessionStorage : window.localStorage;
  const destination = target === 'local' ? window.localStorage : window.sessionStorage;
  const existingSession = source.getItem(AUTH_STORAGE_KEY);

  window.localStorage.setItem(AUTH_PERSISTENCE_KEY, target);

  if (existingSession !== null) {
    destination.setItem(AUTH_STORAGE_KEY, existingSession);
    source.removeItem(AUTH_STORAGE_KEY);
  }
}

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
      'X-Client-Info': 'gold-shipper-web',
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
