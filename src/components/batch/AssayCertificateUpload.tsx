import { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle, XCircle, Loader, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Alert } from '@/components/ui/Alert';
import { useAlert } from '@/hooks/useAlert';
import { useAuth } from '@/contexts/AuthContext';
import {
  uploadAssayCertificate,
  parseCertificate,
  type AssayCertificate,
} from '@/services/assayCertificateService';

interface AssayCertificateUploadProps {
  batchId: string;
  onUploadComplete?: (certificate: AssayCertificate) => void;
  onParseComplete?: (certificateId: string) => void;
}

export function AssayCertificateUpload({
  batchId,
  onUploadComplete,
  onParseComplete,
}: AssayCertificateUploadProps) {
  const { user } = useAuth();
  const alert = useAlert();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [uploadedCertificate, setUploadedCertificate] = useState<AssayCertificate | null>(null);
  const [parseConfidence, setParseConfidence] = useState<number | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        alert.showAlert('Please select a PDF file', 'error');
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        alert.showAlert('File size must be less than 10MB', 'error');
        return;
      }

      setSelectedFile(file);
      setUploadedCertificate(null);
      setParseConfidence(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !user?.id) return;

    setUploading(true);
    try {
      const result = await uploadAssayCertificate(batchId, selectedFile, user.id);

      if (result.success && result.data) {
        setUploadedCertificate(result.data);
        alert.showAlert('Certificate uploaded successfully!', 'success');
        onUploadComplete?.(result.data);

        // Automatically start parsing
        handleParse(result.data.id, selectedFile);
      } else {
        alert.showAlert(result.error || 'Failed to upload certificate', 'error');
      }
    } catch (error: any) {
      alert.showAlert('Error uploading certificate: ' + error.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleParse = async (certificateId: string, file: File) => {
    setParsing(true);
    try {
      const result = await parseCertificate(certificateId, file);

      if (result.success && result.data) {
        setParseConfidence(result.confidence || 0);
        alert.showAlert(
          `Certificate parsed successfully! Confidence: ${((result.confidence || 0) * 100).toFixed(0)}%`,
          'success'
        );
        onParseComplete?.(certificateId);
      } else {
        alert.showAlert(result.error || 'Failed to parse certificate', 'error');
      }
    } catch (error: any) {
      alert.showAlert('Error parsing certificate: ' + error.message, 'error');
    } finally {
      setParsing(false);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file);
    } else {
      alert.showAlert('Please drop a PDF file', 'error');
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const resetUpload = () => {
    setSelectedFile(null);
    setUploadedCertificate(null);
    setParseConfidence(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="h-5 w-5 text-primary-600" />
          <h3 className="text-lg font-semibold">Upload Assay Certificate</h3>
        </div>

        {!uploadedCertificate ? (
          <>
            {/* File Drop Zone */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
              className={`
                border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                transition-colors duration-200
                ${
                  selectedFile
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
                }
              `}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                onChange={handleFileSelect}
                className="hidden"
              />

              <div className="space-y-2">
                <Upload className="h-12 w-12 mx-auto text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-700">
                    {selectedFile ? selectedFile.name : 'Drop PDF here or click to browse'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    PDF files up to 10MB
                  </p>
                </div>

                {selectedFile && (
                  <div className="flex items-center justify-center gap-2 mt-4">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="text-sm text-green-600">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Upload Button */}
            {selectedFile && (
              <div className="flex gap-3">
                <Button
                  onClick={handleUpload}
                  loading={uploading}
                  disabled={uploading || parsing}
                  className="flex-1"
                >
                  {uploading ? 'Uploading...' : 'Upload & Parse Certificate'}
                </Button>
                <Button variant="secondary" onClick={resetUpload} disabled={uploading || parsing}>
                  Cancel
                </Button>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Upload Success */}
            <Alert variant="success">
              <div className="flex items-start gap-2">
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium">Certificate Uploaded Successfully</p>
                  <p className="text-sm mt-1">File: {uploadedCertificate.file_name}</p>
                </div>
              </div>
            </Alert>

            {/* Parsing Status */}
            {parsing && (
              <Alert variant="info">
                <div className="flex items-center gap-2">
                  <Loader className="h-5 w-5 text-blue-600 animate-spin" />
                  <div>
                    <p className="font-medium">Parsing Certificate...</p>
                    <p className="text-sm mt-1">
                      Extracting assay data from the PDF document
                    </p>
                  </div>
                </div>
              </Alert>
            )}

            {/* Parse Complete */}
            {parseConfidence !== null && (
              <Alert variant={parseConfidence > 0.5 ? 'success' : 'warning'}>
                <div className="flex items-start gap-2">
                  {parseConfidence > 0.5 ? (
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="font-medium">
                      Parsing {parseConfidence > 0.5 ? 'Completed' : 'Completed with Low Confidence'}
                    </p>
                    <p className="text-sm mt-1">
                      Extraction confidence: {(parseConfidence * 100).toFixed(0)}%
                      {parseConfidence <= 0.5 && ' - Please review and verify the data'}
                    </p>
                  </div>
                </div>
              </Alert>
            )}

            {/* Upload Another */}
            <Button variant="secondary" onClick={resetUpload} className="w-full">
              Upload Another Certificate
            </Button>
          </>
        )}

        {/* Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
          <p className="font-medium text-blue-900 mb-2">Supported Certificate Formats:</p>
          <ul className="space-y-1 text-blue-800">
            <li>• Standard assay laboratory certificates (PDF)</li>
            <li>• Gold and silver content reports</li>
            <li>• Deleterious elements analysis</li>
            <li>• Purity and fineness certificates</li>
          </ul>
          <p className="mt-2 text-blue-700">
            The system will automatically extract certificate numbers, metal content, purity levels,
            and other relevant data for your review.
          </p>
        </div>
      </div>
    </Card>
  );
}
