const FORMAT_JETON_ACTIVATION = /^[A-Za-z0-9_-]{32,128}$/;
const FORMAT_JETON_RECUPERATION = /^[A-Za-z0-9._~-]{16,512}$/;

export class AccountActivationError extends Error {
  constructor() {
    super('ACCOUNT_ACTIVATION_REJECTED');
    this.name = 'AccountActivationError';
  }
}

export function isActivationTokenShape(token: unknown): token is string {
  return typeof token === 'string' && FORMAT_JETON_ACTIVATION.test(token);
}

function destinationRecoverySecurisee(destination: unknown): string | null {
  if (typeof destination !== 'string' || !destination.startsWith('/') || destination.startsWith('//')) {
    return null;
  }

  const origine = typeof window !== 'undefined' ? window.location.origin : 'https://sonasp.invalid';
  try {
    const url = new URL(destination, origine);
    const jetons = url.searchParams.getAll('token_hash');
    const types = url.searchParams.getAll('type');
    const cles = Array.from(url.searchParams.keys());
    if (
      url.origin !== origine
      || url.pathname !== '/modifier-mot-de-passe'
      || url.hash
      || cles.some((cle) => cle !== 'token_hash' && cle !== 'type')
      || jetons.length !== 1
      || types.length !== 1
      || types[0] !== 'recovery'
      || !FORMAT_JETON_RECUPERATION.test(jetons[0])
    ) {
      return null;
    }
    return `${url.pathname}?token_hash=${encodeURIComponent(jetons[0])}&type=recovery`;
  } catch {
    return null;
  }
}

/**
 * Échange un ancien jeton opaque contre une destination Recovery GoTrue.
 * Aucun RPC de la base ni aucune clé privilégiée n'est accessible au navigateur.
 */
export async function exchangeActivationToken(token: string, signal?: AbortSignal): Promise<string> {
  if (!isActivationTokenShape(token)) throw new AccountActivationError();

  const baseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!baseUrl) throw new AccountActivationError();

  let response: Response;
  try {
    response = await fetch(`${baseUrl.replace(/\/$/, '')}/functions/v1/activate-account`, {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
      cache: 'no-store',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
  } catch {
    throw new AccountActivationError();
  }

  if (!response.ok || !response.headers.get('Content-Type')?.toLowerCase().includes('application/json')) {
    throw new AccountActivationError();
  }

  const resultat = await response.json().catch(() => null) as {
    success?: unknown;
    next?: unknown;
  } | null;
  const destination = resultat?.success === true
    ? destinationRecoverySecurisee(resultat.next)
    : null;
  if (!destination) throw new AccountActivationError();
  return destination;
}
