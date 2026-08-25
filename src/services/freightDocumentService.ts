import type {
  BullionSummaryData,
  ExportInvoiceData,
} from './freightInvoiceGenerationService';

export interface DocumentGenerationResult {
  bullionSummaryPath?: string;
  customsInvoicePath?: string;
}

export const FREIGHT_LEGACY_DOCUMENTS_ENABLED = false;

export class FreightLegacyDocumentsDisabledError extends Error {
  constructor() {
    super(
      'La génération documentaire de cet ancien module est désactivée : '
      + 'son stockage ne dispose pas encore d’un contrat serveur privé et atomique.',
    );
    this.name = 'FreightLegacyDocumentsDisabledError';
  }
}

function legacyStorageDisabled(): never {
  throw new FreightLegacyDocumentsDisabledError();
}

/**
 * Module volontairement fermé.
 *
 * `freight_shipments` stocke plusieurs références binaires directement sur la
 * ligne parent et le bucket historique `freight-documents` n'a ni RPC
 * autoritative d'attachement, ni politique privée liée au tenant. Réactiver ce
 * service sans ces deux contrats réintroduirait un upload public et un DML
 * navigateur. Les signatures sont conservées pour ne pas casser les appelants,
 * mais aucun octet ni chemin n'est envoyé au réseau.
 */
export const freightDocumentService = {
  async uploadPDF(
    _file: Blob,
    _fileName: string,
    _shipmentId: string,
  ): Promise<string> {
    return legacyStorageDisabled();
  },

  async generateAndUploadBullionSummary(
    _shipmentId: string,
    _data: BullionSummaryData,
  ): Promise<string> {
    return legacyStorageDisabled();
  },

  async generateAndUploadInvoice(
    _shipmentId: string,
    _data: ExportInvoiceData,
  ): Promise<string> {
    return legacyStorageDisabled();
  },

  async updateDocumentPaths(
    _shipmentId: string,
    _paths: DocumentGenerationResult,
  ): Promise<void> {
    return legacyStorageDisabled();
  },

  async generateAllDocuments(
    _shipmentId: string,
    _bullionData: BullionSummaryData,
    _invoiceData: ExportInvoiceData,
  ): Promise<DocumentGenerationResult> {
    return legacyStorageDisabled();
  },
};
