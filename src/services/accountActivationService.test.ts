import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AccountActivationError,
  exchangeActivationToken,
  isActivationTokenShape,
} from './accountActivationService';

const TOKEN = 'A'.repeat(43);

describe('accountActivationService', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('valide strictement le format historique avant tout appel réseau', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');

    expect(isActivationTokenShape(TOKEN)).toBe(true);
    expect(isActivationTokenShape('court')).toBe(false);
    await expect(exchangeActivationToken('court')).rejects.toBeInstanceOf(AccountActivationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('appelle uniquement l’Edge Function et accepte une destination Recovery relative', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      success: true,
      next: '/modifier-mot-de-passe?token_hash=abcdef0123456789abcdef0123456789&type=recovery',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    await expect(exchangeActivationToken(TOKEN)).resolves.toBe(
      '/modifier-mot-de-passe?token_hash=abcdef0123456789abcdef0123456789&type=recovery',
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/functions/v1/activate-account'),
      expect.objectContaining({
        method: 'POST',
        credentials: 'omit',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
      }),
    );
    const options = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(options.body))).toEqual({ token: TOKEN });
    expect(options.headers).not.toHaveProperty('Authorization');
  });

  it.each([
    'https://evil.example/modifier-mot-de-passe?token_hash=abcdef0123456789&type=recovery',
    '//evil.example/modifier-mot-de-passe?token_hash=abcdef0123456789&type=recovery',
    '/admin?token_hash=abcdef0123456789&type=recovery',
    '/modifier-mot-de-passe?token_hash=abcdef0123456789&type=recovery&next=/admin',
  ])('rejette une destination serveur non conforme: %s', async (next) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ success: true, next }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    await expect(exchangeActivationToken(TOKEN)).rejects.toBeInstanceOf(AccountActivationError);
  });

  it('ne restitue pas le détail public ou technique d’un rejet serveur', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      success: false,
      error: 'internal table detail',
    }), { status: 503, headers: { 'Content-Type': 'application/json' } }));

    await expect(exchangeActivationToken(TOKEN)).rejects.toEqual(
      expect.objectContaining({ message: 'ACCOUNT_ACTIVATION_REJECTED' }),
    );
  });
});
