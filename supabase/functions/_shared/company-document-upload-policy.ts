const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TYPES_DOCUMENT = new Set(['rccm', 'ifu', 'autorisation', 'statuts', 'autre']);

export type MetadonneesDocumentSociete = Record<string, unknown> & {
  fileName: string;
  companyId: string;
  documentType: string;
};

/**
 * Schéma fermé des métadonnées envoyées dans l'en-tête du gateway. Aucune clé
 * fournie par le navigateur ne peut devenir un bucket, un chemin ou un acteur.
 */
export function parseMetadonneesDocumentSociete(raw: unknown): MetadonneesDocumentSociete | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const objet = raw as Record<string, unknown>;
  const cles = Object.keys(objet);
  if (
    cles.length !== 3
    || !cles.every((cle) => ['companyId', 'documentType', 'fileName'].includes(cle))
    || typeof objet.companyId !== 'string'
    || typeof objet.documentType !== 'string'
    || typeof objet.fileName !== 'string'
    || !UUID.test(objet.companyId)
    || !TYPES_DOCUMENT.has(objet.documentType)
    || objet.fileName.length === 0
  ) return null;
  return {
    companyId: objet.companyId,
    documentType: objet.documentType,
    fileName: objet.fileName,
  };
}

export interface ContexteAutorisationDocumentSociete {
  actorId: string;
  assurance: 'aal1' | 'aal2';
  actorActive: boolean;
  actorMiningCompanyId: string | null;
  capabilities: ReadonlySet<string>;
  canManageMiningRegistry?: boolean;
  targetCompanyId: string;
  targetCompanyActive: boolean;
}

/**
 * Politique pure et testable du profil de dépôt interne. Le tenant cible est
 * validé côté serveur, et un compte déjà rattaché à une mine ne peut pas se
 * transformer en administrateur transverse au moyen d'un override accidentel.
 */
export function autoriserDocumentSociete(
  contexte: ContexteAutorisationDocumentSociete,
): { actorId: string; tenantId: string } | null {
  const capacite = contexte.canManageMiningRegistry === true
    || contexte.capabilities.has('referentials.manage')
    || contexte.capabilities.has('sonasp.prepare');
  if (
    !contexte.actorActive
    || contexte.assurance !== 'aal2'
    || contexte.actorMiningCompanyId !== null
    || !capacite
    || !contexte.targetCompanyActive
  ) return null;
  return { actorId: contexte.actorId, tenantId: contexte.targetCompanyId };
}
