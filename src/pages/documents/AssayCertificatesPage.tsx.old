import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText, Eye, CheckCircle, XCircle, Search, MapPin, Calendar, Scale,
  Building2, Ship, Package, Upload, Plus, Download, ChevronRight
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { Loading } from '@/components/ui/Loading';
import { PDFViewer } from '@/components/ui/PDFViewer';
import { AssayCertificateViewer } from '@/components/batch/AssayCertificateViewer';
import { AssayCertificateUploadForShipping } from '@/components/shipping/AssayCertificateUploadForShipping';
import { useAlert } from '@/hooks/useAlert';
import { supabase } from '@/lib/supabase';
import { getCertificateSignedUrl } from '@/services/assayCertificateService';
import type { AssayCertificate } from '@/services/assayCertificateService';

interface ShippingWithCertificates {
  id: string;
  expedition_lot_number: string;
  status: string;
  total_net_weight_grams: number;
  mining_company_name: string;
  mining_company_country: string;
  shipped_to_company: string;
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

  const [shippingGroups, setShippingGroups] = useState<ShippingWithCertificates[]>([]);
  const [filteredGroups, setFilteredGroups] = useState<ShippingWithCertificates[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCertificate, setSelectedCertificate] = useState<AssayCertificate | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [uploadingForShipping, setUploadingForShipping] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterApproval, setFilterApproval] = useState<string>('all');
  const [showCertificateViewer, setShowCertificateViewer] = useState(false);

  useEffect(() => {
    loadCertificatesByShipping();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [shippingGroups, searchTerm, filterStatus, filterApproval]);

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

  const loadCertificatesByShipping = async () => {
    setLoading(true);
    try {
      const { data: shippingsData, error: shippingsError } = await supabase
        .from('shipping_preparations')
        .select(`
          *,
          mining_company:mining_companies (
            name,
            country
          )
        `)
        .order('created_at', { ascending: false });

      if (shippingsError) throw shippingsError;

      const { data: certificatesData, error: certsError } = await supabase
        .from('assay_certificates')
        .select(`
          *,
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

      const grouped = shippingsData?.map((shipping: any) => {
        const shippingCerts = certificatesData?.filter(
          (cert: any) => cert.shipping_preparation_id === shipping.id
        ) || [];

        return {
          id: shipping.id,
          expedition_lot_number: shipping.expedition_lot_number || 'N/A',
          status: shipping.status,
          total_net_weight_grams: shipping.total_net_weight_grams || 0,
          mining_company_name: shipping.mining_company?.name || 'N/A',
          mining_company_country: shipping.mining_company?.country || 'N/A',
          shipped_to_company: shipping.shipped_to_company || 'N/A',
          created_at: shipping.created_at,
          certificates: shippingCerts.map((cert: any) => ({
            ...cert,
            parsed_data: cert.parsed_data?.[0] || null,
          })),
        };
      }) || [];

      setShippingGroups(grouped);
      setFilteredGroups(grouped);
    } catch (error: any) {
      console.error('Error loading certificates:', error);
      alert.showAlert('Erreur lors du chargement des certificats: ' + error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...shippingGroups];

    if (searchTerm) {
      filtered = filtered.filter(
        (group) =>
          group.expedition_lot_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
          group.mining_company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          group.shipped_to_company.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter((group) => group.status === filterStatus);
    }

    if (filterApproval !== 'all') {
      filtered = filtered.filter((group) =>
        group.certificates.some((cert) => cert.approval_status === filterApproval)
      );
    }

    setFilteredGroups(filtered);
  };

  const getTotalCertificates = () => {
    return shippingGroups.reduce((sum, group) => sum + group.certificates.length, 0);
  };

  const getPendingCertificates = () => {
    return shippingGroups.reduce(
      (sum, group) =>
        sum + group.certificates.filter((c) => c.approval_status === 'pending').length,
      0
    );
  };

  const getApprovedCertificates = () => {
    return shippingGroups.reduce(
      (sum, group) =>
        sum + group.certificates.filter((c) => c.approval_status === 'approved').length,
      0
    );
  };

  const getApprovalStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'green';
      case 'rejected': return 'red';
      default: return 'gray';
    }
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
        {/* Compact Header */}
        <div className="flex-shrink-0 pb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Assay Certificates</h1>
                <p className="text-xs text-gray-500 mt-0.5">
                  {shippingGroups.length} expéditions • {getTotalCertificates()} certificats
                </p>
              </div>
            </div>
          </div>

          {/* Compact Stats */}
          <div className="grid grid-cols-4 gap-2 mb-4">
            <Card className="p-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">Expéditions</p>
                  <p className="text-lg font-bold text-gray-900">{shippingGroups.length}</p>
                </div>
                <Ship className="h-5 w-5 text-blue-400" />
              </div>
            </Card>

            <Card className="p-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">Total</p>
                  <p className="text-lg font-bold text-gray-900">{getTotalCertificates()}</p>
                </div>
                <FileText className="h-5 w-5 text-gray-400" />
              </div>
            </Card>

            <Card className="p-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">En Attente</p>
                  <p className="text-lg font-bold text-orange-600">{getPendingCertificates()}</p>
                </div>
                <XCircle className="h-5 w-5 text-orange-400" />
              </div>
            </Card>

            <Card className="p-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">Approuvés</p>
                  <p className="text-lg font-bold text-green-600">{getApprovedCertificates()}</p>
                </div>
                <CheckCircle className="h-5 w-5 text-green-400" />
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
                    placeholder="Recherche..."
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
                  <option value="all">Tous Statuts</option>
                  <option value="draft">Brouillon</option>
                  <option value="prepared">Préparée</option>
                  <option value="shipped">Expédiée</option>
                  <option value="delivered">Livrée</option>
                </select>
              </div>

              <div>
                <select
                  value={filterApproval}
                  onChange={(e) => setFilterApproval(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Toutes Approbations</option>
                  <option value="pending">En attente</option>
                  <option value="approved">Approuvé</option>
                  <option value="rejected">Rejeté</option>
                </select>
              </div>
            </div>
          </Card>
        </div>

        {/* 2 Panel Layout */}
        <div className="flex-1 flex gap-4 min-h-0">
          {/* Left Panel - Expeditions & Certificates List */}
          <div className="w-1/2 overflow-y-auto pr-2">
            {filteredGroups.length === 0 ? (
              <Card className="p-8">
                <div className="text-center">
                  <Ship className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                  <p className="text-sm text-gray-500 font-medium">Aucune expédition trouvée</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Les certificats apparaîtront après leur upload
                  </p>
                </div>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredGroups.map((group) => (
                  <Card key={group.id} className="overflow-hidden hover:shadow-md transition-shadow">
                    {/* Shipping Header - Compact */}
                    <div className="bg-gradient-to-r from-slate-50 to-gray-50 p-3 border-b border-gray-200">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Ship className="h-4 w-4 text-blue-600" />
                          <h3 className="text-sm font-bold text-gray-900">
                            {group.expedition_lot_number}
                          </h3>
                          <span className="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded font-medium">
                            {group.certificates.length}
                          </span>
                        </div>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setUploadingForShipping(group.id)}
                          className="h-6 px-2 text-xs"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Ajouter
                        </Button>
                      </div>

                      {/* Compact Shipping Info */}
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="flex items-center gap-1">
                          <Building2 className="h-3 w-3 text-gray-400" />
                          <span className="text-gray-600 truncate">
                            {group.mining_company_name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-gray-400" />
                          <span className="text-gray-600">
                            {group.mining_company_country}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Scale className="h-3 w-3 text-gray-400" />
                          <span className="text-gray-600">
                            {group.total_net_weight_grams.toFixed(0)}g
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Certificate Sub-tiles */}
                    <div className="p-2 bg-white space-y-1.5">
                      {group.certificates.length === 0 ? (
                        <div className="text-center py-6">
                          <FileText className="h-8 w-8 mx-auto text-gray-300 mb-2" />
                          <p className="text-xs text-gray-500">Aucun certificat</p>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setUploadingForShipping(group.id)}
                            className="mt-2 h-7 px-2 text-xs"
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Ajouter le premier
                          </Button>
                        </div>
                      ) : (
                        group.certificates.map((certificate) => {
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
                                  {/* Certificate Name */}
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
                        })
                      )}
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
                          Détails
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
                          <p className="text-sm text-gray-500">Impossible de charger le PDF</p>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="h-full flex items-center justify-center bg-gray-50">
                  <div className="text-center">
                    <FileText className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                    <p className="text-sm text-gray-500 font-medium">Aucun certificat sélectionné</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Sélectionnez un certificat pour voir son PDF
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
                loadCertificatesByShipping();
                setShowCertificateViewer(false);
              }}
              onReject={() => {
                loadCertificatesByShipping();
                setShowCertificateViewer(false);
              }}
              onDataUpdate={() => {
                loadCertificatesByShipping();
              }}
            />
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {uploadingForShipping && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-white rounded-lg shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">Ajouter un Certificat</h3>
                <button
                  onClick={() => setUploadingForShipping(null)}
                  className="p-1 hover:bg-gray-200 rounded transition-colors"
                >
                  <XCircle className="h-5 w-5 text-gray-500" />
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="mb-6">
                <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
                  <Upload className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Expédition: {shippingGroups.find(g => g.id === uploadingForShipping)?.expedition_lot_number}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      Uploadez un fichier PDF du certificat d'assay
                    </p>
                  </div>
                </div>
              </div>
              <AssayCertificateUploadForShipping
                shippingPreparationId={uploadingForShipping}
                onUploadComplete={() => {
                  setUploadingForShipping(null);
                  loadCertificatesByShipping();
                  alert.showAlert('Certificat uploadé avec succès', 'success');
                }}
              />
            </div>
          </div>
        </div>
      )}
    </MainLayout>
  );
}
