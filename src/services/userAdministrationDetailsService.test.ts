import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  safeFetch: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { auth: { getSession: mocks.getSession } },
}));

vi.mock('@/lib/apiClient', () => ({ safeFetch: mocks.safeFetch }));

import {
  getAdministrationUserDetails,
  parseAdministrationUserDetails,
} from './userAdministrationDetailsService';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const OTHER_ID = '22222222-2222-4222-8222-222222222222';

function payload(userId = USER_ID): Record<string, unknown> {
  return {
    success: true,
    profile: {
      id: userId,
      email: 'admin@sonasp.bf',
      full_name: 'Compte administrateur',
      phone: null,
      role: 'admin',
      job_title: null,
      department: null,
      is_active: true,
      account_locked: false,
      account_locked_until: null,
      failed_login_attempts: 0,
      two_factor_enabled: true,
      mfa_enrolled_at: '2026-08-25T08:00:00Z',
      last_login_at: null,
      last_login_ip: null,
      last_activity_at: null,
      created_at: '2026-08-01T08:00:00Z',
      updated_at: null,
      activation_completed_at: null,
      must_change_password: false,
      password_changed_at: null,
      timezone: 'Africa/Ouagadougou',
      language_preference: 'fr',
      language: 'fr',
      mining_company_id: null,
      mining_company: null,
    },
    statistics: {
      connection_events: 4,
      connection_events_30d: 2,
      rejected_connections: 1,
      activity_events: 6,
      activity_events_30d: 3,
      permissions_count: 2,
      sites_count: 1,
    },
    connections: [],
    activities: [],
    permissions: [],
    sites: [],
    account_changes: [{
      uid: 'decision-1',
      action: 'desactivation_compte',
      ancien_etat: true,
      nouvel_etat: false,
      motif: 'Compte inutilisé',
      cree_le: '2026-08-20T08:00:00Z',
      acteur_id: OTHER_ID,
    }],
    sources_unavailable: [],
  };
}

describe('parseAdministrationUserDetails', () => {
  it('normalise la clé DataTable et rend nulles les statistiques incomplètes', () => {
    const brut = payload();
    brut.sources_unavailable = ['journal des connexions', 'permissions individuelles'];

    const resultat = parseAdministrationUserDetails(brut, USER_ID);

    expect(resultat.account_changes[0]).toMatchObject({ id: 'decision-1', uid: 'decision-1' });
    expect(resultat.statistics.connection_events).toBeNull();
    expect(resultat.statistics.connection_events_30d).toBeNull();
    expect(resultat.statistics.rejected_connections).toBeNull();
    expect(resultat.statistics.permissions_count).toBeNull();
    expect(resultat.statistics.activity_events).toBe(6);
  });

  it('refuse un succès applicatif faux', () => {
    const brut = payload();
    brut.success = false;

    expect(() => parseAdministrationUserDetails(brut, USER_ID)).toThrow(
      'Le serveur n’a pas confirmé le chargement du compte.',
    );
  });

  it('refuse une fiche appartenant à un autre compte', () => {
    expect(() => parseAdministrationUserDetails(payload(OTHER_ID), USER_ID)).toThrow(
      'La fiche reçue ne correspond pas au compte demandé.',
    );
  });

  it('refuse une collection obligatoire mal formée', () => {
    const brut = payload();
    brut.activities = null;

    expect(() => parseAdministrationUserDetails(brut, USER_ID)).toThrow(
      'Réponse invalide : le journal d’activité est absent ou mal formé.',
    );
  });
});

describe('getAdministrationUserDetails', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
    mocks.getSession.mockResolvedValue({ data: { session: { access_token: 'jwt-aal2' } } });
    mocks.safeFetch.mockResolvedValue({ ok: true, status: 200, data: payload() });
  });

  it('transmet l’annulation et valide la cible reçue', async () => {
    const controller = new AbortController();

    const resultat = await getAdministrationUserDetails(USER_ID, controller.signal);

    expect(resultat.profile.id).toBe(USER_ID);
    expect(mocks.safeFetch).toHaveBeenCalledWith(
      'https://example.supabase.co/functions/v1/get-user-details',
      expect.objectContaining({
        method: 'POST',
        signal: controller.signal,
        body: JSON.stringify({ user_id: USER_ID }),
      }),
    );
  });

  it('échoue sans session administrateur', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } });

    await expect(getAdministrationUserDetails(USER_ID)).rejects.toThrow(
      'Votre session d’administration n’est pas disponible.',
    );
    expect(mocks.safeFetch).not.toHaveBeenCalled();
  });

  it('propage un refus HTTP', async () => {
    mocks.safeFetch.mockResolvedValue({ ok: false, status: 403, error: { message: 'Accès refusé' } });

    await expect(getAdministrationUserDetails(USER_ID)).rejects.toThrow('Accès refusé');
  });

  it('refuse un corps 2xx incohérent', async () => {
    mocks.safeFetch.mockResolvedValue({ ok: true, status: 200, data: { success: true } });

    await expect(getAdministrationUserDetails(USER_ID)).rejects.toThrow('Réponse invalide');
  });
});
