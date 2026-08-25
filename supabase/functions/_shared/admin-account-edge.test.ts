import { describe, expect, it, vi } from 'vitest';
import {
  appelerRpcIdempotent,
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

  it('vérifie la session active avant la capability', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: { is_active: true, is_current: true }, error: null })
      .mockResolvedValueOnce({ data: true, error: null });
    await expect(verifierSessionAdministration({ rpc })).resolves.toEqual({ ok: true });
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      'snp_session_signaler_activite',
      'snp_actor_has_capability',
    ]);
  });

  it.each([
    [{ data: null, error: { code: 'P0002' } }, 401],
    [{ data: null, error: { code: '42501' } }, 403],
    [{ data: { is_active: false, is_current: true }, error: null }, 403],
  ] as const)('refuse une session absente ou révoquée', async (resultat, status) => {
    const rpc = vi.fn().mockResolvedValue(resultat);
    await expect(verifierSessionAdministration({ rpc })).resolves.toEqual({ ok: false, status });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('refuse fail-closed une capability indisponible', async () => {
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: { is_active: true, is_current: true }, error: null })
      .mockResolvedValueOnce({ data: null, error: { code: 'XX000' } });
    await expect(verifierSessionAdministration({ rpc })).resolves.toEqual({ ok: false, status: 503 });
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
});
