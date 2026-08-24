const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const TYPES_DOCUMENT_FRET = [
  'customs_declaration', 'customs_approval', 'transport_document',
  'bill_of_lading', 'export_invoice', 'bullion_summary', 'other',
] as const;

export type TypeDocumentFret = typeof TYPES_DOCUMENT_FRET[number];

export type MetadonneesDocumentFret = Record<string, unknown> & {
  fileName: string;
  operationId: string;
  documentType: TypeDocumentFret;
  title: string;
  description: string | null;
};

function textePropre(value: unknown, min: number, max: number): value is string {
  return typeof value === 'string'
    && value.trim() === value
    && value.length >= min
    && value.length <= max
    && !/[\u0000-\u001f\u007f]/u.test(value);
}

/** Schéma fermé : aucun bucket, chemin, tenant ou acteur n'est choisi par le client. */
export function parseMetadonneesDocumentFret(raw: unknown): MetadonneesDocumentFret | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const objet = raw as Record<string, unknown>;
  const cles = Object.keys(objet);
  const attendues = ['fileName', 'operationId', 'documentType', 'title', 'description'];
  if (
    cles.length !== attendues.length
    || !cles.every((cle) => attendues.includes(cle))
    || !textePropre(objet.fileName, 1, 255)
    || typeof objet.operationId !== 'string'
    || !UUID.test(objet.operationId)
    || typeof objet.documentType !== 'string'
    || !TYPES_DOCUMENT_FRET.includes(objet.documentType as TypeDocumentFret)
    || !textePropre(objet.title, 3, 250)
    || !(objet.description === null || textePropre(objet.description, 1, 2_000))
  ) return null;
  return objet as MetadonneesDocumentFret;
}

export interface ContexteAutorisationDocumentFret {
  actorId: string;
  operationId: string;
  tenantId: string;
  activeSession: boolean;
  aal2: boolean;
  operationExists: boolean;
  tenantReadable: boolean;
  canPrepareFreight: boolean;
  mutableStatus: boolean;
}

export function autoriserDocumentFret(
  contexte: ContexteAutorisationDocumentFret,
): { actorId: string; tenantId: string } | null {
  if (
    !UUID.test(contexte.actorId)
    || !UUID.test(contexte.operationId)
    || !UUID.test(contexte.tenantId)
    || !contexte.activeSession
    || !contexte.aal2
    || !contexte.operationExists
    || !contexte.tenantReadable
    || !contexte.canPrepareFreight
    || !contexte.mutableStatus
  ) return null;
  return { actorId: contexte.actorId, tenantId: contexte.tenantId };
}
