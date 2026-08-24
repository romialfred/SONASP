import { useState } from 'react';
import { Upload, FileText, Download, Eye, Trash2, Plus } from 'lucide-react';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Card } from '../ui/Card';
import {
  UPLOAD_POLICIES,
  validateUploadFile,
} from '@/lib/uploadValidation';
import { shippingPreparationService } from '@/services/shippingPreparationService';

interface Document {
  id: string;
  title: string;
  document_url: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
}

interface DocumentUploadSectionProps {
  shippingId: string;
  documents: Document[];
  onDocumentAdded: () => void;
  onDocumentDeleted: (docId: string) => void;
}

export function DocumentUploadSection({
  shippingId,
  documents,
  onDocumentAdded,
  onDocumentDeleted
}: DocumentUploadSectionProps) {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [accessingDocumentId, setAccessingDocumentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        validateUploadFile(e.target.files[0], UPLOAD_POLICIES.shippingDocument);
        setFile(e.target.files[0]);
        setError(null);
      } catch (reason) {
        setFile(null);
        setError(reason instanceof Error ? reason.message : 'Ce fichier ne peut pas être téléversé.');
        e.target.value = '';
      }
    }
  };

  const handleUpload = async () => {
    if (!file || !title.trim()) {
      setError('Veuillez fournir un titre et sélectionner un fichier');
      return;
    }

    try {
      setUploading(true);
      setError(null);

      await shippingPreparationService.uploadDocument(shippingId, file, title.trim());

      setShowUploadModal(false);
      setTitle('');
      setFile(null);
      onDocumentAdded();
    } catch (err: any) {
      console.error('Error uploading document:', err);
      setError(err.message || 'Erreur lors du téléchargement');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId: string, documentUrl: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce document ?')) return;

    try {
      await shippingPreparationService.deleteDocument(docId, documentUrl);
      onDocumentDeleted(docId);
    } catch (err) {
      console.error('Error deleting document:', err);
      alert('Erreur lors de la suppression du document');
    }
  };

  const handleOpen = async (doc: Document) => {
    const popup = window.open('about:blank', '_blank');
    if (popup) popup.opener = null;
    setAccessingDocumentId(doc.id);
    setError(null);
    try {
      const signedUrl = await shippingPreparationService.getDocumentUrl(doc.document_url);
      if (!popup) throw new Error('Autorisez les fenêtres contextuelles pour ouvrir le document.');
      popup.location.replace(signedUrl);
    } catch (reason) {
      popup?.close();
      setError(reason instanceof Error ? reason.message : 'Le document ne peut pas être ouvert.');
    } finally {
      setAccessingDocumentId(null);
    }
  };

  const handleDownload = async (doc: Document) => {
    setAccessingDocumentId(doc.id);
    setError(null);
    try {
      const signedUrl = await shippingPreparationService.getDocumentUrl(doc.document_url);
      const link = document.createElement('a');
      link.href = signedUrl;
      link.download = doc.file_name;
      link.rel = 'noopener noreferrer';
      link.click();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Le document ne peut pas être téléchargé.');
    } finally {
      setAccessingDocumentId(null);
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'N/A';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <>
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 rounded-lg p-2">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">Documents</h3>
              <p className="text-sm text-slate-500">{documents.length} document(s)</p>
            </div>
          </div>
          <Button
            onClick={() => {
              setError(null);
              setShowUploadModal(true);
            }}
            className="flex items-center gap-2"
            size="sm"
          >
            <Plus className="w-4 h-4" />
            Ajouter
          </Button>
        </div>

        {error && !showUploadModal && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {documents.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Aucun document ajouté</p>
          </div>
        ) : (
          <div className="space-y-3">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors border border-slate-200"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="bg-white rounded-lg p-2 border border-slate-200">
                    <FileText className="w-5 h-5 text-slate-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-900 truncate">{doc.title}</div>
                    <div className="text-xs text-slate-500 flex items-center gap-2">
                      <span>{doc.file_name}</span>
                      <span>•</span>
                      <span>{formatFileSize(doc.file_size)}</span>
                      <span>•</span>
                      <span>{formatDate(doc.created_at)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void handleOpen(doc)}
                    disabled={accessingDocumentId === doc.id}
                    className="flex items-center gap-1"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void handleDownload(doc)}
                    disabled={accessingDocumentId === doc.id}
                    className="flex items-center gap-1"
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleDelete(doc.id, doc.document_url)}
                    className="flex items-center gap-1 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Upload Modal */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => !uploading && setShowUploadModal(false)}
        title="Ajouter un Document"
      >
        <div className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Titre du Document *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Ex: Packing List, Bill of Lading, etc."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Fichier *
            </label>
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
              <input
                type="file"
                onChange={handleFileSelect}
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png"
                className="hidden"
                id="document-upload"
              />
              <label htmlFor="document-upload" className="cursor-pointer">
                <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm text-slate-600">
                  {file ? (
                    <span className="font-medium text-blue-600">{file.name}</span>
                  ) : (
                    <>
                      Cliquez pour sélectionner ou glissez un fichier
                      <br />
                      <span className="text-xs text-slate-500">PDF, DOC/DOCX, PNG, JPG (max 10 Mo)</span>
                    </>
                  )}
                </p>
              </label>
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button
              variant="secondary"
              onClick={() => setShowUploadModal(false)}
              disabled={uploading}
            >
              Annuler
            </Button>
            <Button
              onClick={handleUpload}
              disabled={uploading || !file || !title.trim()}
            >
              {uploading ? 'Téléchargement...' : 'Télécharger'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
