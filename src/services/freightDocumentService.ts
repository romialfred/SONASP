import { supabase } from '@/lib/supabase';
import {
  freightInvoiceGenerationService,
  BullionSummaryData,
  ExportInvoiceData
} from './freightInvoiceGenerationService';

export interface DocumentGenerationResult {
  bullionSummaryPath?: string;
  customsInvoicePath?: string;
}

export const freightDocumentService = {
  /**
   * Upload un PDF vers Supabase Storage et retourne l'URL publique
   */
  async uploadPDF(
    file: Blob,
    fileName: string,
    shipmentId: string
  ): Promise<string> {
    const path = `${shipmentId}/${fileName}`;

    const { data, error } = await supabase.storage
      .from('freight-documents')
      .upload(path, file, {
        contentType: 'application/pdf',
        upsert: true
      });

    if (error) {
      console.error('Erreur upload PDF:', error);
      throw new Error(`Erreur lors de l'upload du PDF: ${error.message}`);
    }

    const { data: { publicUrl } } = supabase.storage
      .from('freight-documents')
      .getPublicUrl(path);

    return publicUrl;
  },

  /**
   * Génère et upload le Bullion Summary
   */
  async generateAndUploadBullionSummary(
    shipmentId: string,
    data: BullionSummaryData
  ): Promise<string> {
    try {
      const pdf = freightInvoiceGenerationService.generateBullionSummary(data);
      const blob = freightInvoiceGenerationService.getPDFBlob(pdf);
      const fileName = `bullion-summary-${data.shipmentNumber}.pdf`;
      return await this.uploadPDF(blob, fileName, shipmentId);
    } catch (error: any) {
      console.error('Erreur génération Bullion Summary:', error);
      throw new Error(`Erreur génération Bullion Summary: ${error.message}`);
    }
  },

  /**
   * Génère et upload l'Invoice pour la douane
   */
  async generateAndUploadInvoice(
    shipmentId: string,
    data: ExportInvoiceData
  ): Promise<string> {
    try {
      const pdf = freightInvoiceGenerationService.generateExportInvoice(data);
      const blob = freightInvoiceGenerationService.getPDFBlob(pdf);
      const fileName = `customs-invoice-${data.invoiceNumber}.pdf`;
      return await this.uploadPDF(blob, fileName, shipmentId);
    } catch (error: any) {
      console.error('Erreur génération Invoice:', error);
      throw new Error(`Erreur génération Invoice: ${error.message}`);
    }
  },

  /**
   * Met à jour les chemins des documents dans la base de données
   */
  async updateDocumentPaths(
    shipmentId: string,
    paths: {
      bullionSummaryPath?: string;
      customsInvoicePath?: string;
    }
  ): Promise<void> {
    const updates: any = {};

    if (paths.bullionSummaryPath) {
      updates.bullion_summary_pdf_path = paths.bullionSummaryPath;
    }
    if (paths.customsInvoicePath) {
      updates.customs_invoice_pdf_path = paths.customsInvoicePath;
    }

    if (Object.keys(updates).length === 0) {
      return;
    }

    const { error } = await supabase
      .from('freight_shipments')
      .update(updates)
      .eq('id', shipmentId);

    if (error) {
      console.error('Erreur mise à jour paths:', error);
      throw new Error(`Erreur mise à jour des chemins: ${error.message}`);
    }
  },

  /**
   * Génère tous les documents pour une expédition
   */
  async generateAllDocuments(
    shipmentId: string,
    bullionData: BullionSummaryData,
    invoiceData: ExportInvoiceData
  ): Promise<DocumentGenerationResult> {
    const result: DocumentGenerationResult = {};

    try {
      const bullionPath = await this.generateAndUploadBullionSummary(
        shipmentId,
        bullionData
      );
      result.bullionSummaryPath = bullionPath;
    } catch (error: any) {
      console.error('Erreur Bullion Summary:', error);
      throw error;
    }

    try {
      const invoicePath = await this.generateAndUploadInvoice(
        shipmentId,
        invoiceData
      );
      result.customsInvoicePath = invoicePath;
    } catch (error: any) {
      console.error('Erreur Invoice:', error);
      throw error;
    }

    await this.updateDocumentPaths(shipmentId, {
      bullionSummaryPath: result.bullionSummaryPath,
      customsInvoicePath: result.customsInvoicePath
    });

    return result;
  }
};
