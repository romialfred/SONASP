import { supabase } from '@/lib/supabase';

export interface SaleDocument {
  type: string;
  label: string;
  description: string;
  icon: string;
  color: string;
  bgColor: string;
  available: boolean;
  generatedDate?: string;
  documentId?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
}

/**
 * Get all documents related to a sale
 * This includes:
 * - Production documents
 * - Shipping documents (packing lists, assay certificates)
 * - Freight/Consignment documents
 * - Sales invoices
 */
export async function getSaleDocuments(
  saleId: string
): Promise<{ success: boolean; data?: SaleDocument[]; error?: string }> {
  try {
    const documents: SaleDocument[] = [];

    // Get sale details to find related records
    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .select('*, customer:customers(name)')
      .eq('id', saleId)
      .maybeSingle();

    if (saleError || !sale) {
      return { success: false, error: saleError?.message || 'Sale not found' };
    }

    // 1. Get production documents linked to this sale
    // First, find production records related to this sale (via inventory or seller)
    if (sale.seller_type === 'mining_company' && sale.seller_id) {
      const { data: productions } = await supabase
        .from('daily_production')
        .select(`
          id,
          production_date,
          production_documents(*)
        `)
        .eq('mining_company_id', sale.seller_id)
        .order('production_date', { ascending: false })
        .limit(10);

      if (productions) {
        for (const prod of productions) {
          if (prod.production_documents && Array.isArray(prod.production_documents)) {
            for (const doc of prod.production_documents as any[]) {
              if (doc.file_path) {
                // Generate signed URL for production document
                const { data: signedUrl } = await supabase.storage
                  .from('production-documents')
                  .createSignedUrl(doc.file_path, 3600); // 1 hour expiry

                documents.push({
                  type: 'production_document',
                  label: doc.document_name || 'Production Document',
                  description: `From production on ${new Date(prod.production_date).toLocaleDateString()}`,
                  icon: 'FileText',
                  color: 'text-blue-600',
                  bgColor: 'bg-blue-50 hover:bg-blue-100 border-blue-200',
                  available: true,
                  generatedDate: doc.created_at,
                  documentId: doc.id,
                  fileUrl: signedUrl?.signedUrl || undefined,
                  fileName: doc.file_name,
                  fileSize: doc.file_size,
                });
              }
            }
          }
        }
      }
    }

    // 2. Get shipping documents (packing lists, assay certificates)
    // Find shipping preparations that might be related to this sale
    const { data: shippingPreps } = await supabase
      .from('shipping_preparations')
      .select(`
        id,
        expedition_number,
        packing_list_url,
        shipping_documents(*),
        assay_certificates(*)
      `)
      .eq('mining_company_id', sale.seller_id)
      .order('created_at', { ascending: false })
      .limit(5);

    if (shippingPreps) {
      for (const prep of shippingPreps) {
        // Add packing list if available
        if (prep.packing_list_url) {
          documents.push({
            type: 'packing_list',
            label: 'Packing List',
            description: `Export documentation for ${prep.expedition_number}`,
            icon: 'Package',
            color: 'text-blue-600',
            bgColor: 'bg-blue-50 hover:bg-blue-100 border-blue-200',
            available: true,
            generatedDate: prep.created_at,
            fileUrl: prep.packing_list_url,
            fileName: `Packing_List_${prep.expedition_number}.pdf`,
          });
        }

        // Add shipping documents
        if (prep.shipping_documents && Array.isArray(prep.shipping_documents)) {
          for (const doc of prep.shipping_documents as any[]) {
            if (doc.document_url) {
              documents.push({
                type: 'shipping_document',
                label: doc.title || 'Shipping Document',
                description: `Related to ${prep.expedition_number}`,
                icon: 'FileText',
                color: 'text-indigo-600',
                bgColor: 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200',
                available: true,
                generatedDate: doc.created_at,
                documentId: doc.id,
                fileUrl: doc.document_url,
                fileName: doc.file_name,
                fileSize: doc.file_size,
              });
            }
          }
        }

        // Add assay certificates
        if (prep.assay_certificates && Array.isArray(prep.assay_certificates)) {
          for (const cert of prep.assay_certificates as any[]) {
            if (cert.file_path && cert.approval_status === 'approved') {
              // Generate signed URL for assay certificate
              const { data: signedUrl } = await supabase.storage
                .from('ASSAY-CERTIFICATES')
                .createSignedUrl(cert.file_path, 3600);

              documents.push({
                type: 'assay_certificate',
                label: 'Assay Lab Certificate',
                description: `Quality analysis - ${cert.issuing_laboratory || 'Certified lab'}`,
                icon: 'FlaskConical',
                color: 'text-purple-600',
                bgColor: 'bg-purple-50 hover:bg-purple-100 border-purple-200',
                available: true,
                generatedDate: cert.created_at,
                documentId: cert.id,
                fileUrl: signedUrl?.signedUrl || undefined,
                fileName: cert.file_name,
                fileSize: cert.file_size,
              });
            }
          }
        }
      }
    }

    // 3. Get freight/consignment documents
    const { data: freightShipments } = await supabase
      .from('freight_shipments')
      .select(`
        id,
        shipment_number,
        invoice_url,
        consignment_url,
        created_at
      `)
      .eq('mining_company_id', sale.seller_id)
      .order('created_at', { ascending: false })
      .limit(5);

    if (freightShipments) {
      for (const shipment of freightShipments) {
        // Add invoice
        if (shipment.invoice_url) {
          documents.push({
            type: 'freight_invoice',
            label: 'Invoice for Customer',
            description: `Freight invoice - ${shipment.shipment_number}`,
            icon: 'Receipt',
            color: 'text-green-600',
            bgColor: 'bg-green-50 hover:bg-green-100 border-green-200',
            available: true,
            generatedDate: shipment.created_at,
            fileUrl: shipment.invoice_url,
            fileName: `Invoice_${shipment.shipment_number}.pdf`,
          });
        }

        // Add consignment
        if (shipment.consignment_url) {
          documents.push({
            type: 'consignment',
            label: 'Consignment Document',
            description: `Consignment note - ${shipment.shipment_number}`,
            icon: 'FileText',
            color: 'text-teal-600',
            bgColor: 'bg-teal-50 hover:bg-teal-100 border-teal-200',
            available: true,
            generatedDate: shipment.created_at,
            fileUrl: shipment.consignment_url,
            fileName: `Consignment_${shipment.shipment_number}.pdf`,
          });
        }
      }
    }

    // 4. Add Bullion Summary (can be generated on-demand from sale data)
    documents.push({
      type: 'bullion_summary',
      label: 'Bullion Summary',
      description: 'Gold bars details and specifications',
      icon: 'Gem',
      color: 'text-amber-600',
      bgColor: 'bg-amber-50 hover:bg-amber-100 border-amber-200',
      available: true,
      generatedDate: sale.created_at,
    });

    // 5. Add Sales Invoice (generated from sale data)
    documents.push({
      type: 'sales_invoice',
      label: 'Sales Invoice',
      description: 'Official sales record',
      icon: 'FileText',
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200',
      available: true,
      generatedDate: sale.created_at,
    });

    // Remove duplicates based on documentId and type
    const uniqueDocuments = documents.filter((doc, index, self) =>
      index === self.findIndex((d) =>
        (d.documentId && d.documentId === doc.documentId) ||
        (d.type === doc.type && d.label === doc.label)
      )
    );

    return { success: true, data: uniqueDocuments };
  } catch (error: any) {
    console.error('Error fetching sale documents:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Download a specific document
 */
export async function downloadSaleDocument(
  documentType: string,
  documentId?: string,
  saleId?: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    // For stored documents, get the signed URL
    if (documentId) {
      if (documentType === 'production_document') {
        const { data: doc } = await supabase
          .from('production_documents')
          .select('file_path')
          .eq('id', documentId)
          .maybeSingle();

        if (doc?.file_path) {
          const { data: signedUrl, error } = await supabase.storage
            .from('production-documents')
            .createSignedUrl(doc.file_path, 300); // 5 minutes

          if (error) {
            return { success: false, error: error.message };
          }

          return { success: true, url: signedUrl.signedUrl };
        }
      } else if (documentType === 'assay_certificate') {
        const { data: doc } = await supabase
          .from('assay_certificates')
          .select('file_path')
          .eq('id', documentId)
          .maybeSingle();

        if (doc?.file_path) {
          const { data: signedUrl, error } = await supabase.storage
            .from('ASSAY-CERTIFICATES')
            .createSignedUrl(doc.file_path, 300);

          if (error) {
            return { success: false, error: error.message };
          }

          return { success: true, url: signedUrl.signedUrl };
        }
      }
    }

    // For generated documents (bullion summary, sales invoice),
    // trigger generation and return URL
    if (documentType === 'bullion_summary' || documentType === 'sales_invoice') {
      // These will be handled by PDF generation services
      return {
        success: false,
        error: 'Document generation not yet implemented for this type',
      };
    }

    return { success: false, error: 'Document not found' };
  } catch (error: any) {
    console.error('Error downloading document:', error);
    return { success: false, error: error.message };
  }
}
