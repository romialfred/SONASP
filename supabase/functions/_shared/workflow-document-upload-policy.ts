const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function objetFerme(
  raw: unknown,
  cles: readonly string[],
): Record<string, unknown> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const objet = raw as Record<string, unknown>;
  const presentes = Object.keys(objet);
  return presentes.length === cles.length && presentes.every((cle) => cles.includes(cle))
    ? objet
    : null;
}

function texteValide(value: unknown, max: number): value is string {
  return typeof value === 'string'
    && value.trim() === value
    && value.length > 0
    && value.length <= max
    && !/[\u0000-\u001f\u007f]/u.test(value);
}

export type MetadonneesDocumentExpedition = Record<string, unknown> & {
  fileName: string;
  shippingPreparationId: string;
  title: string;
};

export function parseMetadonneesDocumentExpedition(
  raw: unknown,
): MetadonneesDocumentExpedition | null {
  const objet = objetFerme(raw, ['fileName', 'shippingPreparationId', 'title']);
  if (
    !objet
    || !texteValide(objet.fileName, 255)
    || typeof objet.shippingPreparationId !== 'string'
    || !UUID.test(objet.shippingPreparationId)
    || !texteValide(objet.title, 200)
  ) return null;
  return {
    fileName: objet.fileName,
    shippingPreparationId: objet.shippingPreparationId,
    title: objet.title,
  };
}

export type MetadonneesDocumentProduction = Record<string, unknown> & {
  fileName: string;
  productionId: string;
  documentName: string;
};

export function parseMetadonneesDocumentProduction(
  raw: unknown,
): MetadonneesDocumentProduction | null {
  const objet = objetFerme(raw, ['fileName', 'productionId', 'documentName']);
  if (
    !objet
    || !texteValide(objet.fileName, 255)
    || typeof objet.productionId !== 'string'
    || !UUID.test(objet.productionId)
    || !texteValide(objet.documentName, 200)
  ) return null;
  return {
    fileName: objet.fileName,
    productionId: objet.productionId,
    documentName: objet.documentName,
  };
}

export interface ContexteAutorisationDocumentWorkflow {
  actorId: string;
  parentId: string;
  tenantId: string;
  activeSession: boolean;
  aal2: boolean;
  parentExists: boolean;
  parentPermission: boolean;
  hasWriteCapability: boolean;
}

/** Toutes les preuves sont obligatoires : une erreur RPC ne devient jamais une autorisation. */
export function autoriserDocumentWorkflow(
  contexte: ContexteAutorisationDocumentWorkflow,
): { actorId: string; tenantId: string } | null {
  if (
    !UUID.test(contexte.actorId)
    || !UUID.test(contexte.parentId)
    || !UUID.test(contexte.tenantId)
    || !contexte.activeSession
    || !contexte.aal2
    || !contexte.parentExists
    || !contexte.parentPermission
    || !contexte.hasWriteCapability
  ) return null;
  return { actorId: contexte.actorId, tenantId: contexte.tenantId };
}
