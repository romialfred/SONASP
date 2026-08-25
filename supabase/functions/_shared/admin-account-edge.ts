import { origineAutorisee, reponseJson, reponsePrevol } from './cors.ts';

const FORMAT_JETON = /^[A-Za-z0-9._~-]{20,8192}$/;
const TAILLE_CORPS_PAR_DEFAUT = 8_192;

export const ACCOUNT_ADMIN_CAPABILITY = 'accounts.manage';

export type ErreurRpc = { code?: string; message?: string } | null;

export interface ClientRpc {
  rpc(
    fonction: string,
    parametres?: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: ErreurRpc }>;
}

export async function appelerRpcIdempotent(
  client: ClientRpc,
  fonction: string,
  parametres: Record<string, unknown>,
): Promise<{ data: unknown; error: ErreurRpc }> {
  const premier = await client.rpc(fonction, parametres);
  if (!premier.error) return premier;
  return client.rpc(fonction, parametres);
}

export type ResultatGardeAdministration =
  | { ok: true }
  | { ok: false; status: 401 | 403 | 503 };

export function extraireJetonBearer(req: Request): string | null {
  const correspondance = (req.headers.get('Authorization') ?? '')
    .match(/^Bearer\s+([A-Za-z0-9._~-]{20,8192})$/i);
  return correspondance && FORMAT_JETON.test(correspondance[1])
    ? correspondance[1]
    : null;
}

function ligneSession(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  return data as Record<string, unknown>;
}

function statutErreurSession(error: ErreurRpc): 401 | 403 | 503 {
  if (error?.code === 'P0002') return 401;
  if (error?.code === '42501' || error?.code === '22023') return 403;
  return 503;
}

/**
 * Garde canonique préalable à tout usage de la clé service_role.
 *
 * Le heartbeat vérifie l'empreinte `session_id` du JWT contre le registre 4C ;
 * `snp_actor_has_capability` seul ne suffit pas, car il ne consulte pas ce
 * registre. Les deux appels utilisent obligatoirement le JWT de l'acteur.
 */
export async function verifierSessionAdministration(
  client: ClientRpc,
): Promise<ResultatGardeAdministration> {
  let session: { data: unknown; error: ErreurRpc };
  try {
    session = await client.rpc('snp_session_signaler_activite');
  } catch {
    return { ok: false, status: 503 };
  }
  if (session.error) return { ok: false, status: statutErreurSession(session.error) };

  const courante = ligneSession(session.data);
  if (courante?.is_active !== true || courante?.is_current !== true) {
    return { ok: false, status: 403 };
  }

  let capacite: { data: unknown; error: ErreurRpc };
  try {
    capacite = await client.rpc('snp_actor_has_capability', {
      p_capability_code: ACCOUNT_ADMIN_CAPABILITY,
    });
  } catch {
    return { ok: false, status: 503 };
  }
  if (capacite.error) return { ok: false, status: 503 };
  return capacite.data === true
    ? { ok: true }
    : { ok: false, status: 403 };
}

export async function lireJsonLimite(
  req: Request,
  tailleMaximale = TAILLE_CORPS_PAR_DEFAUT,
): Promise<Record<string, unknown> | null> {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers.get('Content-Type') ?? '')) {
    return null;
  }

  const longueur = req.headers.get('Content-Length');
  if (longueur !== null && (!/^[0-9]{1,10}$/.test(longueur) || Number(longueur) > tailleMaximale)) {
    return null;
  }
  if (!req.body) return null;

  const lecteur = req.body.getReader();
  const morceaux: Uint8Array[] = [];
  let taille = 0;
  try {
    while (true) {
      const { value, done } = await lecteur.read();
      if (done) break;
      if (!value) continue;
      taille += value.byteLength;
      if (taille > tailleMaximale) {
        await lecteur.cancel();
        return null;
      }
      morceaux.push(value);
    }
  } catch {
    return null;
  }

  const octets = new Uint8Array(taille);
  let position = 0;
  for (const morceau of morceaux) {
    octets.set(morceau, position);
    position += morceau.byteLength;
  }
  try {
    const valeur = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(octets));
    return valeur && typeof valeur === 'object' && !Array.isArray(valeur)
      ? valeur as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

export interface ContexteHandlerAdministration {
  token: string;
  authorization: string;
}

export function creerHandlerAdministration(options: {
  methods: readonly string[];
  execute(req: Request, contexte: ContexteHandlerAdministration): Promise<Response>;
  unexpectedError: string;
}) {
  const methods = new Set(options.methods.map((method) => method.toUpperCase()));
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return reponsePrevol(req);
    if (req.headers.get('Origin') && !origineAutorisee(req)) {
      return reponseJson(req, { success: false, error: 'Requête non autorisée.' }, 403);
    }
    if (!methods.has(req.method.toUpperCase())) {
      return reponseJson(req, { success: false, error: 'Méthode non autorisée.' }, 405);
    }

    const token = extraireJetonBearer(req);
    if (!token) {
      return reponseJson(req, { success: false, error: 'Votre session n’est plus valide.' }, 401);
    }
    try {
      return await options.execute(req, {
        token,
        authorization: `Bearer ${token}`,
      });
    } catch {
      return reponseJson(req, { success: false, error: options.unexpectedError }, 500);
    }
  };
}
