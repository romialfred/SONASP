import { useState, useEffect } from 'react';
import { FileText, Eye, Trash2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Loading } from '@/components/ui/Loading';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { useAlert } from '@/hooks/useAlert';
import {
  getBatchCertificates,
  deleteCertificate,
  type AssayCertificate,
} from '@/services/assayCertificateService';

interface AssayCertificatesListProps {
  batchId: string;
  onViewCertificate?: (certificate: AssayCertificate) => void;
  refreshTrigger?: number;
}

export function AssayCertificatesList({
  batchId,
  onViewCertificate,
  refreshTrigger = 0,
}: AssayCertificatesListProps) {
  const alert = useAlert();

  const [certificates, setCertificates] = useState<AssayCertificate[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    loadCertificates();
  }, [batchId, refreshTrigger]);

  const loadCertificates = async () => {
    setLoading(true);
    try {
      const result = await getBatchCertificates(batchId);

      if (result.success && result.data) {
        setCertificates(result.data);
      } else {
        alert.showAlert(result.error || 'Failed to load certificates', 'error');
      }
    } catch (error: any) {
      alert.showAlert('Error loading certificates: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (certificateId: string) => {
    if (!confirm('Are you sure you want to delete this certificate? This action cannot be undone.')) {
      return;
    }

    setDeleting(certificateId);
    try {
      const result = await deleteCertificate(certificateId);

      if (result.success) {
        alert.showAlert('Certificate deleted successfully', 'success');
        setCertificates(certificates.filter((c) => c.id !== certificateId));
      } else {
        alert.showAlert(result.error || 'Failed to delete certificate', 'error');
      }
    } catch (error: any) {
      alert.showAlert('Error deleting certificate: ' + error.message, 'error');
    } finally {
      setDeleting(null);
    }
  };

  const getParsingStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'green';
      case 'failed':
        return 'red';
      case 'processing':
        return 'blue';
      default:
        return 'yellow';
    }
  };

  const getApprovalStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'green';
      case 'rejected':
        return 'red';
      default:
        return 'gray';
    }
  };

  if (loading) {
    return <Loading />;
  }

  if (certificates.length === 0) {
    return (
      <Card className="p-6 text-center">
        <FileText className="h-12 w-12 mx-auto text-gray-400 mb-3" />
        <p className="text-gray-500">No certificates uploaded yet</p>
        <p className="text-sm text-gray-400 mt-1">Upload an assay certificate to get started</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Assay Certificates ({certificates.length})</h3>
        <Button variant="secondary" size="sm" onClick={loadCertificates}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="space-y-3">
        {certificates.map((certificate) => (
          <Card key={certificate.id} className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <div className="p-2 bg-primary-100 rounded">
                  <FileText className="h-5 w-5 text-primary-600" />
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900">{certificate.file_name}</p>
                    {certificate.certificate_number && (
                      <span className="text-xs text-gray-500">
                        #{certificate.certificate_number}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                    <span>{new Date(certificate.created_at).toLocaleDateString()}</span>
                    {certificate.issuing_laboratory && (
                      <span>{certificate.issuing_laboratory}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-2">
                    <StatusBadge
                      status={certificate.parsing_status}
                      label={`Parse: ${certificate.parsing_status}`}
                      color={getParsingStatusColor(certificate.parsing_status)}
                    />
                    <StatusBadge
                      status={certificate.approval_status}
                      label={`Approval: ${certificate.approval_status}`}
                      color={getApprovalStatusColor(certificate.approval_status)}
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onViewCertificate?.(certificate)}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  View
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleDelete(certificate.id)}
                  loading={deleting === certificate.id}
                  disabled={deleting === certificate.id}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {certificate.parsing_error && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                <p className="font-medium">Parsing Error:</p>
                <p className="mt-1">{certificate.parsing_error}</p>
              </div>
            )}

            {certificate.approval_notes && certificate.approval_status === 'rejected' && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
                <p className="font-medium">Rejection Notes:</p>
                <p className="mt-1">{certificate.approval_notes}</p>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
