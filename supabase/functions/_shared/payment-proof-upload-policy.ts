const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type MetadonneesPreuvePaiement = Record<string, unknown> & {
  fileName: string;
  paymentId: string;
  idempotencyKey: string;
};

function nomValide(value: unknown): value is string {
  return typeof value === 'string'
    && value.trim() === value
    && value.length >= 3
    && value.length <= 255
    && !/[\u0000-\u001f\u007f/\\]/u.test(value)
    && !/[\u202a-\u202e\u2066-\u2069]/u.test(value);
}

/** Aucun chemin, vente, client, bucket ou acteur n'est fourni par le client. */
export function parseMetadonneesPreuvePaiement(raw: unknown): MetadonneesPreuvePaiement | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const objet = raw as Record<string, unknown>;
  const attendues = ['fileName', 'paymentId', 'idempotencyKey'];
  const cles = Object.keys(objet);
  if (
    cles.length !== attendues.length
    || !cles.every((cle) => attendues.includes(cle))
    || !nomValide(objet.fileName)
    || typeof objet.paymentId !== 'string' || !UUID.test(objet.paymentId)
    || typeof objet.idempotencyKey !== 'string' || !UUID.test(objet.idempotencyKey)
  ) return null;
  return objet as MetadonneesPreuvePaiement;
}

export interface ContexteAutorisationPreuvePaiement {
  actorId: string;
  paymentId: string;
  saleId: string;
  tenantId: string;
  activeSession: boolean;
  aal2: boolean;
  canExecuteFinance: boolean;
  canReadSale: boolean;
  paymentExists: boolean;
  paymentProcessing: boolean;
  saleVirtualPayment: boolean;
  actorExecutedPayment: boolean;
  paymentMatchesSaleAndTenant: boolean;
  sellerIsActiveSonasp: boolean;
}

export interface ConfirmationPreuvePaiementAttendue {
  paymentId: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  sha256: string;
  idempotencyKey: string;
}

export function confirmerPersistancePreuvePaiement(
  ligne: Record<string, unknown> | null | undefined,
  attendu: ConfirmationPreuvePaiementAttendue,
): { certain: boolean; resource: Record<string, unknown> | null } {
  if (ligne === undefined) return { certain: false, resource: null };
  if (ligne === null) return { certain: true, resource: null };
  const correspond = ligne.payment_id === attendu.paymentId
    && ligne.file_path === attendu.filePath
    && ligne.idempotency_key === attendu.idempotencyKey
    && ligne.sha256 === attendu.sha256
    && ligne.file_name === attendu.fileName
    && ligne.file_size === attendu.fileSize
    && ligne.mime_type === attendu.mimeType;
  return {
    certain: true,
    resource: correspond ? { ...ligne, replayed: true } : null,
  };
}

export function autoriserPreuvePaiement(
  contexte: ContexteAutorisationPreuvePaiement,
): { actorId: string; tenantId: string } | null {
  if (
    !UUID.test(contexte.actorId)
    || !UUID.test(contexte.paymentId)
    || !UUID.test(contexte.saleId)
    || !UUID.test(contexte.tenantId)
    || !contexte.activeSession
    || !contexte.aal2
    || !contexte.canExecuteFinance
    || !contexte.canReadSale
    || !contexte.paymentExists
    || !contexte.paymentProcessing
    || !contexte.saleVirtualPayment
    || !contexte.actorExecutedPayment
    || !contexte.paymentMatchesSaleAndTenant
    || !contexte.sellerIsActiveSonasp
  ) return null;
  return { actorId: contexte.actorId, tenantId: contexte.tenantId };
}
