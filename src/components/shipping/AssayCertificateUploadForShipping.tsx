import { useState } from 'react';
import { Upload, FileText, X, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
  uploadAssayCertificate,
  parseCertificate,
} from '@/services/assayCertificateService';
import { useAuth } from '@/contexts/AuthContext';

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

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
      setUploadResult(null);
    } else {
      alert('Veuillez sélectionner un fichier PDF');
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
          message: uploadResult.error || 'Échec de l\'upload',
        });
        return;
      }

      setUploadResult({
        success: true,
        message: 'Certificat uploadé avec succès!',
      });

      // Parse certificate in background
      setParsing(true);
      try {
        await parseCertificate(uploadResult.data.id, selectedFile);
      } catch (parseError) {
        console.error('Parsing error:', parseError);
        // Don't fail the whole operation if parsing fails
      } finally {
        setParsing(false);
      }

      // Reset form
      setSelectedFile(null);
      if (onUploadComplete) {
        onUploadComplete();
      }
    } catch (error: any) {
      setUploadResult({
        success: false,
        message: error.message || 'Erreur lors de l\'upload',
      });
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
        Upload Assay Certificate
      </h3>

      {/* File Input */}
      <div className="mb-4">
        {!selectedFile ? (
          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
            <div className="flex flex-col items-center justify-center pt-5 pb-6">
              <Upload className="w-10 h-10 mb-3 text-gray-400" />
              <p className="mb-2 text-sm text-gray-600">
                <span className="font-semibold">Cliquez pour uploader</span> ou glissez-déposez
              </p>
              <p className="text-xs text-gray-500">PDF uniquement (MAX. 10MB)</p>
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
              Upload en cours...
            </>
          ) : parsing ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              Parsing du PDF...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              Upload Certificate
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
                Le certificat est en cours d'analyse automatique...
              </p>
            )}
          </div>
        </div>
      )}

      {/* Info Note */}
      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-900">
          <span className="font-semibold">Note:</span> Le certificat sera automatiquement analysé
          après l'upload. Les données extraites pourront être vérifiées et approuvées par la
          suite.
        </p>
      </div>
    </Card>
  );
}
