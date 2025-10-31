import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScanText, FileText, Eye, CheckCircle, XCircle, Search } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { Loading } from '@/components/ui/Loading';
import { Modal } from '@/components/ui/Modal';
import { AssayCertificateViewer } from '@/components/batch/AssayCertificateViewer';
import { useAlert } from '@/hooks/useAlert';
import { supabase } from '@/lib/supabase';
import type { AssayCertificate } from '@/services/assayCertificateService';

interface CertificateWithBatch extends AssayCertificate {
  batch_number?: string;
  batch_status?: string;
}

export function AssayCertificatesPage() {
  const navigate = useNavigate();
  const alert = useAlert();

  const [certificates, setCertificates] = useState<CertificateWithBatch[]>([]);
  const [filteredCertificates, setFilteredCertificates] = useState<CertificateWithBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCertificate, setSelectedCertificate] = useState<AssayCertificate | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterApproval, setFilterApproval] = useState<string>('all');

  useEffect(() => {
    loadCertificates();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [certificates, searchTerm, filterStatus, filterApproval]);

  const loadCertificates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('assay_certificates')
        .select(`
          *,
          batches!inner (
            batch_number,
            status
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const certsWithBatch = data?.map((cert: any) => ({
        ...cert,
        batch_number: cert.batches?.batch_number,
        batch_status: cert.batches?.status,
      })) || [];

      setCertificates(certsWithBatch);
    } catch (error: any) {
      alert.showAlert('Error loading certificates: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...certificates];

    if (searchTerm) {
      filtered = filtered.filter(
        (cert) =>
          cert.file_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          cert.certificate_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          cert.batch_number?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter((cert) => cert.parsing_status === filterStatus);
    }

    if (filterApproval !== 'all') {
      filtered = filtered.filter((cert) => cert.approval_status === filterApproval);
    }

    setFilteredCertificates(filtered);
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

  const stats = {
    total: certificates.length,
    pending: certificates.filter((c) => c.approval_status === 'pending').length,
    approved: certificates.filter((c) => c.approval_status === 'approved').length,
    rejected: certificates.filter((c) => c.approval_status === 'rejected').length,
  };

  if (loading) {
    return (
      <MainLayout>
        <Loading />
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-violet-100 rounded-lg">
                <ScanText className="h-8 w-8 text-violet-600" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Assay Certificates</h1>
                <p className="text-gray-600 mt-1">
                  Manage and review all uploaded assay certificates
                </p>
              </div>
            </div>
          </div>

          <Button onClick={() => navigate('/batches')}>
            View Batches
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Certificates</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <FileText className="h-8 w-8 text-blue-500" />
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Pending Approval</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
              </div>
              <FileText className="h-8 w-8 text-yellow-500" />
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Approved</p>
                <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Rejected</p>
                <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
          </Card>
        </div>

        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by certificate, batch..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Parsing Status
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="all">All</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="manual_review">Manual Review</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Approval Status
              </label>
              <select
                value={filterApproval}
                onChange={(e) => setFilterApproval(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="all">All</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">
            Certificates ({filteredCertificates.length})
          </h2>

          {filteredCertificates.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-gray-400 mb-3" />
              <p className="text-gray-500">No certificates found</p>
              <p className="text-sm text-gray-400 mt-1">
                {searchTerm || filterStatus !== 'all' || filterApproval !== 'all'
                  ? 'Try adjusting your filters'
                  : 'Upload certificates from batch details pages'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredCertificates.map((certificate) => (
                <div
                  key={certificate.id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-primary-300 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="p-2 bg-violet-100 rounded">
                        <FileText className="h-5 w-5 text-violet-600" />
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900">
                            {certificate.file_name}
                          </p>
                          {certificate.certificate_number && (
                            <span className="text-xs text-gray-500">
                              #{certificate.certificate_number}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                          <span
                            className="cursor-pointer hover:text-primary-600"
                            onClick={() => navigate(`/batches/${certificate.batch_id}`)}
                          >
                            Batch: {certificate.batch_number || 'Unknown'}
                          </span>
                          <span>{new Date(certificate.created_at).toLocaleDateString()}</span>
                          {certificate.issuing_laboratory && (
                            <span>{certificate.issuing_laboratory}</span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mt-2">
                          <StatusBadge
                            status={certificate.parsing_status}
                            label={certificate.parsing_status}
                            color={getParsingStatusColor(certificate.parsing_status)}
                          />
                          <StatusBadge
                            status={certificate.approval_status}
                            label={certificate.approval_status}
                            color={getApprovalStatusColor(certificate.approval_status)}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setSelectedCertificate(certificate)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </div>
                  </div>

                  {certificate.parsing_error && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                      <p className="font-medium">Parsing Error:</p>
                      <p className="mt-1">{certificate.parsing_error}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {selectedCertificate && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedCertificate(null)}
          title={`Certificate: ${selectedCertificate.file_name}`}
          size="large"
        >
          <AssayCertificateViewer
            certificate={selectedCertificate}
            onApprove={() => {
              setSelectedCertificate(null);
              loadCertificates();
            }}
            onReject={() => {
              setSelectedCertificate(null);
              loadCertificates();
            }}
            onDataUpdate={() => {
              loadCertificates();
            }}
          />
        </Modal>
      )}
    </MainLayout>
  );
}
