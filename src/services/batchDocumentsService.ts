import { supabase } from '@/lib/supabase';

export interface BatchDocument {
  id: string;
  batch_id: string;
  document_type: DocumentType;
  document_name: string;
  file_url: string;
  file_size?: number;
  mime_type?: string;
  uploaded_by: string;
  lifecycle_stage?: LifecycleStage;
  description?: string;
  can_be_downloaded?: boolean;
  created_at: string;
  updated_at: string;
  uploaded_by_name?: string;
  batch_number?: string;
  batch_status?: string;
}

export type DocumentType =
  | 'shipping_report'
  | 'refinery_report'
  | 'sales_invoice'
  | 'quality_report'
  | 'transport_document'
  | 'customs_document'
  | 'payment_proof'
  | 'other';

export type LifecycleStage =
  | 'factory'
  | 'airport'
  | 'refinery'
  | 'processing'
  | 'sales'
  | 'payment';

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  shipping_report: 'Shipping Report',
  refinery_report: 'Refinery Process Report',
  sales_invoice: 'Sales Invoice',
  quality_report: 'Quality Report',
  transport_document: 'Transport Document',
  customs_document: 'Customs Document',
  payment_proof: 'Payment Proof',
  other: 'Other Document',
};

export const LIFECYCLE_STAGE_LABELS: Record<LifecycleStage, string> = {
  factory: 'Factory/Shipping',
  airport: 'Airport Reception',
  refinery: 'Refinery Reception',
  processing: 'Processing',
  sales: 'Sales',
  payment: 'Payment',
};

/**
 * Fetch all documents for a specific batch
 */
export async function fetchBatchDocuments(batchId: string): Promise<BatchDocument[]> {
  const { data, error } = await supabase
    .from('v_batch_documents_with_details')
    .select('*')
    .eq('batch_id', batchId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching batch documents:', error);
    throw new Error('Failed to fetch documents');
  }

  return data || [];
}

/**
 * Upload a document to storage and create database record
 */
export async function uploadBatchDocument(
  batchId: string,
  file: File,
  metadata: {
    document_type: DocumentType;
    document_name: string;
    lifecycle_stage?: LifecycleStage;
    description?: string;
    can_be_downloaded?: boolean;
  }
): Promise<BatchDocument> {
  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('User not authenticated');

  // Generate unique file path
  const fileExt = file.name.split('.').pop();
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
  const filePath = `${user.id}/${batchId}/${fileName}`;

  // Upload file to storage
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('batch-documents')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) {
    console.error('Error uploading file:', uploadError);
    throw new Error('Failed to upload document');
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('batch-documents')
    .getPublicUrl(filePath);

  // Create database record
  const { data: docData, error: docError } = await supabase
    .from('batch_documents')
    .insert({
      batch_id: batchId,
      document_type: metadata.document_type,
      document_name: metadata.document_name,
      file_url: publicUrl,
      file_size: file.size,
      mime_type: file.type,
      uploaded_by: user.id,
      lifecycle_stage: metadata.lifecycle_stage,
      description: metadata.description,
      can_be_downloaded: metadata.can_be_downloaded ?? true,
    })
    .select()
    .single();

  if (docError) {
    // Cleanup uploaded file if database insert fails
    await supabase.storage.from('batch-documents').remove([filePath]);
    console.error('Error creating document record:', docError);
    throw new Error('Failed to save document information');
  }

  return docData;
}

/**
 * Delete a document (file and database record)
 */
export async function deleteBatchDocument(documentId: string): Promise<void> {
  // Fetch document info first
  const { data: doc, error: fetchError } = await supabase
    .from('batch_documents')
    .select('file_url, uploaded_by')
    .eq('id', documentId)
    .single();

  if (fetchError || !doc) {
    throw new Error('Document not found');
  }

  // Verify user owns the document
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || doc.uploaded_by !== user.id) {
    throw new Error('Unauthorized to delete this document');
  }

  // Extract file path from URL
  const urlParts = doc.file_url.split('/batch-documents/');
  if (urlParts.length < 2) {
    throw new Error('Invalid file URL');
  }
  const filePath = urlParts[1].split('?')[0]; // Remove query parameters

  // Delete from storage
  const { error: storageError } = await supabase.storage
    .from('batch-documents')
    .remove([filePath]);

  if (storageError) {
    console.error('Error deleting file from storage:', storageError);
  }

  // Delete database record
  const { error: dbError } = await supabase
    .from('batch_documents')
    .delete()
    .eq('id', documentId);

  if (dbError) {
    console.error('Error deleting document record:', dbError);
    throw new Error('Failed to delete document');
  }
}

/**
 * Update document metadata
 */
export async function updateBatchDocument(
  documentId: string,
  updates: {
    document_name?: string;
    document_type?: DocumentType;
    lifecycle_stage?: LifecycleStage;
    description?: string;
    can_be_downloaded?: boolean;
  }
): Promise<BatchDocument> {
  const { data, error } = await supabase
    .from('batch_documents')
    .update(updates)
    .eq('id', documentId)
    .select()
    .single();

  if (error) {
    console.error('Error updating document:', error);
    throw new Error('Failed to update document');
  }

  return data;
}

/**
 * Get document download URL with authentication
 */
export async function getDocumentDownloadUrl(fileUrl: string): Promise<string> {
  // Extract file path from public URL
  const urlParts = fileUrl.split('/batch-documents/');
  if (urlParts.length < 2) {
    return fileUrl; // Return as-is if format is unexpected
  }
  const filePath = urlParts[1].split('?')[0];

  // Create signed URL for secure access
  const { data, error } = await supabase.storage
    .from('batch-documents')
    .createSignedUrl(filePath, 3600); // 1 hour expiry

  if (error) {
    console.error('Error creating signed URL:', error);
    return fileUrl; // Fallback to public URL
  }

  return data.signedUrl;
}

/**
 * Filter documents by type
 */
export function filterDocumentsByType(
  documents: BatchDocument[],
  type?: DocumentType
): BatchDocument[] {
  if (!type) return documents;
  return documents.filter((doc) => doc.document_type === type);
}

/**
 * Filter documents by lifecycle stage
 */
export function filterDocumentsByStage(
  documents: BatchDocument[],
  stage?: LifecycleStage
): BatchDocument[] {
  if (!stage) return documents;
  return documents.filter((doc) => doc.lifecycle_stage === stage);
}

/**
 * Get document type icon and color
 */
export function getDocumentTypeStyle(type: DocumentType): {
  icon: string;
  color: string;
  bgColor: string;
} {
  const styles: Record<DocumentType, { icon: string; color: string; bgColor: string }> = {
    shipping_report: {
      icon: '📦',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 border-blue-200',
    },
    refinery_report: {
      icon: '🏭',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50 border-purple-200',
    },
    sales_invoice: {
      icon: '💰',
      color: 'text-green-600',
      bgColor: 'bg-green-50 border-green-200',
    },
    quality_report: {
      icon: '✓',
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50 border-emerald-200',
    },
    transport_document: {
      icon: '🚚',
      color: 'text-orange-600',
      bgColor: 'bg-orange-50 border-orange-200',
    },
    customs_document: {
      icon: '🛂',
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50 border-indigo-200',
    },
    payment_proof: {
      icon: '💳',
      color: 'text-pink-600',
      bgColor: 'bg-pink-50 border-pink-200',
    },
    other: {
      icon: '📄',
      color: 'text-gray-600',
      bgColor: 'bg-gray-50 border-gray-200',
    },
  };

  return styles[type];
}
