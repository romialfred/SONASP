import { safeFetch } from '@/lib/apiClient';
import { supabase } from '@/lib/supabase';

export interface AdministrationUserProfile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: string;
  job_title: string | null;
  department: string | null;
  is_active: boolean;
  account_locked: boolean;
  account_locked_until: string | null;
  failed_login_attempts: number;
  two_factor_enabled: boolean;
  mfa_enrolled_at: string | null;
  last_login_at: string | null;
  last_login_ip: string | null;
  last_activity_at: string | null;
  created_at: string;
  updated_at: string | null;
  activation_completed_at: string | null;
  must_change_password: boolean;
  password_changed_at: string | null;
  timezone: string | null;
  language_preference: string | null;
  language: string | null;
  mining_company_id: string | null;
  mining_company: {
    id: string;
    name: string;
    abbreviation: string | null;
    is_active: boolean;
  } | null;
}

export interface AdministrationConnectionEvent {
  id: string;
  event_type: string;
  user_agent: string | null;
  ip_address: string | null;
  details: Record<string, unknown> | null;
  created_at: string | null;
}

export interface AdministrationActivityEvent {
  id: string;
  action_type: string;
  module_name: string;
  resource_type: string | null;
  resource_id: string | null;
  description: string | null;
  status: string | null;
  error_message: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string | null;
  source: 'activity' | 'audit';
}

export interface AdministrationPermission {
  id: string;
  module_id: string;
  can_view: boolean;
  can_read: boolean;
  can_create: boolean;
  can_write: boolean;
  can_edit: boolean;
  can_delete: boolean;
  can_approve: boolean;
  granted_at: string | null;
  modules: {
    id: string;
    name: string;
    display_name: string;
    category: string | null;
  } | null;
}

export interface AdministrationSiteAccess {
  id: string;
  site_id: string;
  is_primary: boolean | null;
  assigned_at: string | null;
  sites: {
    id: string;
    name: string;
    location: string | null;
    site_type: string | null;
    mining_company_id: string | null;
  } | null;
}

export interface AdministrationAccountChange {
  id: string;
  uid: string;
  action: string;
  ancien_etat: boolean;
  nouvel_etat: boolean;
  motif: string;
  cree_le: string;
  acteur_id: string;
}

export interface AdministrationUserDetails {
  success: boolean;
  profile: AdministrationUserProfile;
  statistics: {
    connection_events: number | null;
    connection_events_30d: number | null;
    rejected_connections: number | null;
    activity_events: number | null;
    activity_events_30d: number | null;
    permissions_count: number | null;
    sites_count: number | null;
  };
  connections: AdministrationConnectionEvent[];
  activities: AdministrationActivityEvent[];
  permissions: AdministrationPermission[];
  sites: AdministrationSiteAccess[];
  account_changes: AdministrationAccountChange[];
  sources_unavailable: string[];
}

type JsonRecord = Record<string, unknown>;

const CONNECTION_SOURCES = new Set([
  'journal des connexions',
  'tentatives de connexion refusées',
]);

const ACTIVITY_SOURCES = new Set([
  'journal d’activité',
  'journal d’audit',
]);

function isRecord(value: unknown): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertRecord(value: unknown, label: string): asserts value is JsonRecord {
  if (!isRecord(value)) throw new Error(`Réponse invalide : ${label} est absent.`);
}

function assertRecordArray(value: unknown, label: string): asserts value is JsonRecord[] {
  if (!Array.isArray(value) || value.some((item) => !isRecord(item))) {
    throw new Error(`Réponse invalide : ${label} est absent ou mal formé.`);
  }
}

function assertString(value: unknown, label: string): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Réponse invalide : ${label} est absent.`);
  }
}

function assertBoolean(value: unknown, label: string): asserts value is boolean {
  if (typeof value !== 'boolean') throw new Error(`Réponse invalide : ${label} est absent.`);
}

function parseStatistic(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`Réponse invalide : la statistique ${label} est mal formée.`);
  }
  return value;
}

function sourceUnavailable(sources: string[], names: Set<string>): boolean {
  return sources.some((source) => names.has(source));
}

export function parseAdministrationUserDetails(
  payload: unknown,
  expectedUserId: string,
): AdministrationUserDetails {
  assertRecord(payload, 'le dossier utilisateur');
  if (payload.success !== true) throw new Error('Le serveur n’a pas confirmé le chargement du compte.');

  assertRecord(payload.profile, 'le profil');
  assertString(payload.profile.id, 'l’identifiant du profil');
  if (payload.profile.id !== expectedUserId) {
    throw new Error('La fiche reçue ne correspond pas au compte demandé.');
  }
  assertString(payload.profile.email, 'l’adresse e-mail du profil');
  assertString(payload.profile.role, 'le rôle du profil');
  assertBoolean(payload.profile.is_active, 'l’état du profil');
  assertString(payload.profile.created_at, 'la date de création du profil');
  if (typeof payload.profile.failed_login_attempts !== 'number') {
    throw new Error('Réponse invalide : le compteur de connexions refusées est absent.');
  }

  assertRecord(payload.statistics, 'les statistiques');
  const statistics = {
    connection_events: parseStatistic(payload.statistics.connection_events, 'connection_events'),
    connection_events_30d: parseStatistic(payload.statistics.connection_events_30d, 'connection_events_30d'),
    rejected_connections: parseStatistic(payload.statistics.rejected_connections, 'rejected_connections'),
    activity_events: parseStatistic(payload.statistics.activity_events, 'activity_events'),
    activity_events_30d: parseStatistic(payload.statistics.activity_events_30d, 'activity_events_30d'),
    permissions_count: parseStatistic(payload.statistics.permissions_count, 'permissions_count'),
    sites_count: parseStatistic(payload.statistics.sites_count, 'sites_count'),
  };

  assertRecordArray(payload.connections, 'le journal des connexions');
  assertRecordArray(payload.activities, 'le journal d’activité');
  assertRecordArray(payload.permissions, 'les permissions');
  assertRecordArray(payload.sites, 'les accès aux sites');
  assertRecordArray(payload.account_changes, 'l’historique du statut');
  if (!Array.isArray(payload.sources_unavailable)
    || payload.sources_unavailable.some((source) => typeof source !== 'string')) {
    throw new Error('Réponse invalide : l’état des sources est mal formé.');
  }

  const sources = payload.sources_unavailable as string[];
  const connexionsIndisponibles = sourceUnavailable(sources, CONNECTION_SOURCES);
  const activitesIndisponibles = sourceUnavailable(sources, ACTIVITY_SOURCES);
  const permissionsIndisponibles = sources.includes('permissions individuelles');
  const sitesIndisponibles = sources.includes('accès aux sites');

  const accountChanges = payload.account_changes.map((change) => {
    const uid = typeof change.uid === 'string' && change.uid.length > 0
      ? change.uid
      : typeof change.id === 'string' && change.id.length > 0
        ? change.id
        : null;
    if (!uid || typeof change.nouvel_etat !== 'boolean') {
      throw new Error('Réponse invalide : une décision administrative est mal formée.');
    }
    return { ...change, id: uid, uid } as unknown as AdministrationAccountChange;
  });

  return {
    ...(payload as unknown as AdministrationUserDetails),
    statistics: {
      connection_events: connexionsIndisponibles ? null : statistics.connection_events,
      connection_events_30d: connexionsIndisponibles ? null : statistics.connection_events_30d,
      rejected_connections: connexionsIndisponibles ? null : statistics.rejected_connections,
      activity_events: activitesIndisponibles ? null : statistics.activity_events,
      activity_events_30d: activitesIndisponibles ? null : statistics.activity_events_30d,
      permissions_count: permissionsIndisponibles ? null : statistics.permissions_count,
      sites_count: sitesIndisponibles ? null : statistics.sites_count,
    },
    account_changes: accountChanges,
    sources_unavailable: [...sources],
  };
}

export async function getAdministrationUserDetails(
  userId: string,
  signal?: AbortSignal,
): Promise<AdministrationUserDetails> {
  if (!userId.trim()) throw new Error('La référence du compte est absente.');
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData?.session;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!session?.access_token || !anonKey) {
    throw new Error('Votre session d’administration n’est pas disponible.');
  }

  const resultat = await safeFetch<unknown>(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-user-details`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: anonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id: userId }),
      signal,
    },
  );
  if (!resultat.ok) throw new Error(resultat.error.message);
  return parseAdministrationUserDetails(resultat.data, userId);
}
