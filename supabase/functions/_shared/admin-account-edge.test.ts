import { describe, expect, it, vi } from 'vitest';
import {
  appelerRpcIdempotent,
  clesJsonValides,
  creerHandlerAdministration,
  extraireJetonBearer,
  lireJsonLimite,
  verifierSessionAdministration,
} from './admin-account-edge';

const JWT = `eyJhbGciOiJIUzI1NiJ9.${'a'.repeat(40)}.${'b'.repeat(40)}`;

describe('garde Edge d’administration des comptes', () => {
  it('rejoue une réponse RPC ambiguë avec la même idempotence', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: null, error: { message: 'transport' } })
      .mockResolvedValueOnce({ data: { status: 'db_completed', replayed: true }, error: null });
    const input = { p_idempotency_key: 'stable-key' };
    await expect(appelerRpcIdempotent({ rpc }, 'rpc_test', input)).resolves.toEqual({
      data: { status: 'db_completed', replayed: true },
      error: null,
    });
    expect(rpc).toHaveBeenNthCalledWith(1, 'rpc_test', input);
    expect(rpc).toHaveBeenNthCalledWith(2, 'rpc_test', input);
  });

  it('exige un Bearer strict', () => {
    expect(extraireJetonBearer(new Request('https://edge.test'))).toBeNull();
    expect(extraireJetonBearer(new Request('https://edge.test', {
      headers: { Authorization: `Basic ${JWT}` },
    }))).toBeNull();
    expect(extraireJetonBearer(new Request('https://edge.test', {
      headers: { Authorization: `Bearer ${JWT}` },
    }))).toBe(JWT);
  });

  it('vérifie la session active, la capability et l’habilitation effective', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: { is_active: true, is_current: true }, error: null })
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: true, error: null });
    await expect(verifierSessionAdministration({ rpc }, 'edit')).resolves.toEqual({ ok: true });
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      'snp_session_signaler_activite',
      'snp_actor_has_capability',
      'snp_actor_can_module_action',
    ]);
    expect(rpc).toHaveBeenLastCalledWith('snp_actor_can_module_action', {
      p_module_code: 'administration',
      p_action: 'edit',
    });
  });

  it.each([
    [{ data: null, error: { code: 'P0002' } }, 401],
    [{ data: null, error: { code: '42501' } }, 403],
    [{ data: { is_active: false, is_current: true }, error: null }, 403],
  ] as const)('refuse une session absente ou révoquée', async (resultat, status) => {
    const rpc = vi.fn().mockResolvedValue(resultat);
    await expect(verifierSessionAdministration({ rpc }, 'view')).resolves.toEqual({ ok: false, status });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('refuse fail-closed une capability indisponible', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: { is_active: true, is_current: true }, error: null })
      .mockResolvedValueOnce({ data: null, error: { code: 'XX000' } });
    await expect(verifierSessionAdministration({ rpc }, 'view')).resolves.toEqual({ ok: false, status: 503 });
  });

  it('refuse un Admin dont le droit du module a été retiré', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: { is_active: true, is_current: true }, error: null })
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: false, error: null });
    await expect(verifierSessionAdministration({ rpc }, 'delete'))
      .resolves.toEqual({ ok: false, status: 403 });
  });
});

describe('enveloppe HTTP administrative', () => {
  it('rejette une origine non autorisée sans exécuter la dépendance', async () => {
    const execute = vi.fn();
    const handler = creerHandlerAdministration({ methods: ['POST'], execute, unexpectedError: 'Erreur.' });
    const response = await handler(new Request('https://edge.test', {
      method: 'POST',
      headers: { Origin: 'https://evil.example', Authorization: `Bearer ${JWT}` },
    }));
    expect(response.status).toBe(403);
    expect(execute).not.toHaveBeenCalled();
    expect(response.headers.get('Cache-Control')).toContain('no-store');
  });

  it('ne propage jamais une exception interne', async () => {
    const handler = creerHandlerAdministration({
      methods: ['GET'],
      execute: vi.fn().mockRejectedValue(new Error('PII INTERNE')),
      unexpectedError: 'Lecture indisponible.',
    });
    const response = await handler(new Request('https://edge.test', {
      headers: { Authorization: `Bearer ${JWT}` },
    }));
    expect(response.status).toBe(500);
    expect(await response.text()).toBe(JSON.stringify({ success: false, error: 'Lecture indisponible.' }));
  });

  it('limite et valide strictement le JSON', async () => {
    const valide = new Request('https://edge.test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true }),
    });
    await expect(lireJsonLimite(valide, 64)).resolves.toEqual({ ok: true });

    const tropGrand = new Request('https://edge.test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: 'x'.repeat(80) }),
    });
    await expect(lireJsonLimite(tropGrand, 32)).resolves.toBeNull();
  });

  it.each([
    ['type absent', {}, JSON.stringify({ ok: true }), 64],
    ['type incorrect', { 'Content-Type': 'text/plain' }, JSON.stringify({ ok: true }), 64],
    ['JSON malformé', { 'Content-Type': 'application/json' }, '{"ok":', 64],
    ['tableau JSON', { 'Content-Type': 'application/json' }, '[]', 64],
    ['limite invalide', { 'Content-Type': 'application/json' }, '{}', 0],
  ])('refuse un corps administratif invalide : %s', async (_, headers, body, limite) => {
    const requete = new Request('https://edge.test', { method: 'POST', headers, body });
    await expect(lireJsonLimite(requete, limite)).resolves.toBeNull();
  });

  it('refuse une longueur annoncée ou réelle supérieure à la limite', async () => {
    const longueurAnnoncee = new Request('https://edge.test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': '4096' },
      body: '{}',
    });
    await expect(lireJsonLimite(longueurAnnoncee, 64)).resolves.toBeNull();

    const longueurReelle = new Request('https://edge.test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ valeur: 'x'.repeat(4096) }),
    });
    await expect(lireJsonLimite(longueurReelle, 64)).resolves.toBeNull();
  });

  it('valide les clés autorisées et obligatoires sans accepter les extensions', () => {
    expect(clesJsonValides({ user_id: 'id' }, ['user_id'], ['user_id'])).toBe(true);
    expect(clesJsonValides({}, ['user_id'], ['user_id'])).toBe(false);
    expect(clesJsonValides({ user_id: 'id', role: 'owner' }, ['user_id'], ['user_id'])).toBe(false);
    expect(clesJsonValides([], ['user_id'])).toBe(false);
  });
});
