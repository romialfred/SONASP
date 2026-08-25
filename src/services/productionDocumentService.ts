import { supabase } from '@/lib/supabase';
import { createPrivateSignedUrl, PRIVATE_STORAGE_BUCKETS } from '@/lib/privateStorage';
import { UPLOAD_POLICIES, validateUploadFile } from '@/lib/uploadValidation';
import { deleteSensitiveResource, uploadSensitiveFile } from './sensitiveUploadGateway';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  private readonly BUCKET_NAME = PRIVATE_STORAGE_BUCKETS.productionDocuments;

  async uploadDocument(
    productionId: string,
    file: File,
    documentName: string
  ): Promise<ProductionDocument> {
    try {
      if (!UUID.test(productionId) || documentName.trim() !== documentName || documentName.length === 0 || documentName.length > 200) {
        throw new Error('Les informations du document de production sont invalides.');
      }
      const validatedFile = validateUploadFile(file, UPLOAD_POLICIES.productionDocument);
      const resource = await uploadSensitiveFile(
        'production-document',
        file,
        { productionId, documentName, fileName: file.name },
        { mimeType: validatedFile.mimeType },
      );
      if (!this.isUploadedDocument(resource, {
        productionId,
        documentName,
        fileSize: file.size,
        mimeType: validatedFile.mimeType,
        extension: validatedFile.extension,
      })) throw new Error('La confirmation du dépôt est invalide.');
      return resource;
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
    return createPrivateSignedUrl(this.BUCKET_NAME, filePath, 300);
  }

  async deleteDocument(documentId: string): Promise<void> {
    try {
      if (!UUID.test(documentId)) throw new Error('Identifiant de document invalide.');
      await deleteSensitiveResource('production-document', documentId);
    } catch (error: any) {
      console.error('Error deleting document:', error);
      throw new Error(error.message || 'Erreur lors de la suppression du document');
    }
  }

  async ensureBucketExists(): Promise<void> {
    // Le navigateur ne liste ni ne crée les buckets. Leur configuration privée
    // est gérée exclusivement par les migrations et le gateway serveur.
  }

  private isUploadedDocument(
    value: unknown,
    expected: { productionId: string; documentName: string; fileSize: number; mimeType: string; extension: string },
  ): value is ProductionDocument {
    if (!value || typeof value !== 'object') return false;
    const document = value as Partial<ProductionDocument>;
    const segments = typeof document.file_path === 'string' ? document.file_path.split('/') : [];
    const objectName = segments[4] ?? '';
    return typeof document.id === 'string' && UUID.test(document.id)
      && document.production_id === expected.productionId
      && document.document_name === expected.documentName
      && document.file_size === expected.fileSize
      && document.file_type === expected.mimeType
      && typeof document.file_name === 'string'
      && document.file_name.toLowerCase().endsWith(`.${expected.extension}`)
      && !/[\\/\u0000-\u001f\u007f]/u.test(document.file_name)
      && segments.length === 5
      && segments[0] === expected.productionId
      && segments[1] === 'format-validated'
      && /^\d{4}$/u.test(segments[2] ?? '')
      && /^(?:0[1-9]|1[0-2])$/u.test(segments[3] ?? '')
      && UUID.test(objectName.split('.')[0] ?? '')
      && objectName.toLowerCase().endsWith(`.${expected.extension}`)
      && typeof document.uploaded_by === 'string' && UUID.test(document.uploaded_by)
      && typeof document.created_at === 'string' && Number.isFinite(Date.parse(document.created_at));
  }
}

export const productionDocumentService = new ProductionDocumentService();
