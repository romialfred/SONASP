import { useState } from 'react';
import { Upload, FileText, X, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
  uploadAssayCertificate,
  parseCertificate,
} from '@/services/assayCertificateService';
import { useAuth } from '@/contexts/AuthContext';
import { ActionErrorDialog } from '@/components/ui/ActionErrorDialog';

interface AssayCertificateUploadProps {
  shippingPreparationId: string;
  onUploadComplete?: () => void;
}

export function AssayCertificateUploadForShipping({
  shippingPreparationId,
  onUploadComplete,
}: AssayCertificateUploadProps) {
  const { user } = useAuth();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [uploadResult, setUploadResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [errorOpen, setErrorOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('Impossible de téléverser le certificat.');

  const showError = (message: string) => {
    setErrorMessage(message);
    setErrorOpen(true);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
      setUploadResult(null);
    } else {
      setSelectedFile(null);
      showError('Sélectionnez un fichier PDF de 10 Mo au maximum.');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !user) return;

    setUploading(true);
    setUploadResult(null);

    try {
      // Upload certificate
      const uploadResult = await uploadAssayCertificate(
        shippingPreparationId,
        selectedFile,
        user.id
      );

      if (!uploadResult.success || !uploadResult.data) {
        setUploadResult({
          success: false,
          message: 'Impossible de téléverser le certificat.',
        });
        showError('Impossible de téléverser le certificat. Vérifiez le fichier, puis réessayez.');
        return;
      }

      setUploadResult({
        success: true,
        message: 'Certificat téléversé avec succès.',
      });

      // Parse certificate in background
      setParsing(true);
      try {
        await parseCertificate(uploadResult.data.id, selectedFile);
      } catch (parseError) {
        console.error('Erreur lors de l’analyse du certificat :', parseError);
        // Don't fail the whole operation if parsing fails
      } finally {
        setParsing(false);
      }

      // Reset form
      setSelectedFile(null);
      if (onUploadComplete) {
        onUploadComplete();
      }
    } catch {
      setUploadResult({
        success: false,
        message: 'Impossible de téléverser le certificat.',
      });
      showError('Impossible de téléverser le certificat. Vérifiez votre connexion, puis réessayez.');
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setUploadResult(null);
  };

  return (
    <Card className="p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
        <Upload className="w-5 h-5" />
        Téléverser un certificat d’analyse
      </h3>

      {/* File Input */}
      <div className="mb-4">
        {!selectedFile ? (
          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <Upload className="w-10 h-10 mb-3 text-gray-400" />
              <p className="mb-2 text-sm text-gray-600">
                <span className="font-semibold">Cliquez pour sélectionner</span> ou glissez-déposez le fichier
              </p>
              <p className="text-xs text-gray-500">PDF uniquement (10 Mo maximum)</p>
            </div>
            <input
              type="file"
              className="hidden"
              accept=".pdf"
              onChange={handleFileChange}
              disabled={uploading}
            />
          </label>
        ) : (
          <div className="flex items-center justify-between p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-3">
              <FileText className="w-8 h-8 text-blue-600" />
              <div>
                <p className="font-medium text-gray-900">{selectedFile.name}</p>
                <p className="text-sm text-gray-600">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemoveFile}
              disabled={uploading}
            >
              <X className="w-5 h-5 text-red-600" />
            </Button>
          </div>
        )}
      </div>

      {/* Upload Button */}
      {selectedFile && (
        <Button
          onClick={handleUpload}
          disabled={uploading || parsing}
          className="w-full"
        >
          {uploading ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              Téléversement…
            </>
          ) : parsing ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              Analyse du PDF…
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              Téléverser le certificat
            </>
          )}
        </Button>
      )}

      {/* Upload Result */}
      {uploadResult && (
        <div
          className={`mt-4 p-4 rounded-lg flex items-start gap-3 ${
            uploadResult.success
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
          }`}
        >
          {uploadResult.success ? (
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <p
              className={`font-medium ${
                uploadResult.success ? 'text-green-900' : 'text-red-900'
              }`}
            >
              {uploadResult.message}
            </p>
            {uploadResult.success && parsing && (
              <p className="text-sm text-green-700 mt-1">
                Le certificat est en cours d’analyse automatique…
              </p>
            )}
          </div>
        </div>
      )}

      {/* Info Note */}
      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-900">
          <span className="font-semibold">Note :</span> le certificat sera analysé automatiquement
          après son téléversement. Les données extraites pourront ensuite être vérifiées et approuvées.
        </p>
      </div>
      <ActionErrorDialog
        isOpen={errorOpen}
        onClose={() => setErrorOpen(false)}
        title="Échec du téléversement du certificat"
        message={errorMessage}
        recovery="Conservez cette page ouverte, vérifiez le PDF, puis réessayez."
      />
    </Card>
  );
}
