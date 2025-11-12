import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ScanText, FileText, Eye, CheckCircle, XCircle, Search, Package,
  MapPin, Calendar, Scale, Building2, FlaskConical, ChevronRight, Download
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { Loading } from '@/components/ui/Loading';
import { PDFViewer } from '@/components/ui/PDFViewer';
import { AssayCertificateViewer } from '@/components/batch/AssayCertificateViewer';
import { useAlert } from '@/hooks/useAlert';
import { supabase } from '@/lib/supabase';
import { getCertificateSignedUrl } from '@/services/assayCertificateService';
import type { AssayCertificate } from '@/services/assayCertificateService';

interface BatchWithCertificates {
  id: string;
  batch_number: string;
  status: string;
  weight_grams: number;
  mining_company_name: string;
  mining_company_country: string;
  refinery_name: string;
  created_at: string;
  certificates: CertificateWithData[];
}

interface CertificateWithData extends AssayCertificate {
  parsed_data?: {
    laboratory_name?: string;
    gold_content_gpt?: number;
    silver_content_gpt?: number;
    gold_purity_percentage?: number;
    sample_weight_g?: number;
  };
}

export function AssayCertificatesPage() {
  const navigate = useNavigate();
  const alert = useAlert();

  const [batchGroups, setBatchGroups] = useState<BatchWithCertificates[]>([]);
  const [filteredBatchGroups, setFilteredBatchGroups] = useState<BatchWithCertificates[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCertificate, setSelectedCertificate] = useState<AssayCertificate | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterApproval, setFilterApproval] = useState<string>('all');
  const [showCertificateViewer, setShowCertificateViewer] = useState(false);

  useEffect(() => {
    loadCertificatesByBatch();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [batchGroups, searchTerm, filterStatus, filterApproval]);

  useEffect(() => {
    if (selectedCertificate) {
      loadPdfUrl(selectedCertificate);
    } else {
      setPdfUrl(null);
    }
  }, [selectedCertificate]);

  const loadPdfUrl = async (certificate: AssayCertificate) => {
    setLoadingPdf(true);
    try {
      const result = await getCertificateSignedUrl(certificate.id);
      if (result.success && result.url) {
        setPdfUrl(result.url);
      } else {
        alert.showAlert('Failed to load PDF', 'error');
      }
    } catch (error: any) {
      alert.showAlert('Error loading PDF: ' + error.message, 'error');
    } finally {
      setLoadingPdf(false);
    }
  };

  const loadCertificatesByBatch = async () => {
    setLoading(true);
    try {
      const { data: certificatesData, error: certsError } = await supabase
        .from('assay_certificates')
        .select(`
          *,
          batches!inner (
            id,
            batch_number,
            status,
            weight_grams,
            created_at,
            mining_company:mining_companies (
              name,
              country
            ),
            refinery:refineries (
              name
            )
          ),
          parsed_data:assay_certificate_data (
            laboratory_name,
            gold_content_gpt,
            silver_content_gpt,
            gold_purity_percentage,
            sample_weight_g
          )
        `)
        .order('created_at', { ascending: false });

      if (certsError) throw certsError;

      const batchMap = new Map<string, BatchWithCertificates>();

      certificatesData?.forEach((cert: any) => {
        const batch = cert.batches;
        const batchId = batch.id;

        if (!batchMap.has(batchId)) {
          batchMap.set(batchId, {
            id: batchId,
            batch_number: batch.batch_number,
            status: batch.status,
            weight_grams: batch.weight_grams,
            mining_company_name: batch.mining_company?.name || 'Unknown',
            mining_company_country: batch.mining_company?.country || 'Unknown',
            refinery_name: batch.refinery?.name || 'Not Assigned',
            created_at: batch.created_at,
            certificates: [],
          });
        }

        const batchGroup = batchMap.get(batchId)!;
        batchGroup.certificates.push({
          ...cert,
          parsed_data: cert.parsed_data?.[0] || null,
        });
      });

      const batches = Array.from(batchMap.values()).sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setBatchGroups(batches);
    } catch (error: any) {
      alert.showAlert('Error loading certificates: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...batchGroups];

    if (searchTerm) {
      filtered = filtered.filter(
        (batch) =>
          batch.batch_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
          batch.mining_company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          batch.certificates.some(cert =>
            cert.file_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            cert.certificate_number?.toLowerCase().includes(searchTerm.toLowerCase())
          )
      );
    }

    if (filterStatus !== 'all' || filterApproval !== 'all') {
      filtered = filtered.map(batch => ({
        ...batch,
        certificates: batch.certificates.filter(cert => {
          const statusMatch = filterStatus === 'all' || cert.parsing_status === filterStatus;
          const approvalMatch = filterApproval === 'all' || cert.approval_status === filterApproval;
          return statusMatch && approvalMatch;
        })
      })).filter(batch => batch.certificates.length > 0);
    }

    setFilteredBatchGroups(filtered);
  };

  const getApprovalStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'green';
      case 'rejected': return 'red';
      default: return 'gray';
    }
  };

  const getAllCertificates = () => {
    return batchGroups.flatMap(batch => batch.certificates);
  };

  const stats = {
    total: getAllCertificates().length,
    totalBatches: batchGroups.length,
    pending: getAllCertificates().filter((c) => c.approval_status === 'pending').length,
    approved: getAllCertificates().filter((c) => c.approval_status === 'approved').length,
    rejected: getAllCertificates().filter((c) => c.approval_status === 'rejected').length,
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
      <div className="h-[calc(100vh-4rem)] flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 pb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <ScanText className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Assay Certificates</h1>
                <p className="text-xs text-gray-500 mt-0.5">
                  {stats.totalBatches} batches • {stats.total} certificates
                </p>
              </div>
            </div>
            <Button onClick={() => navigate('/batches')} size="sm">
              View Batches
            </Button>
          </div>

          {/* Compact Stats */}
          <div className="grid grid-cols-5 gap-2 mb-4">
            <Card className="p-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">Batches</p>
                  <p className="text-lg font-bold text-gray-900">{stats.totalBatches}</p>
                </div>
                <Package className="h-5 w-5 text-slate-400" />
              </div>
            </Card>

            <Card className="p-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">Total</p>
                  <p className="text-lg font-bold text-gray-900">{stats.total}</p>
                </div>
                <FileText className="h-5 w-5 text-blue-400" />
              </div>
            </Card>

            <Card className="p-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">Pending</p>
                  <p className="text-lg font-bold text-yellow-600">{stats.pending}</p>
                </div>
                <FileText className="h-5 w-5 text-yellow-400" />
              </div>
            </Card>

            <Card className="p-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">Approved</p>
                  <p className="text-lg font-bold text-green-600">{stats.approved}</p>
                </div>
                <CheckCircle className="h-5 w-5 text-green-400" />
              </div>
            </Card>

            <Card className="p-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">Rejected</p>
                  <p className="text-lg font-bold text-red-600">{stats.rejected}</p>
                </div>
                <XCircle className="h-5 w-5 text-red-400" />
              </div>
            </Card>
          </div>

          {/* Compact Filters */}
          <Card className="p-3">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                  <Input
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8 h-8 text-xs"
                  />
                </div>
              </div>

              <div>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Status</option>
                  <option value="pending">Pending</option>
                  <option value="processing">Processing</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                </select>
              </div>

              <div>
                <select
                  value={filterApproval}
                  onChange={(e) => setFilterApproval(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Approvals</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>
          </Card>
        </div>

        {/* Main Content Area - 2 Panel Layout */}
        <div className="flex-1 flex gap-4 min-h-0">
          {/* Left Panel - Certificate List */}
          <div className="w-1/2 overflow-y-auto pr-2">
            {filteredBatchGroups.length === 0 ? (
              <Card className="p-8">
                <div className="text-center">
                  <Package className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                  <p className="text-sm text-gray-500 font-medium">No certificates found</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {searchTerm || filterStatus !== 'all' || filterApproval !== 'all'
                      ? 'Try adjusting your filters'
                      : 'Upload certificates from batch details'}
                  </p>
                </div>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredBatchGroups.map((batch) => (
                  <Card
                    key={batch.id}
                    className="overflow-hidden hover:shadow-md transition-shadow"
                  >
                    {/* Batch Header - Compact */}
                    <div className="bg-gradient-to-r from-slate-50 to-gray-50 p-3 border-b border-gray-200">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-blue-600" />
                          <h3 className="text-sm font-bold text-gray-900">
                            {batch.batch_number}
                          </h3>
                          <span className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded font-medium">
                            {batch.certificates.length}
                          </span>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => navigate(`/batches/${batch.id}`)}
                          className="h-6 px-2 text-xs"
                        >
                          Details
                        </Button>
                      </div>

                      {/* Compact Batch Info */}
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="flex items-center gap-1">
                          <Building2 className="h-3 w-3 text-gray-400" />
                          <span className="text-gray-600 truncate">
                            {batch.mining_company_name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-gray-400" />
                          <span className="text-gray-600">
                            {batch.mining_company_country}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Scale className="h-3 w-3 text-gray-400" />
                          <span className="text-gray-600">
                            {batch.weight_grams.toLocaleString()}g
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Certificate Sub-tiles */}
                    <div className="p-2 bg-white space-y-1.5">
                      {batch.certificates.map((certificate) => {
                        const parsedData = certificate.parsed_data;
                        const isSelected = selectedCertificate?.id === certificate.id;

                        return (
                          <div
                            key={certificate.id}
                            onClick={() => setSelectedCertificate(certificate)}
                            className={`
                              group relative p-2.5 rounded-lg border transition-all cursor-pointer
                              ${isSelected
                                ? 'bg-blue-50 border-blue-400 shadow-sm'
                                : 'bg-gray-50 border-gray-200 hover:bg-blue-50/50 hover:border-blue-300'
                              }
                            `}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                {/* Certificate Title */}
                                <div className="flex items-center gap-2 mb-1.5">
                                  <FileText className={`h-3.5 w-3.5 flex-shrink-0 ${isSelected ? 'text-blue-600' : 'text-gray-500'}`} />
                                  <p className="text-xs font-medium text-gray-900 truncate">
                                    {certificate.file_name}
                                  </p>
                                </div>

                                {/* Certificate Data - Horizontal Compact */}
                                {parsedData && (
                                  <div className="flex items-center gap-3 text-xs">
                                    {parsedData.gold_content_gpt && (
                                      <div className="flex items-center gap-1">
                                        <span className="text-gray-500">Au:</span>
                                        <span className="font-semibold text-yellow-700">
                                          {parsedData.gold_content_gpt} g/t
                                        </span>
                                      </div>
                                    )}
                                    {parsedData.gold_purity_percentage && (
                                      <div className="flex items-center gap-1">
                                        <span className="text-gray-500">Purity:</span>
                                        <span className="font-semibold text-amber-700">
                                          {parsedData.gold_purity_percentage}%
                                        </span>
                                      </div>
                                    )}
                                    {certificate.certificate_date && (
                                      <div className="flex items-center gap-1 text-gray-500">
                                        <Calendar className="h-3 w-3" />
                                        <span>
                                          {new Date(certificate.certificate_date).toLocaleDateString('fr-FR')}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Status and Actions */}
                              <div className="flex items-center gap-1.5 flex-shrink-0">
                                <div className={`
                                  w-2 h-2 rounded-full
                                  ${certificate.approval_status === 'approved' ? 'bg-green-500' :
                                    certificate.approval_status === 'rejected' ? 'bg-red-500' :
                                    'bg-gray-300'}
                                `} />
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedCertificate(certificate);
                                    setShowCertificateViewer(true);
                                  }}
                                  className="h-6 w-6 p-0"
                                  title="View details"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>

                            {/* Selected Indicator */}
                            {isSelected && (
                              <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600 rounded-l-lg" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Right Panel - PDF Viewer */}
          <div className="w-1/2 overflow-hidden">
            <Card className="h-full flex flex-col">
              {selectedCertificate ? (
                <>
                  {/* PDF Header */}
                  <div className="flex-shrink-0 p-3 border-b border-gray-200 bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {selectedCertificate.file_name}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <StatusBadge
                            status={selectedCertificate.approval_status}
                            label={selectedCertificate.approval_status}
                            color={getApprovalStatusColor(selectedCertificate.approval_status)}
                            size="sm"
                          />
                          {selectedCertificate.certificate_number && (
                            <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded">
                              {selectedCertificate.certificate_number}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setShowCertificateViewer(true)}
                          className="h-7 px-2 text-xs"
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          Details
                        </Button>
                        {pdfUrl && (
                          <a href={pdfUrl} download target="_blank" rel="noopener noreferrer">
                            <Button
                              variant="secondary"
                              size="sm"
                              className="h-7 px-2 text-xs"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* PDF Content */}
                  <div className="flex-1 bg-gray-100 overflow-hidden">
                    {loadingPdf ? (
                      <div className="h-full flex items-center justify-center">
                        <Loading />
                      </div>
                    ) : pdfUrl ? (
                      <PDFViewer url={pdfUrl} />
                    ) : (
                      <div className="h-full flex items-center justify-center">
                        <div className="text-center">
                          <FileText className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                          <p className="text-sm text-gray-500">Unable to load PDF</p>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="h-full flex items-center justify-center bg-gray-50">
                  <div className="text-center">
                    <FileText className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                    <p className="text-sm text-gray-500 font-medium">No certificate selected</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Select a certificate from the list to view its PDF
                    </p>
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>

      {/* Certificate Viewer Modal */}
      {showCertificateViewer && selectedCertificate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-6xl h-[90vh] bg-white rounded-lg shadow-2xl overflow-hidden">
            <AssayCertificateViewer
              certificate={selectedCertificate}
              onClose={() => setShowCertificateViewer(false)}
              onApprove={() => {
                loadCertificatesByBatch();
                setShowCertificateViewer(false);
              }}
              onReject={() => {
                loadCertificatesByBatch();
                setShowCertificateViewer(false);
              }}
              onDataUpdate={() => {
                loadCertificatesByBatch();
              }}
            />
          </div>
        </div>
      )}
    </MainLayout>
  );
}
