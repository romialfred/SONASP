import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: mocks.rpc,
    from: mocks.from,
  },
}));

import {
  UserSessionServiceError,
  isTerminalCurrentSessionError,
  userSessionService,
} from './userSessionService';

const ACTOR_ID = '11111111-1111-4111-8111-111111111111';
const TARGET_ID = '22222222-2222-4222-8222-222222222222';
const SESSION_ID = '33333333-3333-4333-8333-333333333333';
const NOW = '2099-08-24T21:00:00.000Z';

const activeSession = {
  id: SESSION_ID,
  user_id: ACTOR_ID,
  ip_address: '192.0.2.10',
  user_agent: 'Navigateur de test',
  device_type: 'desktop',
  browser: 'Autre',
  location_country: null,
  last_activity_at: NOW,
  expires_at: '2099-08-24T21:10:00.000Z',
  is_active: true,
  is_current: true,
  created_at: NOW,
  revoked_at: null,
  revoked_by: null,
  revocation_reason: null,
};

describe('userSessionService — frontière RPC sécurisée', () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
    mocks.from.mockReset();
  });

  it('enregistre la session courante sans transmettre de token, hash ou adresse IP', async () => {
    mocks.rpc.mockResolvedValue({ data: activeSession, error: null });

    await expect(userSessionService.registerCurrentSession()).resolves.toMatchObject({
      id: SESSION_ID,
      is_current: true,
    });
    expect(mocks.rpc).toHaveBeenCalledWith('snp_session_enregistrer', expect.objectContaining({
      p_location_country: null,
    }));
    const parameters = mocks.rpc.mock.calls[0][1];
    expect(Object.keys(parameters)).not.toEqual(expect.arrayContaining([
      'token', 'session_token', 'token_hash', 'ip_address',
    ]));
  });

  it('accepte la liste self/Owner décidée par le serveur sans envoyer de rôle client', async () => {
    mocks.rpc.mockResolvedValue({ data: [activeSession], error: null });

    await expect(userSessionService.list()).resolves.toHaveLength(1);
    expect(mocks.rpc).toHaveBeenCalledWith('snp_sessions_lister', {
      p_user_id: null,
      p_actives_seulement: true,
    });
  });

  it('transmet uniquement la cible UUID pour une liste accounts.manage autorisée côté serveur', async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ ...activeSession, user_id: TARGET_ID, is_current: false }],
      error: null,
    });

    await expect(userSessionService.list(TARGET_ID)).resolves.toMatchObject([{ user_id: TARGET_ID }]);
    expect(mocks.rpc).toHaveBeenCalledWith('snp_sessions_lister', {
      p_user_id: TARGET_ID,
      p_actives_seulement: true,
    });
  });

  it('échoue fermé pour un mauvais utilisateur refusé par capability/AAL2', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'détail interne' } });

    await expect(userSessionService.list(TARGET_ID)).rejects.toMatchObject({
      code: '42501',
      message: 'La gestion sécurisée des sessions est momentanément indisponible.',
    });
  });

  it('rejette un identifiant invalide avant tout appel réseau', async () => {
    await expect(userSessionService.list('not-a-uuid')).rejects.toBeInstanceOf(UserSessionServiceError);
    await expect(userSessionService.revoke('not-a-uuid')).rejects.toBeInstanceOf(UserSessionServiceError);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('échoue fermé sans données de repli sur une panne réseau', async () => {
    mocks.rpc.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(userSessionService.list(ACTOR_ID)).rejects.toMatchObject({ code: 'NETWORK' });
  });

  it('refuse toute réponse qui exposerait de nouveau un token ou son empreinte', async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ ...activeSession, session_token: 'valeur-interdite' }],
      error: null,
    });

    await expect(userSessionService.list(ACTOR_ID)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('révoque une session par RPC et exige la confirmation inactive du serveur', async () => {
    mocks.rpc.mockResolvedValue({
      data: {
        ...activeSession,
        is_active: false,
        revoked_at: NOW,
        revoked_by: ACTOR_ID,
        revocation_reason: 'Révocation depuis la gestion des sessions',
      },
      error: null,
    });

    await expect(userSessionService.revoke(SESSION_ID)).resolves.toMatchObject({ is_active: false });
    expect(mocks.rpc).toHaveBeenCalledWith('snp_session_revoquer', {
      p_session_id: SESSION_ID,
      p_motif: 'Révocation depuis la gestion des sessions',
    });
  });

  it('révoque toutes les sessions via RPC en conservant la session courante par défaut', async () => {
    mocks.rpc.mockResolvedValue({ data: 3, error: null });

    await expect(userSessionService.revokeAll(TARGET_ID)).resolves.toBe(3);
    expect(mocks.rpc).toHaveBeenCalledWith('snp_sessions_revoquer_toutes', {
      p_user_id: TARGET_ID,
      p_excepter_session_courante: true,
      p_motif: 'Révocation globale depuis la gestion des sessions',
    });
  });

  it('classe une session révoquée ou expirée comme terminale sans classer le réseau ainsi', () => {
    expect(isTerminalCurrentSessionError(new UserSessionServiceError('heartbeat', 'P0002'))).toBe(true);
    expect(isTerminalCurrentSessionError(new UserSessionServiceError('heartbeat', '42501'))).toBe(true);
    expect(isTerminalCurrentSessionError(new UserSessionServiceError('heartbeat', 'NETWORK'))).toBe(false);
  });

  it('ne contient plus aucun DML user_sessions dans les services frontend concernés', () => {
    const files = [
      'src/services/userLoginService.ts',
      'src/services/userSessionService.ts',
      'src/lib/sessionManager.ts',
    ];
    files.forEach((file) => {
      const source = readFileSync(resolve(process.cwd(), file), 'utf8');
      expect(source).not.toMatch(/\.from\(['"]user_sessions['"]\)/u);
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
