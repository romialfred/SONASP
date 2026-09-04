import { useState, useRef } from 'react';
import { X, Upload, FileText } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { TextArea } from '@/components/ui/TextArea';
import { freightCustomsService, FreightDocumentType } from '@/services/freightCustomsService';
import { useNotification } from '@/contexts/NotificationContext';

interface AddDocumentModalProps {
  operationId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddDocumentModal({ operationId, onClose, onSuccess }: AddDocumentModalProps) {
  const { showError } = useNotification();
  const [formData, setFormData] = useState({
    documentType: 'other' as FreightDocumentType,
    title: '',
    description: ''
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const uploadLock = useRef(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFile(null);
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        showError("Erreur", "Seuls les fichiers PDF sont acceptés");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        showError("Erreur", "Le fichier ne doit pas dépasser 10 Mo");
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploadLock.current) return;

    if (!formData.title.trim()) {
      showError("Erreur", "Le titre du document est obligatoire");
      return;
    }

    if (!selectedFile) {
      showError("Erreur", "Sélectionnez un fichier PDF");
      return;
    }

    try {
      uploadLock.current = true;
      setUploading(true);
      await freightCustomsService.uploadDocument(
        operationId,
        formData.documentType,
        formData.title.trim(),
        selectedFile,
        formData.description || undefined
      );
      onSuccess();
    } catch (error) {
      console.error('Échec du téléversement du document :', error);
      showError('Échec du téléversement du document', 'Impossible d’enregistrer le PDF. Conservez le formulaire ouvert, puis réessayez.');
    } finally {
      uploadLock.current = false;
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Ajouter un document</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type de document <span className="text-red-500">*</span>
            </label>
            <Select
              value={formData.documentType}
              onChange={(e) => setFormData({ ...formData, documentType: e.target.value as FreightDocumentType })}
              required
            >
              <option value="customs_declaration">Déclaration en douane</option>
              <option value="customs_approval">Approbation douanière</option>
              <option value="transport_document">Document de transport</option>
              <option value="bill_of_lading">Connaissement</option>
              <option value="export_invoice">Facture d’exportation</option>
              <option value="bullion_summary">Récapitulatif des lingots</option>
              <option value="other">Autre</option>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Titre <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Ex. : déclaration en douane"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (facultative)
            </label>
            <TextArea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Notes ou informations complémentaires…"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fichier PDF <span className="text-red-500">*</span>
            </label>
            <div className="mt-2">
              <label className="flex items-center justify-center px-4 py-6 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-colors">
                <div className="text-center">
                  {selectedFile ? (
                    <>
                      <FileText className="w-12 h-12 text-blue-600 mx-auto mb-2" />
                      <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </>
                  ) : (
                    <>
                      <Upload className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">Sélectionnez un fichier PDF</p>
                      <p className="text-xs text-gray-500 mt-1">10 Mo maximum</p>
                    </>
                  )}
                </div>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                  required
                />
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={uploading}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={uploading || !selectedFile}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {uploading ? "Téléversement…" : "Ajouter le document"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
