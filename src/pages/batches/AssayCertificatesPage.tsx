import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScanText, FileText, Eye, CheckCircle, XCircle, Search, Package, MapPin, Calendar, Scale, ChevronDown, ChevronUp, Building2, FlaskConical } from 'lucide-react';
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
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterApproval, setFilterApproval] = useState<string>('all');
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadCertificatesByBatch();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [batchGroups, searchTerm, filterStatus, filterApproval]);

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

      // Expand all by default
      setExpandedBatches(new Set(batches.map(b => b.id)));
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

  const toggleBatchExpansion = (batchId: string) => {
    setExpandedBatches(prev => {
      const newSet = new Set(prev);
      if (newSet.has(batchId)) {
        newSet.delete(batchId);
      } else {
        newSet.add(batchId);
      }
      return newSet;
    });
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
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-100 rounded-lg">
                <ScanText className="h-8 w-8 text-blue-600" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Assay Certificates</h1>
                <p className="text-gray-600 mt-1">
                  Certificates grouped by batch with lab analysis summaries
                </p>
              </div>
            </div>
          </div>

          <Button onClick={() => navigate('/batches')}>
            View Batches
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Batches</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalBatches}</p>
              </div>
              <Package className="h-8 w-8 text-slate-500" />
            </div>
          </Card>

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
                <p className="text-sm text-gray-600">Pending</p>
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
                  placeholder="Search by batch, certificate, company..."
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          {filteredBatchGroups.length === 0 ? (
            <Card className="p-12">
              <div className="text-center">
                <Package className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                <p className="text-lg text-gray-500 font-medium">No batches with certificates found</p>
                <p className="text-sm text-gray-400 mt-2">
                  {searchTerm || filterStatus !== 'all' || filterApproval !== 'all'
                    ? 'Try adjusting your filters'
                    : 'Upload certificates from batch details pages'}
                </p>
              </div>
            </Card>
          ) : (
            filteredBatchGroups.map((batch, batchIndex) => {
              const isExpanded = expandedBatches.has(batch.id);
              const totalCerts = batch.certificates.length;
              const approvedCerts = batch.certificates.filter(c => c.approval_status === 'approved').length;
              const pendingCerts = batch.certificates.filter(c => c.approval_status === 'pending').length;

              // Alternating background colors for batches
              const batchBgColor = batchIndex % 2 === 0 ? 'bg-blue-50/40' : 'bg-purple-50/40';
              const batchHoverBg = batchIndex % 2 === 0 ? 'hover:bg-blue-100/60' : 'hover:bg-purple-100/60';
              const batchBorderColor = batchIndex % 2 === 0 ? 'border-blue-200' : 'border-purple-200';

              // Get unique laboratories - extract short name only
              const extractLabName = (fullName: string | null | undefined): string | null => {
                if (!fullName) return null;
                // Extract just the lab name before "License No:" or "Certificate"
                const match = fullName.match(/^([^L]+?)(?:\s+License|Certificate)/);
                return match ? match[1].trim() : fullName.split(/\s+/).slice(0, 5).join(' ');
              };

              const labs = Array.from(new Set(
                batch.certificates
                  .map(c => extractLabName(c.parsed_data?.laboratory_name || c.issuing_laboratory))
                  .filter(Boolean)
              ));

              // Get certificate numbers
              const certNumbers = batch.certificates
                .map(c => c.certificate_number)
                .filter(Boolean);

              // Calculate average gold content if available
              const goldContents = batch.certificates
                .map(c => c.parsed_data?.gold_content_gpt)
                .filter((g): g is number => g !== undefined && g !== null);
              const avgGoldContent = goldContents.length > 0
                ? (goldContents.reduce((a, b) => a + b, 0) / goldContents.length).toFixed(2)
                : null;

              return (
                <Card
                  key={batch.id}
                  className={`overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer border-2 ${batchBorderColor} ${batchBgColor} ${batchHoverBg} hover:border-blue-400`}
                  onClick={() => navigate(`/batches/${batch.id}`)}
                >
                  <div className="bg-gradient-to-r from-slate-50 to-gray-50 p-5 border-b border-gray-200">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="p-2 bg-blue-100 rounded">
                            <Package className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <div className="flex items-center gap-3">
                              <h3
                                className="text-xl font-bold text-gray-900 cursor-pointer hover:text-blue-600 transition-colors"
                                onClick={() => navigate(`/batches/${batch.id}`)}
                              >
                                {batch.batch_number}
                              </h3>
                              <StatusBadge
                                status={batch.status}
                                label={batch.status}
                                color={batch.status.includes('approved') ? 'green' : batch.status.includes('rejected') ? 'red' : 'blue'}
                              />
                              <span className="text-xs text-gray-500 font-medium">
                                ({totalCerts} lab{totalCerts !== 1 ? 's' : ''})
                              </span>
                            </div>
                            <p className="text-sm text-gray-500 mt-1">
                              {totalCerts} certificate{totalCerts !== 1 ? 's' : ''} • {approvedCerts} approved • {pendingCerts} pending
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4" onClick={(e) => e.stopPropagation()}>
                          <div className="group flex items-start gap-2 p-3 rounded-lg transition-all duration-300 hover:bg-blue-50 hover:scale-105 cursor-pointer">
                            <Building2 className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0 group-hover:text-blue-600 transition-colors" />
                            <div className="min-w-0">
                              <p className="text-xs text-gray-500 group-hover:text-blue-600 transition-colors">Mining Company</p>
                              <p className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-700">
                                {batch.mining_company_name}
                              </p>
                            </div>
                          </div>

                          <div className="group flex items-start gap-2 p-3 rounded-lg transition-all duration-300 hover:bg-emerald-50 hover:scale-105 cursor-pointer">
                            <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0 group-hover:text-emerald-600 transition-colors" />
                            <div className="min-w-0">
                              <p className="text-xs text-gray-500 group-hover:text-emerald-600 transition-colors">Country</p>
                              <p className="text-sm font-medium text-gray-900 truncate group-hover:text-emerald-700">
                                {batch.mining_company_country}
                              </p>
                            </div>
                          </div>

                          <div className="group flex items-start gap-2 p-3 rounded-lg transition-all duration-300 hover:bg-amber-50 hover:scale-105 cursor-pointer">
                            <Scale className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0 group-hover:text-amber-600 transition-colors" />
                            <div className="min-w-0">
                              <p className="text-xs text-gray-500 group-hover:text-amber-600 transition-colors">Weight</p>
                              <p className="text-sm font-medium text-gray-900 group-hover:text-amber-700">
                                {batch.weight_grams.toLocaleString()} g
                              </p>
                            </div>
                          </div>

                          <div className="group flex items-start gap-2 p-3 rounded-lg transition-all duration-300 hover:bg-purple-50 hover:scale-105 cursor-pointer">
                            <Calendar className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0 group-hover:text-purple-600 transition-colors" />
                            <div className="min-w-0">
                              <p className="text-xs text-gray-500 group-hover:text-purple-600 transition-colors">Created</p>
                              <p className="text-sm font-medium text-gray-900 group-hover:text-purple-700">
                                {new Date(batch.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </div>

                        {labs.length > 0 && (
                          <div className="mt-4 pt-3 border-t border-gray-200">
                            <div className="flex items-center gap-3 text-sm">
                              <FlaskConical className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                              <span className="text-gray-500">Laboratory:</span>
                              <span className="font-medium text-emerald-700">
                                {labs[0]}
                              </span>
                              <span className="text-gray-300">•</span>
                              <span className="text-gray-500">{batch.mining_company_country}</span>
                              {certNumbers.length > 0 && (
                                <>
                                  <span className="text-gray-300">•</span>
                                  <span className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-medium">
                                    {certNumbers[0]}
                                    {certNumbers.length > 1 && ` +${certNumbers.length - 1}`}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleBatchExpansion(batch.id);
                        }}
                        className="ml-4"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="h-4 w-4 mr-1" />
                            Collapse
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-4 w-4 mr-1" />
                            Expand
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="p-5 bg-gray-50">
                      <div className="space-y-3">
                        {batch.certificates.map((certificate, certIndex) => {
                          const parsedData = certificate.parsed_data;

                          // Alternating background colors for certificates
                          const certBgColor = certIndex % 2 === 0 ? 'bg-emerald-50/40' : 'bg-amber-50/40';
                          const certHoverBg = certIndex % 2 === 0
                            ? 'hover:bg-gradient-to-r hover:from-emerald-100 hover:to-teal-100'
                            : 'hover:bg-gradient-to-r hover:from-amber-100 hover:to-orange-100';

                          return (
                            <div
                              key={certificate.id}
                              className={`group border-2 rounded-lg p-4 transition-all duration-300 ${certBgColor} ${certHoverBg} hover:border-blue-400 hover:shadow-md hover:scale-[1.02] cursor-pointer`}
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-3">
                                    <FileText className="h-5 w-5 text-blue-600 flex-shrink-0 group-hover:scale-110 transition-transform" />
                                    <p className="font-medium text-gray-900 text-sm group-hover:text-blue-700 transition-colors">
                                      {parsedData?.laboratory_name
                                        ? parsedData.laboratory_name.substring(0, 100) + (parsedData.laboratory_name.length > 100 ? '...' : '')
                                        : 'Laboratory N/A'}
                                    </p>
                                    {certificate.certificate_date && (
                                      <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded font-medium flex-shrink-0">
                                        {new Date(certificate.certificate_date).toLocaleDateString('fr-FR')}
                                      </span>
                                    )}
                                  </div>

                                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                    <div className="p-2 rounded-lg transition-all duration-300 hover:bg-white hover:scale-105">
                                      <p className="text-xs text-gray-500 mb-1">Created Date</p>
                                      <p className="text-sm font-medium text-gray-900">
                                        {new Date(certificate.created_at).toLocaleDateString()}
                                      </p>
                                    </div>

                                    {parsedData?.gold_content_gpt && (
                                      <div className="p-2 rounded-lg transition-all duration-300 hover:bg-yellow-100 hover:scale-105">
                                        <p className="text-xs text-gray-500 mb-1">Au g/t</p>
                                        <p className="text-sm font-semibold text-yellow-700">
                                          {parsedData.gold_content_gpt}
                                        </p>
                                      </div>
                                    )}

                                    {parsedData?.gold_purity_percentage && (
                                      <div className="p-2 rounded-lg transition-all duration-300 hover:bg-amber-100 hover:scale-105">
                                        <p className="text-xs text-gray-500 mb-1">Purity</p>
                                        <p className="text-sm font-semibold text-yellow-700">
                                          {parsedData.gold_purity_percentage}%
                                        </p>
                                      </div>
                                    )}

                                    {parsedData?.metal_retained_percentage && (
                                      <div className="p-2 rounded-lg transition-all duration-300 hover:bg-blue-100 hover:scale-105">
                                        <p className="text-xs text-gray-500 mb-1">Metal Retained</p>
                                        <p className="text-sm font-semibold text-blue-700">
                                          {parsedData.metal_retained_percentage}%
                                        </p>
                                      </div>
                                    )}

                                    {parsedData?.sample_weight_grams && (
                                      <div className="p-2 rounded-lg transition-all duration-300 hover:bg-emerald-100 hover:scale-105">
                                        <p className="text-xs text-gray-500 mb-1">Gold Quantity</p>
                                        <p className="text-sm font-medium text-gray-900">
                                          {parsedData.sample_weight_grams} g
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="flex items-start gap-2 flex-shrink-0">
                                  <StatusBadge
                                    status={certificate.approval_status}
                                    label={certificate.approval_status}
                                    color={getApprovalStatusColor(certificate.approval_status)}
                                  />
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => setSelectedCertificate(certificate)}
                                    title="View details"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>

                              {certificate.parsing_error && (
                                <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                                  <p className="font-medium">Error: {certificate.parsing_error}</p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </div>
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
            onClose={() => setSelectedCertificate(null)}
            onApprove={() => {
              loadCertificatesByBatch();
            }}
            onReject={() => {
              loadCertificatesByBatch();
            }}
            onDataUpdate={() => {
              loadCertificatesByBatch();
            }}
          />
        </Modal>
      )}
    </MainLayout>
  );
}
