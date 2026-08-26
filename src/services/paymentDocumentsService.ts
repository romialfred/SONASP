import { supabase } from '@/lib/supabase';
import { createPrivateSignedUrl, PRIVATE_STORAGE_BUCKETS } from '@/lib/privateStorage';

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
      try {
        const signedUrl = await createPrivateSignedUrl(
          PRIVATE_STORAGE_BUCKETS.paymentProofs,
          payment.proof_url,
          300,
        );
        documents.push({
          id: `payment-proof-${payment.id}`,
          name: 'Preuve bancaire privée',
          type: 'payment_proof',
          url: signedUrl,
          uploadedAt: payment.updated_at || payment.created_at,
          metadata: {
            description: 'Preuve de paiement accessible par URL signée courte',
          },
        });
      } catch {
        // Une référence invalide ou hors périmètre ne doit pas être exposée.
      }
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
          try {
            const signedUrl = await createPrivateSignedUrl(
              PRIVATE_STORAGE_BUCKETS.assayCertificates,
              cert.certificate_url,
            );
            documents.push({
              id: cert.id,
              name: `Assay Certificate ${cert.certificate_number || ''}`,
              type: 'assay_certificate',
              url: signedUrl,
              uploadedAt: cert.created_at,
              metadata: {
                certificateNumber: cert.certificate_number,
                description: `Assay certificate ${cert.certificate_number}`,
              },
            });
          } catch {
            // Une référence privée invalide ne doit jamais redevenir une URL publique.
          }
        }
      }
    }

    // 5. Get shipping documents through the RLS-protected metadata table.
    // The database stores canonical object paths (and can still contain legacy
    // public URLs); both forms are normalized before a short-lived URL is signed.
    const { data: shippingFiles } = await supabase
      .from('shipping_documents')
      .select('id, title, file_name, document_url, file_size, created_at')
      .order('created_at', { ascending: false })
      .limit(100);

    if (shippingFiles) {
      for (const file of shippingFiles) {
        try {
          const signedUrl = await createPrivateSignedUrl(
            PRIVATE_STORAGE_BUCKETS.shippingDocuments,
            file.document_url,
          );
          documents.push({
            id: `shipping-${file.id}`,
            name: file.title || file.file_name,
            type: 'shipping',
            url: signedUrl,
            uploadedAt: file.created_at,
            size: file.file_size,
            metadata: {
              description: 'Shipping documentation',
            },
          });
        } catch {
          // Ignore les références historiques invalides plutôt que de les ouvrir.
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

    // Les documents de raffinage ne sont pas rattaches ici. Le code precedent
    // interrogeait `refining_processes`, une table qui n'existe pas, et sans
    // aucun lien avec le paiement : il prenait les cinq lignes les plus
    // recentes, quelle que soit la vente. Le rattachement reste a concevoir.

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
