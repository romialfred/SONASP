import { supabase } from '@/lib/supabase';

export interface PaymentDocument {
  id: string;
  name: string;
  type: 'production' | 'shipping' | 'refining' | 'sale' | 'export_license' | 'assay_certificate' | 'payment_proof';
  url: string;
  uploadedAt: string;
  size?: number;
  metadata?: {
    batchNumber?: string;
    certificateNumber?: string;
    licenseNumber?: string;
    description?: string;
  };
}

export interface DocumentStats {
  total: number;
  byCategory: Record<string, number>;
  hasPaymentProof: boolean;
}

/**
 * Collects all documents related to a payment from multiple sources
 * Documents are gathered from:
 * - Payment proof uploads
 * - Production documents (from batches)
 * - Assay certificates
 * - Shipping documents
 * - Export licenses
 * - Refining documents
 * - Sale documents
 */
export async function collectPaymentDocuments(paymentId: string): Promise<PaymentDocument[]> {
  const documents: PaymentDocument[] = [];

  try {
    // 1. Get payment and related sale information
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('*, sale:sales(*)')
      .eq('id', paymentId)
      .single();

    if (paymentError) throw paymentError;
    if (!payment) return [];

    // 2. Add payment proof if exists
    if (payment.proof_url) {
      documents.push({
        id: `payment-proof-${payment.id}`,
        name: 'Payment Proof',
        type: 'payment_proof',
        url: payment.proof_url,
        uploadedAt: payment.updated_at || payment.created_at,
        metadata: {
          description: 'Payment confirmation document',
        },
      });
    }

    const sale = payment.sale;
    if (!sale) return documents;

    // 3. Get production documents from batches related to this sale
    const { data: productions } = await supabase
      .from('daily_production')
      .select('id, batch_number, production_date')
      .eq('status', 'sold')
      .order('production_date', { ascending: false });

    if (productions && productions.length > 0) {
      // For each production, get documents
      const { data: prodDocs } = await supabase
        .from('production_documents')
        .select('*')
        .in('production_id', productions.map(p => p.id));

      if (prodDocs) {
        for (const doc of prodDocs) {
          const production = productions.find(p => p.id === doc.production_id);
          documents.push({
            id: doc.id,
            name: doc.document_name || doc.document_type || 'Production Document',
            type: 'production',
            url: doc.document_url,
            uploadedAt: doc.uploaded_at,
            metadata: {
              batchNumber: production?.batch_number,
              description: `Production document from batch ${production?.batch_number}`,
            },
          });
        }
      }
    }

    // 4. Get assay certificates (approved only)
    const { data: assayCerts } = await supabase
      .from('assay_certificates')
      .select('*')
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(10);

    if (assayCerts) {
      for (const cert of assayCerts) {
        if (cert.certificate_url) {
          documents.push({
            id: cert.id,
            name: `Assay Certificate ${cert.certificate_number || ''}`,
            type: 'assay_certificate',
            url: cert.certificate_url,
            uploadedAt: cert.created_at,
            metadata: {
              certificateNumber: cert.certificate_number,
              description: `Assay certificate ${cert.certificate_number}`,
            },
          });
        }
      }
    }

    // 5. Get shipping documents from Supabase Storage
    const { data: shippingFiles } = await supabase
      .storage
      .from('shipping-documents')
      .list('', { limit: 100 });

    if (shippingFiles) {
      for (const file of shippingFiles) {
        const { data: urlData } = supabase
          .storage
          .from('shipping-documents')
          .getPublicUrl(file.name);

        if (urlData) {
          documents.push({
            id: `shipping-${file.id}`,
            name: file.name,
            type: 'shipping',
            url: urlData.publicUrl,
            uploadedAt: file.created_at,
            size: file.metadata?.size,
            metadata: {
              description: 'Shipping documentation',
            },
          });
        }
      }
    }

    // 6. Get export licenses
    const { data: licenses } = await supabase
      .from('export_licenses')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (licenses) {
      for (const license of licenses) {
        if (license.document_url) {
          documents.push({
            id: license.id,
            name: `Export License ${license.license_number || ''}`,
            type: 'export_license',
            url: license.document_url,
            uploadedAt: license.created_at,
            metadata: {
              licenseNumber: license.license_number,
              description: `Export license ${license.license_number}`,
            },
          });
        }
      }
    }

    // 7. Get refining documents if applicable
    const { data: refiningDocs } = await supabase
      .from('refining_processes')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (refiningDocs) {
      for (const doc of refiningDocs) {
        if (doc.document_url) {
          documents.push({
            id: doc.id,
            name: 'Refining Process Document',
            type: 'refining',
            url: doc.document_url,
            uploadedAt: doc.created_at,
            metadata: {
              description: 'Refining process documentation',
            },
          });
        }
      }
    }

    // 8. Get sale documents (invoices, contracts, etc.)
    if (sale.invoice_url) {
      documents.push({
        id: `sale-invoice-${sale.id}`,
        name: `Invoice ${sale.sale_number}`,
        type: 'sale',
        url: sale.invoice_url,
        uploadedAt: sale.created_at,
        metadata: {
          description: `Sales invoice ${sale.sale_number}`,
        },
      });
    }

    // Sort documents by upload date (newest first)
    return documents.sort((a, b) =>
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    );
  } catch (error) {
    console.error('Error collecting payment documents:', error);
    return documents;
  }
}

/**
 * Get document statistics for a payment
 */
export async function getPaymentDocumentStats(paymentId: string): Promise<DocumentStats> {
  const documents = await collectPaymentDocuments(paymentId);

  const byCategory = documents.reduce((acc, doc) => {
    acc[doc.type] = (acc[doc.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return {
    total: documents.length,
    byCategory,
    hasPaymentProof: documents.some(d => d.type === 'payment_proof'),
  };
}
