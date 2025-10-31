import { useState, useEffect } from 'react';
import { FileText, Download, Eye, CheckCircle, XCircle, Edit, Save } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { FormField } from '@/components/ui/FormField';
import { Loading } from '@/components/ui/Loading';
import { PDFViewer } from '@/components/ui/PDFViewer';
import { useAlert } from '@/hooks/useAlert';
import { useAuth } from '@/contexts/AuthContext';
import {
  getCertificateSignedUrl,
  getCertificateData,
  updateCertificateData,
  approveCertificateData,
  rejectCertificateData,
  type AssayCertificate,
  type AssayCertificateData,
} from '@/services/assayCertificateService';

interface AssayCertificateViewerProps {
  certificate: AssayCertificate;
  onApprove?: () => void;
  onReject?: () => void;
  onDataUpdate?: () => void;
}

export function AssayCertificateViewer({
  certificate,
  onApprove,
  onReject,
  onDataUpdate,
}: AssayCertificateViewerProps) {
  const { user } = useAuth();
  const alert = useAlert();

  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [certificateData, setCertificateData] = useState<AssayCertificateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPDF, setShowPDF] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editedData, setEditedData] = useState<Partial<AssayCertificateData>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, [certificate.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Get signed URL for PDF
      const urlResult = await getCertificateSignedUrl(certificate.file_path);
      if (urlResult.success && urlResult.url) {
        setPdfUrl(urlResult.url);
      }

      // Get parsed data if available
      if (certificate.parsing_status === 'completed') {
        const dataResult = await getCertificateData(certificate.id);
        if (dataResult.success && dataResult.data) {
          setCertificateData(dataResult.data);
          setEditedData(dataResult.data);
        }
      }
    } catch (error: any) {
      alert.showAlert('Error loading certificate: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveChanges = async () => {
    if (!certificateData) return;

    setSubmitting(true);
    try {
      const result = await updateCertificateData(certificateData.id, editedData);

      if (result.success && result.data) {
        setCertificateData(result.data);
        setEditing(false);
        alert.showAlert('Certificate data updated successfully!', 'success');
        onDataUpdate?.();
      } else {
        alert.showAlert(result.error || 'Failed to update data', 'error');
      }
    } catch (error: any) {
      alert.showAlert('Error updating data: ' + error.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async () => {
    if (!user?.id) return;

    setSubmitting(true);
    try {
      const result = await approveCertificateData(certificate.id, user.id);

      if (result.success) {
        alert.showAlert('Certificate data approved!', 'success');
        onApprove?.();
      } else {
        alert.showAlert(result.error || 'Failed to approve', 'error');
      }
    } catch (error: any) {
      alert.showAlert('Error approving: ' + error.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!user?.id) return;

    const notes = prompt('Please provide a reason for rejection:');
    if (!notes) return;

    setSubmitting(true);
    try {
      const result = await rejectCertificateData(certificate.id, user.id, notes);

      if (result.success) {
        alert.showAlert('Certificate data rejected', 'success');
        onReject?.();
      } else {
        alert.showAlert(result.error || 'Failed to reject', 'error');
      }
    } catch (error: any) {
      alert.showAlert('Error rejecting: ' + error.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <Loading />;
  }

  return (
    <div className="space-y-6">
      {/* Certificate Info Card */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary-600" />
            <h3 className="text-lg font-semibold">Certificate Details</h3>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowPDF(!showPDF)}
            >
              <Eye className="h-4 w-4 mr-2" />
              {showPDF ? 'Hide' : 'View'} PDF
            </Button>
            {pdfUrl && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => window.open(pdfUrl, '_blank')}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-600">File Name</p>
            <p className="font-medium text-gray-900">{certificate.file_name}</p>
          </div>
          <div>
            <p className="text-gray-600">Upload Date</p>
            <p className="font-medium text-gray-900">
              {new Date(certificate.created_at).toLocaleDateString()}
            </p>
          </div>
          <div>
            <p className="text-gray-600">Parsing Status</p>
            <span
              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                certificate.parsing_status === 'completed'
                  ? 'bg-green-100 text-green-800'
                  : certificate.parsing_status === 'failed'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}
            >
              {certificate.parsing_status}
            </span>
          </div>
          <div>
            <p className="text-gray-600">Approval Status</p>
            <span
              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                certificate.approval_status === 'approved'
                  ? 'bg-green-100 text-green-800'
                  : certificate.approval_status === 'rejected'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {certificate.approval_status}
            </span>
          </div>
        </div>
      </Card>

      {/* PDF Viewer */}
      {showPDF && pdfUrl && (
        <Card className="p-4">
          <PDFViewer pdfUrl={pdfUrl} />
        </Card>
      )}

      {/* Parsed Data Card */}
      {certificateData && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Parsed Assay Data</h3>
            {!editing && certificate.approval_status === 'pending' && (
              <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit Data
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Certificate Info */}
            <FormField label="Certificate Number">
              <Input
                value={editing ? editedData.certificate_number || '' : certificateData.certificate_number || 'N/A'}
                onChange={(e) => setEditedData({ ...editedData, certificate_number: e.target.value })}
                disabled={!editing}
              />
            </FormField>

            <FormField label="Laboratory">
              <Input
                value={editing ? editedData.laboratory_name || '' : certificateData.laboratory_name || 'N/A'}
                onChange={(e) => setEditedData({ ...editedData, laboratory_name: e.target.value })}
                disabled={!editing}
              />
            </FormField>

            {/* Gold Content */}
            <FormField label="Gold Content (g/t)">
              <Input
                type="number"
                step="0.001"
                value={editing ? editedData.gold_content_gpt || '' : certificateData.gold_content_gpt || ''}
                onChange={(e) => setEditedData({ ...editedData, gold_content_gpt: parseFloat(e.target.value) || null })}
                disabled={!editing}
              />
            </FormField>

            <FormField label="Gold Purity (%)">
              <Input
                type="number"
                step="0.01"
                value={editing ? editedData.gold_purity_percentage || '' : certificateData.gold_purity_percentage || ''}
                onChange={(e) => setEditedData({ ...editedData, gold_purity_percentage: parseFloat(e.target.value) || null })}
                disabled={!editing}
              />
            </FormField>

            {/* Silver Content */}
            <FormField label="Silver Content (g/t)">
              <Input
                type="number"
                step="0.001"
                value={editing ? editedData.silver_content_gpt || '' : certificateData.silver_content_gpt || ''}
                onChange={(e) => setEditedData({ ...editedData, silver_content_gpt: parseFloat(e.target.value) || null })}
                disabled={!editing}
              />
            </FormField>

            <FormField label="Fineness">
              <Input
                type="number"
                step="0.001"
                value={editing ? editedData.fineness || '' : certificateData.fineness || ''}
                onChange={(e) => setEditedData({ ...editedData, fineness: parseFloat(e.target.value) || null })}
                disabled={!editing}
              />
            </FormField>

            {/* Sample Info */}
            <FormField label="Sample Weight (g)">
              <Input
                type="number"
                step="0.001"
                value={editing ? editedData.sample_weight_g || '' : certificateData.sample_weight_g || ''}
                onChange={(e) => setEditedData({ ...editedData, sample_weight_g: parseFloat(e.target.value) || null })}
                disabled={!editing}
              />
            </FormField>

            <FormField label="Extraction Confidence">
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      certificateData.extraction_confidence > 0.7
                        ? 'bg-green-500'
                        : certificateData.extraction_confidence > 0.4
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${certificateData.extraction_confidence * 100}%` }}
                  />
                </div>
                <span className="text-sm font-medium">
                  {(certificateData.extraction_confidence * 100).toFixed(0)}%
                </span>
              </div>
            </FormField>
          </div>

          {/* Deleterious Elements */}
          {Object.keys(certificateData.deleterious_elements || {}).length > 0 && (
            <div className="mt-6">
              <h4 className="font-medium mb-3">Deleterious Elements</h4>
              <div className="grid grid-cols-3 gap-3">
                {Object.entries(certificateData.deleterious_elements).map(([element, value]) => (
                  <div key={element} className="bg-gray-50 rounded p-3">
                    <p className="text-xs text-gray-600 capitalize">{element}</p>
                    <p className="text-sm font-medium">{value} ppm</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {editing ? (
            <div className="flex gap-3 mt-6">
              <Button onClick={handleSaveChanges} loading={submitting}>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setEditing(false);
                  setEditedData(certificateData);
                }}
                disabled={submitting}
              >
                Cancel
              </Button>
            </div>
          ) : (
            certificate.approval_status === 'pending' && (
              <div className="flex gap-3 mt-6">
                <Button onClick={handleApprove} loading={submitting}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve Data
                </Button>
                <Button variant="danger" onClick={handleReject} disabled={submitting}>
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </Button>
              </div>
            )
          )}
        </Card>
      )}
    </div>
  );
}
