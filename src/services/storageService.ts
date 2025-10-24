import { supabase } from '@/lib/supabase';

export const STORAGE_BUCKETS = {
  BATCH_DOCUMENTS: 'batch-documents',
  PAYMENT_PROOFS: 'payment-proofs',
  REPORTS: 'reports',
} as const;

export interface UploadFileParams {
  bucket: string;
  path: string;
  file: File;
  options?: {
    cacheControl?: string;
    contentType?: string;
    upsert?: boolean;
  };
}

export const storageService = {
  async uploadFile({ bucket, path, file, options }: UploadFileParams) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        cacheControl: options?.cacheControl || '3600',
        contentType: options?.contentType || file.type,
        upsert: options?.upsert || false,
      });

    if (error) throw error;
    return data;
  },

  async downloadFile(bucket: string, path: string) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(path);

    if (error) throw error;
    return data;
  },

  async getPublicUrl(bucket: string, path: string) {
    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(path);

    return data.publicUrl;
  },

  async deleteFile(bucket: string, path: string) {
    const { error } = await supabase.storage
      .from(bucket)
      .remove([path]);

    if (error) throw error;
    return true;
  },

  async listFiles(bucket: string, path: string = '') {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(path);

    if (error) throw error;
    return data;
  },

  async uploadBatchDocument(batchId: string, file: File, documentType: string, userId: string) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${batchId}/${documentType}-${Date.now()}.${fileExt}`;

    const uploadData = await this.uploadFile({
      bucket: STORAGE_BUCKETS.BATCH_DOCUMENTS,
      path: fileName,
      file,
    });

    const publicUrl = await this.getPublicUrl(STORAGE_BUCKETS.BATCH_DOCUMENTS, fileName);

    const { data, error } = await supabase
      .from('batch_documents')
      .insert({
        batch_id: batchId,
        document_type: documentType,
        file_name: file.name,
        file_path: fileName,
        file_size: file.size,
        uploaded_by: userId,
      })
      .select()
      .maybeSingle();

    if (error) throw error;

    return { ...data, public_url: publicUrl };
  },

  async uploadPaymentProof(saleId: string, file: File, paymentId: string) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${saleId}/payment-${paymentId}-${Date.now()}.${fileExt}`;

    await this.uploadFile({
      bucket: STORAGE_BUCKETS.PAYMENT_PROOFS,
      path: fileName,
      file,
    });

    const publicUrl = await this.getPublicUrl(STORAGE_BUCKETS.PAYMENT_PROOFS, fileName);

    await supabase
      .from('payments')
      .update({ proof_url: publicUrl })
      .eq('id', paymentId);

    return publicUrl;
  },

  async getBatchDocuments(batchId: string) {
    const { data, error } = await supabase
      .from('batch_documents')
      .select('*')
      .eq('batch_id', batchId)
      .order('uploaded_at', { ascending: false });

    if (error) throw error;

    return data?.map(doc => ({
      ...doc,
      public_url: this.getPublicUrl(STORAGE_BUCKETS.BATCH_DOCUMENTS, doc.file_path),
    }));
  },

  validateFile(file: File, maxSizeMB: number = 10, allowedTypes?: string[]) {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;

    if (file.size > maxSizeBytes) {
      throw new Error(`File size exceeds ${maxSizeMB}MB limit`);
    }

    if (allowedTypes && !allowedTypes.includes(file.type)) {
      throw new Error(`File type ${file.type} is not allowed. Allowed types: ${allowedTypes.join(', ')}`);
    }

    return true;
  },
};
