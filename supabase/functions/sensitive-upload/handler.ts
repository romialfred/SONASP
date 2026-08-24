import { entetesCors, origineAutorisee, reponsePrevol } from '../_shared/cors.ts';
import {
  ErreurValidationUploadServeur,
  type PolitiqueUploadServeur,
  type UploadServeurValide,
  validerUploadServeur,
} from '../_shared/secure-upload.ts';

const TAILLE_MAXIMALE_METADONNEES = 2_048;
const FORMAT_JETON = /^[A-Za-z0-9._~-]{20,8192}$/;

export type MetadonneesUpload = Record<string, unknown> & { fileName: string };

export interface ProfilGatewayUpload {
  policy: PolitiqueUploadServeur;
  parseMetadata(raw: unknown): MetadonneesUpload | null;
}

export type ResultatAutorisationUpload =
  | { allowed: true; actorId: string; tenantId: string }
  | { allowed: false; status: 401 | 403 | 503 };

export interface ContextePersistanceUpload {
  profileId: string;
  actorId: string;
  tenantId: string;
  metadata: MetadonneesUpload;
  file: UploadServeurValide;
  bytes: Uint8Array;
  /** JWT déjà vérifié, réservé aux RPC métier exécutées sous identité acteur. */
  token: string;
}

export interface DependancesGatewayUpload {
  profiles: Readonly<Record<string, ProfilGatewayUpload>>;
  authorize(input: {
    profileId: string;
    token: string;
    metadata: MetadonneesUpload;
  }): Promise<ResultatAutorisationUpload>;
  persist(input: ContextePersistanceUpload): Promise<unknown>;
  remove?(input: { profileId: string; resourceId: string; token: string }): Promise<void>;
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

function extraireJeton(req: Request): string | null {
  const autorisation = req.headers.get('Authorization') ?? '';
  const correspondance = autorisation.match(/^Bearer ([A-Za-z0-9._~-]{20,8192})$/);
  return correspondance && FORMAT_JETON.test(correspondance[1]) ? correspondance[1] : null;
}

function decoderMetadonnees(req: Request, profil: ProfilGatewayUpload): MetadonneesUpload | null {
  const encodees = req.headers.get('X-Upload-Metadata') ?? '';
  if (!encodees || encodees.length > TAILLE_MAXIMALE_METADONNEES) return null;
  try {
    const decodees = decodeURIComponent(encodees);
    if (new TextEncoder().encode(decodees).byteLength > TAILLE_MAXIMALE_METADONNEES) return null;
    return profil.parseMetadata(JSON.parse(decodees));
  } catch {
    return null;
  }
}

function longueurAnnoncee(req: Request): number | null | 'invalid' {
  const valeur = req.headers.get('Content-Length');
  if (valeur === null) return null;
  if (!/^[0-9]{1,10}$/.test(valeur)) return 'invalid';
  const longueur = Number(valeur);
  return Number.isSafeInteger(longueur) ? longueur : 'invalid';
}

async function lireCorpsBorne(req: Request, maximum: number): Promise<Uint8Array | null> {
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
      if (taille > maximum) {
        await lecteur.cancel();
        return null;
      }
      morceaux.push(value);
    }
  } catch {
    return null;
  }
  if (taille === 0) return null;

  const resultat = new Uint8Array(taille);
  let position = 0;
  for (const morceau of morceaux) {
    resultat.set(morceau, position);
    position += morceau.byteLength;
  }
  return resultat;
}

export function createSensitiveUploadHandler(dependances: DependancesGatewayUpload) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return reponsePrevol(req);
    if (!origineAutorisee(req)) {
      return reponseSecurisee(req, { success: false, error: 'Requête non autorisée.' }, 403);
    }
    if (req.method !== 'POST' && req.method !== 'DELETE') {
      return reponseSecurisee(req, { success: false, error: 'Méthode non autorisée.' }, 405);
    }

    const url = new URL(req.url);
    if (req.method === 'DELETE') {
      const cles = Array.from(url.searchParams.keys());
      const profileId = url.searchParams.get('profile') ?? '';
      const resourceId = url.searchParams.get('resourceId') ?? '';
      const token = extraireJeton(req);
      if (
        cles.length !== 2 || !cles.every((cle) => cle === 'profile' || cle === 'resourceId')
        || url.searchParams.getAll('profile').length !== 1
        || url.searchParams.getAll('resourceId').length !== 1
        || !dependances.profiles[profileId]
        || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(resourceId)
        || !token || !dependances.remove
        || (req.headers.get('Content-Length') !== null && req.headers.get('Content-Length') !== '0')
      ) return reponseSecurisee(req, { success: false, error: 'Requête de suppression invalide.' }, 400);
      try {
        await dependances.remove({ profileId, resourceId, token });
        return reponseSecurisee(req, { success: true }, 200);
      } catch {
        return reponseSecurisee(req, { success: false, error: 'Le document n’a pas pu être supprimé.' }, 503);
      }
    }

    if (
      Array.from(url.searchParams.keys()).some((cle) => cle !== 'profile')
      || url.searchParams.getAll('profile').length !== 1
    ) {
      return reponseSecurisee(req, { success: false, error: 'Requête de dépôt invalide.' }, 400);
    }
    const profileId = url.searchParams.get('profile') ?? '';
    const profil = dependances.profiles[profileId];
    if (!profil) {
      return reponseSecurisee(req, { success: false, error: 'Profil de dépôt invalide.' }, 400);
    }
    if ((req.headers.get('Content-Encoding') ?? 'identity').toLowerCase() !== 'identity') {
      return reponseSecurisee(req, { success: false, error: 'Encodage de fichier refusé.' }, 415);
    }

    const longueur = longueurAnnoncee(req);
    if (longueur === 'invalid' || longueur === 0) {
      return reponseSecurisee(req, { success: false, error: 'Fichier invalide.' }, 400);
    }
    if (longueur !== null && longueur > profil.policy.maxBytes) {
      return reponseSecurisee(req, { success: false, error: 'Le fichier dépasse la taille autorisée.' }, 413);
    }

    const metadata = decoderMetadonnees(req, profil);
    const token = extraireJeton(req);
    if (!metadata || !token) {
      return reponseSecurisee(req, { success: false, error: 'Requête de dépôt invalide.' }, 400);
    }

    let autorisation: ResultatAutorisationUpload;
    try {
      autorisation = await dependances.authorize({ profileId, token, metadata });
    } catch {
      autorisation = { allowed: false, status: 503 };
    }
    if (!autorisation.allowed) {
      const message = autorisation.status === 503
        ? 'Le service de dépôt est momentanément indisponible.'
        : 'Ce dépôt n’est pas autorisé.';
      return reponseSecurisee(req, { success: false, error: message }, autorisation.status);
    }

    const octets = await lireCorpsBorne(req, profil.policy.maxBytes);
    if (!octets) {
      return reponseSecurisee(req, { success: false, error: 'Le fichier dépasse la taille autorisée.' }, 413);
    }
    if (typeof longueur === 'number' && longueur !== octets.byteLength) {
      return reponseSecurisee(req, { success: false, error: 'Fichier incomplet.' }, 400);
    }

    let fichier: UploadServeurValide;
    try {
      fichier = validerUploadServeur({
        fileName: metadata.fileName,
        declaredMimeType: req.headers.get('Content-Type') ?? '',
        bytes: octets,
      }, profil.policy);
    } catch (erreur) {
      const statut = erreur instanceof ErreurValidationUploadServeur && erreur.code === 'size' ? 413 : 415;
      return reponseSecurisee(
        req,
        { success: false, error: 'Le type réel du fichier n’est pas autorisé.' },
        statut,
      );
    }

    try {
      const resource = await dependances.persist({
        profileId,
        actorId: autorisation.actorId,
        tenantId: autorisation.tenantId,
        metadata,
        file: fichier,
        bytes: octets,
        token,
      });
      return reponseSecurisee(req, {
        success: true,
        validationStatus: 'format_validated',
        resource,
      }, 201);
    } catch {
      return reponseSecurisee(
        req,
        { success: false, error: 'Le fichier n’a pas pu être enregistré.' },
        503,
      );
    }
  };
}
