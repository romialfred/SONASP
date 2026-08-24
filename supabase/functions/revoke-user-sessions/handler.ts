import { entetesCors, origineAutorisee, reponsePrevol } from '../_shared/cors.ts';

const TAILLE_MAXIMALE_CORPS = 2_048;
const FORMAT_JETON = /^[A-Za-z0-9._~-]{20,8192}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type AutorisationRevocation =
  | {
      allowed: true;
      targetUserId: string;
      isSelf: boolean;
    }
  | { allowed: false; status: 401 | 403 | 503 };

export type ResultatRevocationApplicative =
  | { ok: true; revokedCount: number }
  | { ok: false; status: 403 | 503 };

export interface DependancesRevocationSessions {
  authorize(input: {
    token: string;
    requestedTargetUserId: string | null;
  }): Promise<AutorisationRevocation>;
  revokeApplicationSessions(input: {
    token: string;
    targetUserId: string;
    exceptCurrentSession: boolean;
    reason: string;
  }): Promise<ResultatRevocationApplicative>;
  revokeOwnRefreshTokens(input: {
    token: string;
    scope: 'global' | 'others';
  }): Promise<boolean>;
}

type RequeteRevocation = {
  targetUserId: string | null;
  exceptCurrentSession: boolean;
  reason: string;
};

function reponseSecurisee(req: Request, corps: unknown, statut: number): Response {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: {
      ...entetesCors(req),
      'Cache-Control': 'no-store, max-age=0',
      'Content-Type': 'application/json; charset=utf-8',
      Pragma: 'no-cache',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function extraireJeton(req: Request): string | null {
  const correspondance = (req.headers.get('Authorization') ?? '')
    .match(/^Bearer ([A-Za-z0-9._~-]{20,8192})$/);
  return correspondance && FORMAT_JETON.test(correspondance[1]) ? correspondance[1] : null;
}

async function lireCorpsLimite(req: Request): Promise<unknown | null> {
  const longueurAnnoncee = req.headers.get('Content-Length');
  if (longueurAnnoncee !== null) {
    if (!/^[0-9]{1,10}$/.test(longueurAnnoncee)) return null;
    if (Number(longueurAnnoncee) > TAILLE_MAXIMALE_CORPS) return null;
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
      if (taille > TAILLE_MAXIMALE_CORPS) {
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
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(octets));
  } catch {
    return null;
  }
}

function analyserRequete(corps: unknown): RequeteRevocation | null {
  if (!corps || typeof corps !== 'object' || Array.isArray(corps)) return null;
  const objet = corps as Record<string, unknown>;
  const cles = Object.keys(objet).sort();
  if (
    cles.length !== 3
    || cles[0] !== 'except_current_session'
    || cles[1] !== 'reason'
    || cles[2] !== 'target_user_id'
  ) return null;

  const cible = objet.target_user_id;
  if (cible !== null && (typeof cible !== 'string' || !UUID.test(cible))) return null;
  if (typeof objet.except_current_session !== 'boolean') return null;
  if (typeof objet.reason !== 'string') return null;
  const motif = objet.reason.trim();
  if (motif.length < 10 || motif.length > 500 || /[\u0000-\u001F\u007F]/u.test(motif)) return null;

  return {
    targetUserId: cible,
    exceptCurrentSession: objet.except_current_session,
    reason: motif,
  };
}

export function createRevokeUserSessionsHandler(dependances: DependancesRevocationSessions) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return reponsePrevol(req);
    if (!origineAutorisee(req)) {
      return reponseSecurisee(req, { success: false, error: 'Requête non autorisée.' }, 403);
    }
    if (req.method !== 'POST') {
      return reponseSecurisee(req, { success: false, error: 'Méthode non autorisée.' }, 405);
    }
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers.get('Content-Type') ?? '')) {
      return reponseSecurisee(req, { success: false, error: 'Requête invalide.' }, 400);
    }

    const token = extraireJeton(req);
    const demande = analyserRequete(await lireCorpsLimite(req));
    if (!token) {
      return reponseSecurisee(req, { success: false, error: 'Votre session n’est plus valide.' }, 401);
    }
    if (!demande) {
      return reponseSecurisee(req, { success: false, error: 'Requête invalide.' }, 400);
    }

    let autorisation: AutorisationRevocation;
    try {
      autorisation = await dependances.authorize({
        token,
        requestedTargetUserId: demande.targetUserId,
      });
    } catch {
      autorisation = { allowed: false, status: 503 };
    }
    if (!autorisation.allowed) {
      const message = autorisation.status === 401
        ? 'Votre session n’est plus valide.'
        : autorisation.status === 403
          ? 'Cette révocation n’est pas autorisée.'
          : 'La vérification de sécurité est momentanément indisponible.';
      return reponseSecurisee(req, { success: false, error: message }, autorisation.status);
    }

    let resultat: ResultatRevocationApplicative;
    try {
      resultat = await dependances.revokeApplicationSessions({
        token,
        targetUserId: autorisation.targetUserId,
        exceptCurrentSession: demande.exceptCurrentSession,
        reason: demande.reason,
      });
    } catch {
      resultat = { ok: false, status: 503 };
    }
    if (!resultat.ok) {
      const message = resultat.status === 403
        ? 'Cette révocation n’est pas autorisée.'
        : 'La révocation des sessions est momentanément indisponible.';
      return reponseSecurisee(req, { success: false, error: message }, resultat.status);
    }

    if (!autorisation.isSelf) {
      return reponseSecurisee(req, {
        success: true,
        mode: 'application_registry_only',
        revoked_count: resultat.revokedCount,
        application_sessions_revoked: true,
        refresh_tokens_revoked: false,
        access_tokens_revoked: false,
      }, 200);
    }

    const scope = demande.exceptCurrentSession ? 'others' : 'global';
    let refreshTokensRevoked = false;
    try {
      refreshTokensRevoked = await dependances.revokeOwnRefreshTokens({ token, scope });
    } catch {
      refreshTokensRevoked = false;
    }
    if (!refreshTokensRevoked) {
      return reponseSecurisee(req, {
        success: false,
        mode: 'partial_application_only',
        revoked_count: resultat.revokedCount,
        application_sessions_revoked: true,
        refresh_tokens_revoked: false,
        access_tokens_revoked: false,
        error: 'La révocation Auth complète n’a pas pu être confirmée.',
      }, 502);
    }

    return reponseSecurisee(req, {
      success: true,
      mode: scope === 'global' ? 'strong_self_global' : 'strong_self_others',
      revoked_count: resultat.revokedCount,
      application_sessions_revoked: true,
      refresh_tokens_revoked: true,
      access_tokens_revoked: false,
    }, 200);
  };
}
