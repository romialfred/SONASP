import { useState, useEffect } from 'react';
import { FileText, Download, Eye, CheckCircle, XCircle, Edit, Save, Award, Beaker, Scale, Sparkles, AlertTriangle, Info } from 'lucide-react';
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
  onClose?: () => void;
}

export function AssayCertificateViewer({
  certificate,
  onApprove,
  onReject,
  onDataUpdate,
  onClose,
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
      alert.error('Error loading certificate: ' + error.message);
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
        alert.success('Certificate data updated successfully!');
        onDataUpdate?.();
      } else {
        alert.error(result.error || 'Failed to update data');
      }
    } catch (error: any) {
      alert.error('Error updating data: ' + error.message);
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
        alert.success('Certificate data approved!');
        onApprove?.();
        onDataUpdate?.();

        // Close modal after successful approval
        setTimeout(() => {
          onClose?.();
        }, 500);
      } else {
        alert.error(result.error || 'Failed to approve');
      }
    } catch (error: any) {
      alert.error('Error approving: ' + error.message);
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
        alert.success('Certificate data rejected');
        onReject?.();
        onDataUpdate?.();

        // Close modal after successful rejection
        setTimeout(() => {
          onClose?.();
        }, 500);
      } else {
        alert.error(result.error || 'Failed to reject');
      }
    } catch (error: any) {
      alert.error('Error rejecting: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loading />
      </div>
    );
  }

  return (
    <div className="space-y-3 p-3">
      {/* Professional Header with Status Indicators */}
      <div className="bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-lg p-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Award className="h-5 w-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-gray-900 mb-0.5">Certificate Analysis</h2>
              <p className="text-xs text-gray-600 mb-2">{certificate.file_name}</p>

              <div className="flex flex-wrap gap-2">
                {/* Parsing Status */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-600">Parsing:</span>
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                      certificate.parsing_status === 'completed'
                        ? 'bg-green-100 text-green-800 border border-green-300'
                        : certificate.parsing_status === 'failed'
                        ? 'bg-red-100 text-red-800 border border-red-300'
                        : 'bg-yellow-100 text-yellow-800 border border-yellow-300'
                    }`}
                  >
                    {certificate.parsing_status === 'completed' ? (
                      <>
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Completed
                      </>
                    ) : certificate.parsing_status === 'failed' ? (
                      <>
                        <XCircle className="w-3 h-3 mr-1" />
                        Failed
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        Pending
                      </>
                    )}
                  </span>
                </div>

                {/* Approval Status */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-600">Approval:</span>
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                      certificate.approval_status === 'approved'
                        ? 'bg-green-100 text-green-800 border border-green-300'
                        : certificate.approval_status === 'rejected'
                        ? 'bg-red-100 text-red-800 border border-red-300'
                        : 'bg-gray-100 text-gray-800 border border-gray-300'
                    }`}
                  >
                    {certificate.approval_status === 'approved' ? (
                      <>
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Approved
                      </>
                    ) : certificate.approval_status === 'rejected' ? (
                      <>
                        <XCircle className="w-3 h-3 mr-1" />
                        Rejected
                      </>
                    ) : (
                      <>
                        <Info className="w-3 h-3 mr-1" />
                        Pending Review
                      </>
                    )}
                  </span>
                </div>

                {/* Upload Date */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-600">Uploaded:</span>
                  <span className="text-xs font-medium text-gray-900">
                    {new Date(certificate.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowPDF(!showPDF)}
              className="flex items-center gap-2"
            >
              <Eye className="h-4 w-4" />
              {showPDF ? 'Hide PDF' : 'View PDF'}
            </Button>
            {pdfUrl && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => window.open(pdfUrl, '_blank')}
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Download
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* PDF Viewer */}
      {showPDF && pdfUrl && (
        <Card className="border-2 border-gray-200">
          <div className="p-2">
            <PDFViewer pdfUrl={pdfUrl} />
          </div>
        </Card>
      )}

      {/* Parsed Data Section */}
      {certificateData && (
        <div className="space-y-3">
          {/* Section Header with Edit Button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <Beaker className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Assay Data</h3>
                <p className="text-xs text-gray-600">Extracted laboratory analysis results</p>
              </div>
            </div>
            {!editing && certificate.approval_status === 'pending' && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setEditing(true)}
                className="flex items-center gap-2"
              >
                <Edit className="h-4 w-4" />
                Edit Data
              </Button>
            )}
          </div>

          {/* Certificate Information */}
          <Card className="border border-blue-100 bg-blue-50/30">
            <div className="p-3">
              <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600" />
                Certificate Information
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Certificate Number">
                  <Input
                    value={editing ? editedData.certificate_number || '' : certificateData.certificate_number || 'N/A'}
                    onChange={(e) => setEditedData({ ...editedData, certificate_number: e.target.value })}
                    disabled={!editing}
                    className={editing ? 'border-blue-300 focus:border-blue-500' : ''}
                  />
                </FormField>

                <FormField label="Laboratory Name">
                  <Input
                    value={editing ? editedData.laboratory_name || '' : certificateData.laboratory_name || 'N/A'}
                    onChange={(e) => setEditedData({ ...editedData, laboratory_name: e.target.value })}
                    disabled={!editing}
                    className={editing ? 'border-blue-300 focus:border-blue-500' : ''}
                  />
                </FormField>
              </div>
            </div>
          </Card>

          {/* Gold & Silver Analysis */}
          <Card className="border border-amber-100 bg-amber-50/30">
            <div className="p-3">
              <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-600" />
                Precious Metals Analysis
              </h4>
              <div className="grid grid-cols-3 gap-3">
                <FormField label="Gold Content (g/t)">
                  <Input
                    type="number"
                    step="0.001"
                    value={editing ? editedData.gold_content_gpt || '' : certificateData.gold_content_gpt || ''}
                    onChange={(e) => setEditedData({ ...editedData, gold_content_gpt: parseFloat(e.target.value) || null })}
                    disabled={!editing}
                    className={editing ? 'border-amber-300 focus:border-amber-500' : ''}
                  />
                </FormField>

                <FormField label="Gold Purity (%)">
                  <Input
                    type="number"
                    step="0.01"
                    value={editing ? editedData.gold_purity_percentage || '' : certificateData.gold_purity_percentage || ''}
                    onChange={(e) => setEditedData({ ...editedData, gold_purity_percentage: parseFloat(e.target.value) || null })}
                    disabled={!editing}
                    className={editing ? 'border-amber-300 focus:border-amber-500' : ''}
                  />
                </FormField>

                <FormField label="Fineness">
                  <Input
                    type="number"
                    step="0.001"
                    value={editing ? editedData.fineness || '' : certificateData.fineness || ''}
                    onChange={(e) => setEditedData({ ...editedData, fineness: parseFloat(e.target.value) || null })}
                    disabled={!editing}
                    className={editing ? 'border-amber-300 focus:border-amber-500' : ''}
                  />
                </FormField>

                <FormField label="Silver Content (g/t)">
                  <Input
                    type="number"
                    step="0.001"
                    value={editing ? editedData.silver_content_gpt || '' : certificateData.silver_content_gpt || ''}
                    onChange={(e) => setEditedData({ ...editedData, silver_content_gpt: parseFloat(e.target.value) || null })}
                    disabled={!editing}
                    className={editing ? 'border-amber-300 focus:border-amber-500' : ''}
                  />
                </FormField>

                <FormField label="Sample Weight (g)">
                  <Input
                    type="number"
                    step="0.001"
                    value={editing ? editedData.sample_weight_g || '' : certificateData.sample_weight_g || ''}
                    onChange={(e) => setEditedData({ ...editedData, sample_weight_g: parseFloat(e.target.value) || null })}
                    disabled={!editing}
                    className={editing ? 'border-amber-300 focus:border-amber-500' : ''}
                  />
                </FormField>

                <FormField label="Extraction Confidence">
                  <div className="flex items-center gap-3 h-10">
                    <div className="flex-1 bg-gray-200 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all ${
                          certificateData.extraction_confidence > 0.7
                            ? 'bg-green-500'
                            : certificateData.extraction_confidence > 0.4
                            ? 'bg-yellow-500'
                            : 'bg-red-500'
                        }`}
                        style={{ width: `${certificateData.extraction_confidence * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold text-gray-900 min-w-[45px]">
                      {(certificateData.extraction_confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                </FormField>
              </div>
            </div>
          </Card>

          {/* Deleterious Elements */}
          {Object.keys(certificateData.deleterious_elements || {}).length > 0 && (
            <Card className="border border-orange-100 bg-orange-50/30">
              <div className="p-3">
                <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                  Deleterious Elements
                </h4>
                <div className="grid grid-cols-4 gap-2">
                  {Object.entries(certificateData.deleterious_elements).map(([element, value]) => (
                    <div key={element} className="bg-white rounded border border-orange-200 p-2 text-center">
                      <p className="text-xs text-gray-600 uppercase font-medium">{element}</p>
                      <p className="text-base font-bold text-gray-900">{value}</p>
                      <p className="text-xs text-gray-500">ppm</p>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {/* Action Buttons - Professional Design */}
          {editing ? (
            <div className="flex gap-3 justify-end p-3 bg-gray-50 border-t border-gray-200 -mx-3 -mb-3 rounded-b-lg">
              <Button
                variant="secondary"
                onClick={() => {
                  setEditing(false);
                  setEditedData(certificateData);
                }}
                disabled={submitting}
                size="lg"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveChanges}
                loading={submitting}
                size="lg"
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </Button>
            </div>
          ) : (
            certificate.approval_status === 'pending' && (
              <div className="flex gap-3 justify-center p-4 bg-gradient-to-r from-green-50 to-red-50 border-t border-gray-200 -mx-3 -mb-3 rounded-b-lg">
                <Button
                  onClick={handleReject}
                  disabled={submitting}
                  size="lg"
                  className="bg-red-600 hover:bg-red-700 text-white px-8"
                >
                  <XCircle className="h-5 w-5 mr-2" />
                  Reject Certificate
                </Button>
                <Button
                  onClick={handleApprove}
                  loading={submitting}
                  size="lg"
                  className="bg-green-600 hover:bg-green-700 text-white px-8"
                >
                  <CheckCircle className="h-5 w-5 mr-2" />
                  Approve Certificate
                </Button>
              </div>
            )
          )}
        </div>
      )}

      {/* No Data Message */}
      {!certificateData && certificate.parsing_status !== 'completed' && (
        <Card className="border-2 border-yellow-200 bg-yellow-50">
          <div className="p-8 text-center">
            <AlertTriangle className="h-12 w-12 text-yellow-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Certificate Data Not Available
            </h3>
            <p className="text-sm text-gray-600">
              {certificate.parsing_status === 'pending'
                ? 'The certificate is currently being processed. Please check back later.'
                : 'The certificate parsing has failed. Please contact support.'}
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
