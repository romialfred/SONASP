const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type MetadonneesCertificatAnalyse = Record<string, unknown> & {
  fileName: string;
  shippingPreparationId: string;
};

/** Schéma fermé : le navigateur ne choisit ni bucket, ni chemin, ni acteur. */
export function parseMetadonneesCertificatAnalyse(
  raw: unknown,
): MetadonneesCertificatAnalyse | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const objet = raw as Record<string, unknown>;
  const cles = Object.keys(objet);
  if (
    cles.length !== 2
    || !cles.every((cle) => ['fileName', 'shippingPreparationId'].includes(cle))
    || typeof objet.fileName !== 'string'
    || typeof objet.shippingPreparationId !== 'string'
    || objet.fileName.length === 0
    || !UUID.test(objet.shippingPreparationId)
  ) return null;
  return {
    fileName: objet.fileName,
    shippingPreparationId: objet.shippingPreparationId,
  };
}

export interface ContexteAutorisationCertificatAnalyse {
  actorId: string;
  activeSession: boolean;
  canPrepareShipping: boolean;
  shippingPreparationId: string;
  targetExists: boolean;
}

/**
 * Le contrôle de capability, AAL2 et tenant reste autoritatif dans
 * snp_sec_can_prepare_shipping, exécutée avec le JWT de l'acteur.
 */
export function autoriserCertificatAnalyse(
  contexte: ContexteAutorisationCertificatAnalyse,
): { actorId: string; tenantId: string } | null {
  if (
    !UUID.test(contexte.actorId)
    || !UUID.test(contexte.shippingPreparationId)
    || !contexte.activeSession
    || !contexte.canPrepareShipping
    || !contexte.targetExists
  ) return null;
  return {
    actorId: contexte.actorId,
    tenantId: contexte.shippingPreparationId,
  };
}
