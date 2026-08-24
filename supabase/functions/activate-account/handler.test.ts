import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createActivationHandler,
  type DependancesActivation,
} from './handler.ts';

const ORIGIN = 'https://sonasp.data-univers.com';
const TOKEN = 'A'.repeat(43);

function dependances(): DependancesActivation {
  return {
    registerAttempt: vi.fn().mockResolvedValue({ allowed: true, attemptId: 'attempt-1' }),
    consumeToken: vi.fn().mockResolvedValue({
      userId: '00000000-0000-4000-8000-000000000001',
      tokenType: 'activation',
    }),
    createRecoveryToken: vi.fn().mockResolvedValue('recovery-hash'),
    recordOutcome: vi.fn().mockResolvedValue(undefined),
    now: () => new Date('2026-08-24T12:00:00.000Z'),
  };
}

function requete(
  body: unknown = { token: TOKEN },
  headers: Record<string, string> = {},
): Request {
  return new Request('https://project.supabase.co/functions/v1/activate-account', {
    method: 'POST',
    headers: { Origin: ORIGIN, 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

describe('activate-account Edge handler', () => {
  beforeEach(() => {
    vi.stubGlobal('Deno', { env: { get: vi.fn(() => undefined) } });
  });

  it('refuse une origine absente ou hors allowlist avant tout accès aux données', async () => {
    const deps = dependances();
    const handler = createActivationHandler(deps);
    const response = await handler(requete({ token: TOKEN }, { Origin: 'https://evil.example' }));

    expect(response.status).toBe(403);
    expect(deps.registerAttempt).not.toHaveBeenCalled();
    expect(deps.consumeToken).not.toHaveBeenCalled();
  });

  it('rejette strictement les corps mal formés avec une erreur non énumérante', async () => {
    const deps = dependances();
    const handler = createActivationHandler(deps);
    const response = await handler(requete({ token: 'court', extra: true }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      success: false,
      error: 'Ce lien est invalide, expiré ou déjà utilisé.',
    });
    expect(deps.registerAttempt).toHaveBeenCalledTimes(1);
    expect(deps.consumeToken).not.toHaveBeenCalled();
    expect(deps.recordOutcome).toHaveBeenCalledWith('attempt-1', 'invalid', undefined);
  });

  it('bloque la tentative avant de lire ou consommer le jeton quand la limite est atteinte', async () => {
    const deps = dependances();
    vi.mocked(deps.registerAttempt).mockResolvedValue({ allowed: false, attemptId: 'attempt-rate' });
    const response = await createActivationHandler(deps)(requete());

    expect(response.status).toBe(429);
    expect(deps.consumeToken).not.toHaveBeenCalled();
    expect(deps.recordOutcome).toHaveBeenCalledWith('attempt-rate', 'rate_limited', undefined);
  });

  it('consomme une seule fois le jeton puis ne renvoie qu’une destination Recovery', async () => {
    const deps = dependances();
    const response = await createActivationHandler(deps)(requete());
    const texte = await response.text();

    expect(response.status).toBe(200);
    expect(JSON.parse(texte)).toEqual({
      success: true,
      next: '/modifier-mot-de-passe?token_hash=recovery-hash&type=recovery',
    });
    expect(deps.consumeToken).toHaveBeenCalledWith(TOKEN, '2026-08-24T12:00:00.000Z');
    expect(deps.createRecoveryToken).toHaveBeenCalledWith('00000000-0000-4000-8000-000000000001');
    expect(texte).not.toContain(TOKEN);
    expect(texte).not.toContain('00000000-0000-4000-8000-000000000001');
    expect(response.headers.get('Cache-Control')).toContain('no-store');
  });

  it('ne distingue pas un jeton expiré, déjà utilisé ou inconnu', async () => {
    const deps = dependances();
    vi.mocked(deps.consumeToken).mockResolvedValue(null);
    const response = await createActivationHandler(deps)(requete());

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      success: false,
      error: 'Ce lien est invalide, expiré ou déjà utilisé.',
    });
  });

  it('échoue fermé si le journal de limitation est indisponible', async () => {
    const deps = dependances();
    vi.mocked(deps.registerAttempt).mockRejectedValue(new Error('db down'));
    const response = await createActivationHandler(deps)(requete());

    expect(response.status).toBe(503);
    expect(deps.consumeToken).not.toHaveBeenCalled();
    expect(await response.text()).not.toContain(TOKEN);
  });

  it('garde le jeton historique consommé si la création du Recovery échoue', async () => {
    const deps = dependances();
    vi.mocked(deps.createRecoveryToken).mockResolvedValue(null);
    const response = await createActivationHandler(deps)(requete());

    expect(response.status).toBe(503);
    expect(deps.consumeToken).toHaveBeenCalledTimes(1);
    expect(deps.recordOutcome).toHaveBeenCalledWith(
      'attempt-1',
      'recovery_unavailable',
      '00000000-0000-4000-8000-000000000001',
    );
  });
});
