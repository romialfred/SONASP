import { supabase } from '@/lib/supabase';
import { UPLOAD_POLICIES, validateUploadFile } from '@/lib/uploadValidation';

export interface ProductionDocument {
  id: string;
  production_id: string;
  document_name: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
}

class ProductionDocumentService {
  private readonly BUCKET_NAME = 'production-documents';

  async uploadDocument(
    productionId: string,
    file: File,
    documentName: string
  ): Promise<ProductionDocument> {
    try {
      const validatedFile = validateUploadFile(file, UPLOAD_POLICIES.productionDocument);
      const timestamp = Date.now();
      const fileName = `${productionId}/${timestamp}.${validatedFile.extension}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(this.BUCKET_NAME)
        .upload(fileName, file, {
          contentType: validatedFile.mimeType,
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('User not authenticated');

      const { data: docData, error: docError } = await supabase
        .from('production_documents')
        .insert([
          {
            production_id: productionId,
            document_name: documentName,
            file_name: file.name,
            file_path: uploadData.path,
            file_size: file.size,
            file_type: validatedFile.mimeType,
            uploaded_by: user.user.id
          }
        ])
        .select()
        .single();

      if (docError) throw docError;

      return docData as ProductionDocument;
    } catch (error: any) {
      console.error('Error uploading document:', error);
      throw new Error(error.message || 'Erreur lors du téléchargement du document');
    }
  }

  async listDocuments(productionId: string): Promise<ProductionDocument[]> {
    try {
      const { data, error } = await supabase
        .from('production_documents')
        .select('*')
        .eq('production_id', productionId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error listing documents:', error);
        // Return empty array instead of throwing to prevent UI breakage
        return [];
      }

      return (data || []) as ProductionDocument[];
    } catch (error: any) {
      console.error('Error listing documents:', error);
      // Return empty array instead of throwing to prevent UI breakage
      return [];
    }
  }

  async downloadDocument(doc: Pick<ProductionDocument, 'file_path' | 'file_name'>): Promise<void> {
    try {
      const { data, error } = await supabase.storage
        .from(this.BUCKET_NAME)
        .download(doc.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.file_name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Error downloading document:', error);
      throw new Error(error.message || 'Erreur lors du téléchargement du document');
    }
  }

  async getDocumentUrl(filePath: string): Promise<string> {
    try {
      const { data } = await supabase.storage
        .from(this.BUCKET_NAME)
        .getPublicUrl(filePath);

      return data.publicUrl;
    } catch (error: any) {
      console.error('Error getting document URL:', error);
      throw new Error(error.message || 'Erreur lors de la récupération de l\'URL');
    }
  }

  async deleteDocument(documentId: string): Promise<void> {
    try {
      const { data: doc, error: fetchError } = await supabase
        .from('production_documents')
        .select('file_path')
        .eq('id', documentId)
        .single();

      if (fetchError) throw fetchError;

      const { error: storageError } = await supabase.storage
        .from(this.BUCKET_NAME)
        .remove([doc.file_path]);

      if (storageError) throw storageError;

      const { error: deleteError } = await supabase
        .from('production_documents')
        .delete()
        .eq('id', documentId);

      if (deleteError) throw deleteError;
    } catch (error: any) {
      console.error('Error deleting document:', error);
      throw new Error(error.message || 'Erreur lors de la suppression du document');
    }
  }

  async ensureBucketExists(): Promise<void> {
    try {
      const { data: buckets } = await supabase.storage.listBuckets();
      const bucketExists = buckets?.some(b => b.name === this.BUCKET_NAME);

      if (!bucketExists) {
        const { error } = await supabase.storage.createBucket(this.BUCKET_NAME, {
          public: false,
          fileSizeLimit: 10485760
        });

        if (error && !error.message.includes('already exists')) {
          throw error;
        }
      }
    } catch (error: any) {
      console.error('Error ensuring bucket exists:', error);
    }
  }
}

export const productionDocumentService = new ProductionDocumentService();
