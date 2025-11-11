import { useState, useRef } from 'react';
import { Upload, X, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';

interface ProductionDocumentUploadProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (file: File, documentName: string) => Promise<void>;
}

export function ProductionDocumentUpload({
  isOpen,
  onClose,
  onUpload
}: ProductionDocumentUploadProps) {
  const [documentName, setDocumentName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>('');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_FILE_SIZE = 10 * 1024 * 1024;
  const ALLOWED_TYPES = ['application/pdf'];

  const handleClose = () => {
    if (!uploading) {
      setDocumentName('');
      setSelectedFile(null);
      setError('');
      onClose();
    }
  };

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'Seuls les fichiers PDF sont acceptés';
    }
    if (file.size > MAX_FILE_SIZE) {
      return `Le fichier est trop volumineux (max ${MAX_FILE_SIZE / 1024 / 1024}MB)`;
    }
    return null;
  };

  const handleFileSelect = (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    setError('');

    if (!documentName) {
      const nameWithoutExt = file.name.replace(/\.pdf$/i, '');
      setDocumentName(nameWithoutExt);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!documentName.trim()) {
      setError('Veuillez entrer un nom pour le document');
      return;
    }

    if (!selectedFile) {
      setError('Veuillez sélectionner un fichier');
      return;
    }

    try {
      setUploading(true);
      setError('');
      await onUpload(selectedFile, documentName.trim());
      handleClose();
    } catch (err: any) {
      setError(err.message || 'Erreur lors du téléchargement');
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Ajouter un Document
              </h2>
              <p className="text-sm text-gray-500">
                Rapport ou analyse de production
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={uploading}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nom du Document *
            </label>
            <Input
              type="text"
              value={documentName}
              onChange={(e) => setDocumentName(e.target.value)}
              placeholder="ex: Analyse Journalière 15 Nov 2025"
              disabled={uploading}
              className="w-full"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Donnez un nom descriptif pour identifier facilement ce document
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fichier PDF *
            </label>

            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`relative border-2 border-dashed rounded-lg p-6 transition-all ${
                dragActive
                  ? 'border-emerald-500 bg-emerald-50'
                  : selectedFile
                  ? 'border-emerald-300 bg-emerald-50'
                  : 'border-gray-300 bg-gray-50'
              } ${uploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              onClick={() => !uploading && fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileInputChange}
                disabled={uploading}
                className="hidden"
              />

              {selectedFile ? (
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FileText className="w-6 h-6 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(selectedFile.size)}
                    </p>
                  </div>
                  <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                </div>
              ) : (
                <div className="text-center">
                  <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                  <p className="text-sm font-medium text-gray-700 mb-1">
                    Cliquez pour sélectionner ou glissez-déposez
                  </p>
                  <p className="text-xs text-gray-500">
                    Fichiers PDF uniquement (max {MAX_FILE_SIZE / 1024 / 1024}MB)
                  </p>
                </div>
              )}
            </div>

            {selectedFile && !uploading && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedFile(null);
                }}
                className="mt-2 text-sm text-red-600 hover:text-red-700 font-medium"
              >
                Supprimer le fichier
              </button>
            )}
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <Button
              type="submit"
              disabled={uploading || !selectedFile || !documentName.trim()}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
            >
              {uploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Téléchargement...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  Télécharger le Document
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={uploading}
            >
              Annuler
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
