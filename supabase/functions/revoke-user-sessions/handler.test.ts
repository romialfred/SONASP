import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createRevokeUserSessionsHandler,
  type DependancesRevocationSessions,
} from './handler.ts';

const ORIGIN = 'https://sonasp.data-univers.com';
const TOKEN = `${'a'.repeat(32)}.${'b'.repeat(32)}.${'c'.repeat(32)}`;
const ACTOR_ID = '11111111-1111-4111-8111-111111111111';
const TARGET_ID = '22222222-2222-4222-8222-222222222222';

function dependances(): DependancesRevocationSessions {
  return {
    authorize: vi.fn().mockResolvedValue({
      allowed: true,
      targetUserId: ACTOR_ID,
      isSelf: true,
    }),
    revokeApplicationSessions: vi.fn().mockResolvedValue({ ok: true, revokedCount: 2 }),
    revokeOwnRefreshTokens: vi.fn().mockResolvedValue(true),
  };
}

function requete(
  body: unknown = {
    target_user_id: null,
    except_current_session: false,
    reason: 'Déconnexion de sécurité demandée par le titulaire',
  },
  headers: Record<string, string> = {},
): Request {
  return new Request('https://project.supabase.co/functions/v1/revoke-user-sessions', {
    method: 'POST',
    headers: {
      Origin: ORIGIN,
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe('revoke-user-sessions Edge handler', () => {
  beforeEach(() => {
    vi.stubGlobal('Deno', { env: { get: vi.fn(() => undefined) } });
  });

  it('refuse une origine hors allowlist avant toute autorisation', async () => {
    const deps = dependances();
    const response = await createRevokeUserSessionsHandler(deps)(requete(undefined, {
      Origin: 'https://evil.example',
    }));

    expect(response.status).toBe(403);
    expect(deps.authorize).not.toHaveBeenCalled();
    expect(deps.revokeApplicationSessions).not.toHaveBeenCalled();
  });

  it('rejette un bearer absent sans exposer de détail', async () => {
    const deps = dependances();
    const response = await createRevokeUserSessionsHandler(deps)(requete(undefined, {
      Authorization: '',
    }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      success: false,
      error: 'Votre session n’est plus valide.',
    });
    expect(deps.authorize).not.toHaveBeenCalled();
  });

  it('valide strictement UUID, motif et champs inconnus avant les dépendances', async () => {
    const deps = dependances();
    const handler = createRevokeUserSessionsHandler(deps);
    const invalides = [
      { target_user_id: 'not-a-uuid', except_current_session: true, reason: 'Motif suffisamment long' },
      { target_user_id: null, except_current_session: true, reason: 'court' },
      {
        target_user_id: null,
        except_current_session: true,
        reason: 'Motif suffisamment long',
        role: 'owner',
      },
    ];

    for (const corps of invalides) {
      const response = await handler(requete(corps));
      expect(response.status).toBe(400);
    }
    expect(deps.authorize).not.toHaveBeenCalled();
  });

  it('révoque application et refresh tokens du titulaire avec le scope global', async () => {
    const deps = dependances();
    const response = await createRevokeUserSessionsHandler(deps)(requete());

    expect(response.status).toBe(200);
    expect(deps.authorize).toHaveBeenCalledWith({
      token: TOKEN,
      requestedTargetUserId: null,
    });
    expect(deps.revokeApplicationSessions).toHaveBeenCalledWith({
      token: TOKEN,
      targetUserId: ACTOR_ID,
      exceptCurrentSession: false,
      reason: 'Déconnexion de sécurité demandée par le titulaire',
    });
    expect(deps.revokeOwnRefreshTokens).toHaveBeenCalledWith({ token: TOKEN, scope: 'global' });
    expect(await response.json()).toEqual({
      success: true,
      mode: 'strong_self_global',
      revoked_count: 2,
      application_sessions_revoked: true,
      refresh_tokens_revoked: true,
      access_tokens_revoked: false,
    });
    expect(response.headers.get('Cache-Control')).toContain('no-store');
  });

  it('utilise le scope others quand la session courante doit être conservée', async () => {
    const deps = dependances();
    const response = await createRevokeUserSessionsHandler(deps)(requete({
      target_user_id: ACTOR_ID,
      except_current_session: true,
      reason: 'Déconnexion des autres appareils du titulaire',
    }));

    expect(response.status).toBe(200);
    expect(deps.revokeOwnRefreshTokens).toHaveBeenCalledWith({ token: TOKEN, scope: 'others' });
    expect(await response.json()).toMatchObject({ mode: 'strong_self_others' });
  });

  it('n’annonce jamais une révocation GoTrue forte pour une cible tierce', async () => {
    const deps = dependances();
    vi.mocked(deps.authorize).mockResolvedValue({
      allowed: true,
      targetUserId: TARGET_ID,
      isSelf: false,
    });
    const response = await createRevokeUserSessionsHandler(deps)(requete({
      target_user_id: TARGET_ID,
      except_current_session: false,
      reason: 'Compte compromis signalé par le centre de sécurité',
    }));

    expect(response.status).toBe(200);
    expect(deps.revokeOwnRefreshTokens).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({
      success: true,
      mode: 'application_registry_only',
      revoked_count: 2,
      application_sessions_revoked: true,
      refresh_tokens_revoked: false,
      access_tokens_revoked: false,
    });
  });

  it('échoue fermé quand capability, AAL2 ou hiérarchie refusent la cible', async () => {
    const deps = dependances();
    vi.mocked(deps.authorize).mockResolvedValue({ allowed: false, status: 403 });
    const response = await createRevokeUserSessionsHandler(deps)(requete({
      target_user_id: TARGET_ID,
      except_current_session: true,
      reason: 'Révocation administrative avec justification valide',
    }));

    expect(response.status).toBe(403);
    expect(deps.revokeApplicationSessions).not.toHaveBeenCalled();
    expect(deps.revokeOwnRefreshTokens).not.toHaveBeenCalled();
  });

  it('rend explicite un échec GoTrue après révocation applicative', async () => {
    const deps = dependances();
    vi.mocked(deps.revokeOwnRefreshTokens).mockResolvedValue(false);
    const response = await createRevokeUserSessionsHandler(deps)(requete());

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      success: false,
      mode: 'partial_application_only',
      revoked_count: 2,
      application_sessions_revoked: true,
      refresh_tokens_revoked: false,
      access_tokens_revoked: false,
      error: 'La révocation Auth complète n’a pas pu être confirmée.',
    });
  });

  it('ne renvoie jamais le bearer dans une réponse, même en panne', async () => {
    const deps = dependances();
    vi.mocked(deps.revokeApplicationSessions).mockRejectedValue(new Error(`failure ${TOKEN}`));
    const response = await createRevokeUserSessionsHandler(deps)(requete());
    const texte = await response.text();

    expect(response.status).toBe(503);
    expect(texte).not.toContain(TOKEN);
  });
});
