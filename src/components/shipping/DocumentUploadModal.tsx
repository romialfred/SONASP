import { useState } from 'react';
import { X, Upload, FileText } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal } from '../ui/Modal';

interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (file: File, title: string) => Promise<void>;
}

export function DocumentUploadModal({ isOpen, onClose, onUpload }: DocumentUploadModalProps) {
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      if (!title) {
        setTitle(e.target.files[0].name.split('.')[0]);
      }
    }
  };

  const handleSubmit = async () => {
    if (!file || !title.trim()) {
      alert('Veuillez remplir le titre et sélectionner un fichier');
      return;
    }

    try {
      setUploading(true);
      await onUpload(file, title);
      setTitle('');
      setFile(null);
      onClose();
    } catch (error) {
      console.error('Error uploading document:', error);
      alert('Erreur lors du téléchargement du document');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setTitle('');
    setFile(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Ajouter un Document">
      <div className="space-y-4">
        {/* Title Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Titre du Document *
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Certificate d'assurance"
            className="text-sm"
          />
        </div>

        {/* File Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Fichier *
          </label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-yellow-500 transition-colors">
            <input
              type="file"
              onChange={handleFileChange}
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              className="hidden"
              id="document-upload"
            />
            <label
              htmlFor="document-upload"
              className="cursor-pointer flex flex-col items-center gap-2"
            >
              {file ? (
                <>
                  <FileText className="w-12 h-12 text-yellow-600" />
                  <div className="text-sm font-medium text-gray-900">{file.name}</div>
                  <div className="text-xs text-gray-500">
                    {(file.size / 1024).toFixed(2)} KB
                  </div>
                </>
              ) : (
                <>
                  <Upload className="w-12 h-12 text-gray-400" />
                  <div className="text-sm font-medium text-gray-700">
                    Cliquez pour sélectionner un fichier
                  </div>
                  <div className="text-xs text-gray-500">
                    PDF, Word, Image (Max 10MB)
                  </div>
                </>
              )}
            </label>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t">
          <Button
            onClick={handleClose}
            variant="outline"
            disabled={uploading}
            className="text-sm"
          >
            <X className="w-4 h-4 mr-1" />
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!file || !title.trim() || uploading}
            className="bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-700 hover:to-amber-700 text-sm"
          >
            <Upload className="w-4 h-4 mr-1" />
            {uploading ? 'Téléchargement...' : 'Télécharger'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
