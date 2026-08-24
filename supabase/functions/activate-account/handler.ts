import { entetesCors, origineAutorisee, reponsePrevol } from '../_shared/cors.ts';

const TAILLE_MAXIMALE_CORPS = 2_048;
const FORMAT_JETON = /^[A-Za-z0-9_-]{32,128}$/;
const ERREUR_LIEN = 'Ce lien est invalide, expiré ou déjà utilisé.';
const ERREUR_SERVICE = 'La vérification du lien est momentanément indisponible.';

export type ResultatConsommation = {
  userId: string;
  tokenType: 'activation' | 'password_reset';
};

export type ResultatLimitation = {
  allowed: boolean;
  attemptId: string;
};

export type IssueTentative =
  | 'invalid'
  | 'rate_limited'
  | 'recovery_unavailable'
  | 'success';

export interface DependancesActivation {
  registerAttempt(req: Request): Promise<ResultatLimitation>;
  consumeToken(token: string, nowIso: string): Promise<ResultatConsommation | null>;
  createRecoveryToken(userId: string): Promise<string | null>;
  recordOutcome(attemptId: string, outcome: IssueTentative, userId?: string): Promise<void>;
  now?: () => Date;
}

function reponseSecurisee(req: Request, corps: unknown, statut: number): Response {
  return new Response(JSON.stringify(corps), {
    status: statut,
    headers: {
      ...entetesCors(req),
      'Cache-Control': 'no-store, max-age=0',
      'Content-Type': 'application/json; charset=utf-8',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

async function lireCorpsLimite(req: Request): Promise<unknown | null> {
  const longueurAnnoncee = Number(req.headers.get('Content-Length') ?? 0);
  if (Number.isFinite(longueurAnnoncee) && longueurAnnoncee > TAILLE_MAXIMALE_CORPS) return null;
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

function extraireJeton(corps: unknown): string | null {
  if (!corps || typeof corps !== 'object' || Array.isArray(corps)) return null;
  const objet = corps as Record<string, unknown>;
  if (Object.keys(objet).length !== 1 || typeof objet.token !== 'string') return null;
  return FORMAT_JETON.test(objet.token) ? objet.token : null;
}

async function journaliserSansBloquer(
  dependances: DependancesActivation,
  tentativeId: string,
  issue: IssueTentative,
  utilisateurId?: string,
): Promise<void> {
  try {
    await dependances.recordOutcome(tentativeId, issue, utilisateurId);
  } catch {
    // L'événement initial est déjà inscrit par registerAttempt. Ne jamais
    // journaliser ici l'erreur brute : elle pourrait contenir des données de la requête.
  }
}

export function createActivationHandler(dependances: DependancesActivation) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return reponsePrevol(req);

    // Un appel sans Origin n'est pas un parcours navigateur normal. Le refuser
    // évite qu'un client serveur contourne CORS pour consommer un lien à la place
    // de son destinataire.
    if (!origineAutorisee(req)) {
      return reponseSecurisee(req, { success: false, error: 'Requête non autorisée.' }, 403);
    }
    if (req.method !== 'POST') {
      return reponseSecurisee(req, { success: false, error: 'Méthode non autorisée.' }, 405);
    }
    if (!/^application\/json(?:\s*;|$)/i.test(req.headers.get('Content-Type') ?? '')) {
      return reponseSecurisee(req, { success: false, error: ERREUR_LIEN }, 400);
    }

    let limitation: ResultatLimitation;
    try {
      // La tentative est créée avant le comptage : elle est toujours incluse
      // dans sa propre fenêtre. L'atomicité stricte entre plusieurs instances
      // Edge nécessite un compteur transactionnel côté base (voir dépendances).
      limitation = await dependances.registerAttempt(req);
    } catch {
      return reponseSecurisee(req, { success: false, error: ERREUR_SERVICE }, 503);
    }

    if (!limitation.allowed) {
      await journaliserSansBloquer(dependances, limitation.attemptId, 'rate_limited');
      return reponseSecurisee(
        req,
        { success: false, error: 'Trop de tentatives. Réessayez plus tard.' },
        429,
      );
    }

    const jeton = extraireJeton(await lireCorpsLimite(req));
    if (!jeton) {
      await journaliserSansBloquer(dependances, limitation.attemptId, 'invalid');
      return reponseSecurisee(req, { success: false, error: ERREUR_LIEN }, 400);
    }

    let consommation: ResultatConsommation | null;
    try {
      consommation = await dependances.consumeToken(
        jeton,
        (dependances.now?.() ?? new Date()).toISOString(),
      );
    } catch {
      await journaliserSansBloquer(dependances, limitation.attemptId, 'recovery_unavailable');
      return reponseSecurisee(req, { success: false, error: ERREUR_SERVICE }, 503);
    }

    if (!consommation) {
      await journaliserSansBloquer(dependances, limitation.attemptId, 'invalid');
      return reponseSecurisee(req, { success: false, error: ERREUR_LIEN }, 400);
    }

    let jetonRecuperation: string | null = null;
    try {
      jetonRecuperation = await dependances.createRecoveryToken(consommation.userId);
    } catch {
      // Le jeton historique reste consommé : mieux vaut imposer une nouvelle
      // récupération que rendre possible sa réutilisation après une panne.
    }

    if (!jetonRecuperation) {
      await journaliserSansBloquer(
        dependances,
        limitation.attemptId,
        'recovery_unavailable',
        consommation.userId,
      );
      return reponseSecurisee(req, { success: false, error: ERREUR_SERVICE }, 503);
    }

    await journaliserSansBloquer(
      dependances,
      limitation.attemptId,
      'success',
      consommation.userId,
    );
    const suivant = `/modifier-mot-de-passe?token_hash=${encodeURIComponent(jetonRecuperation)}&type=recovery`;
    return reponseSecurisee(req, { success: true, next: suivant }, 200);
  };
}
