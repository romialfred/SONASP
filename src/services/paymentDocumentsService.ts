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
          uploadedAt: payment.created_at ?? '',
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

    // CE QUI A ETE RETIRE ICI, ET POURQUOI
    //
    // Quatre blocs rassemblaient des documents de production, des certificats
    // d'analyse, des pieces d'expedition et des licences d'export. Aucun n'etait
    // rattache au paiement ni meme a la vente : ils prenaient les lignes les plus
    // recentes de chaque table — cent pieces d'expedition, dix certificats, cinq
    // licences — et les attachaient telles quelles. Un operateur consultant un
    // paiement voyait donc des documents appartenant a d'autres ventes.
    //
    // Ils interrogeaient de surcroit des colonnes inexistantes : batch_number sur
    // daily_production, document_type, document_url et uploaded_at sur
    // production_documents, certificate_url sur assay_certificates. La requete
    // echouait, le resultat etait ignore, et l'ecran n'affichait rien : le defaut
    // de rattachement n'a donc jamais eu l'occasion de se voir.
    //
    // Les corriger colonne par colonne aurait produit l'inverse — des documents
    // qui s'affichent enfin, et qui sont les mauvais. daily_production ne porte
    // aucun lien vers une vente : le rattachement n'existe pas, il reste a
    // concevoir. Seules subsistent ci-dessous les pieces reellement liees au
    // paiement : la preuve bancaire et la facture de la vente.

    // Les documents de raffinage ne sont pas rattaches ici. Le code precedent
    // interrogeait `refining_processes`, une table qui n'existe pas, et sans
    // aucun lien avec le paiement : il prenait les cinq lignes les plus
    // recentes, quelle que soit la vente. Le rattachement reste a concevoir.

    // La facture de vente n'est plus referencee ici : sales.invoice_url
    // n'existe pas dans le schema, et l'ancien flux la publiait en URL
    // publique permanente. L'archivage passera par sales_documents.

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
