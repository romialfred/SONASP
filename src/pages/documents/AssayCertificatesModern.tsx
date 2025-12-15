import { useState, useEffect } from 'react';
import {
  FileText, Eye, CheckCircle, XCircle, X, Search, MapPin, Calendar, Scale,
  Building2, Ship, Package, Upload, Plus, Download, Filter, Loader
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Loading } from '@/components/ui/Loading';
import { PDFViewer } from '@/components/ui/PDFViewer';
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
  mining_company_id: string;
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

interface MiningCompanyTab {
  id: string;
  name: string;
  country: string;
  expeditionCount: number;
  certificateCount: number;
}

export function AssayCertificatesModern() {
  const alert = useAlert();

  const [shippingGroups, setShippingGroups] = useState<ShippingWithCertificates[]>([]);
  const [miningCompanyTabs, setMiningCompanyTabs] = useState<MiningCompanyTab[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCertificate, setSelectedCertificate] = useState<AssayCertificate | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [uploadingForShipping, setUploadingForShipping] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPdfModal, setShowPdfModal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedCertificate && showPdfModal) {
      loadPdfUrl(selectedCertificate);
    } else {
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
      }
      setPdfUrl(null);
      setPdfBlobUrl(null);
    }
  }, [selectedCertificate, showPdfModal]);

  const loadPdfUrl = async (certificate: AssayCertificate) => {
    setLoadingPdf(true);
    try {
      const result = await getCertificateSignedUrl(certificate.file_path);
      if (result.success && result.url) {
        setPdfUrl(result.url);

        const response = await fetch(result.url);
        if (!response.ok) throw new Error('Failed to fetch PDF');

        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        setPdfBlobUrl(blobUrl);
      } else {
        alert.showAlert('Impossible de charger le PDF', 'error');
        setPdfUrl(null);
        setPdfBlobUrl(null);
      }
    } catch (error: any) {
      console.error('Error loading PDF:', error);
      alert.showAlert('Erreur lors du chargement du PDF', 'error');
      setPdfUrl(null);
      setPdfBlobUrl(null);
    } finally {
      setLoadingPdf(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: shippingsData, error: shippingsError } = await supabase
        .from('shipping_preparations')
        .select(`
          *,
          mining_company:mining_companies (
            id,
            name,
            country
          )
        `)
        .order('created_at', { ascending: false });

      if (shippingsError) throw shippingsError;

      const { data: certificatesData, error: certsError } = await supabase
        .from('assay_certificates')
        .select('*')
        .order('created_at', { ascending: false });

      if (certsError) throw certsError;

      const { data: parsedData } = await supabase
        .from('assay_certificate_data')
        .select('*');

      const certificatesWithParsedData = certificatesData?.map((cert: any) => {
        const parsed = parsedData?.find((p: any) => p.certificate_id === cert.id);
        return { ...cert, parsed_data: parsed || null };
      }) || [];

      const grouped = shippingsData?.map((shipping: any) => {
        const shippingCerts = certificatesWithParsedData?.filter(
          (cert: any) => cert.shipping_preparation_id === shipping.id
        ) || [];

        return {
          id: shipping.id,
          expedition_lot_number: shipping.expedition_lot_number || 'Sans numéro',
          status: shipping.status,
          total_net_weight_grams: shipping.total_net_weight_grams || 0,
          mining_company_id: shipping.mining_company?.id || '',
          mining_company_name: shipping.mining_company?.name || 'Non spécifiée',
          mining_company_country: shipping.mining_company?.country || '',
          shipped_to_company: shipping.shipped_to_company || 'Non spécifié',
          created_at: shipping.created_at,
          certificates: shippingCerts,
        };
      }) || [];

      setShippingGroups(grouped);

      // Create mining company tabs
      const companyMap = new Map<string, MiningCompanyTab>();

      grouped.forEach(shipping => {
        if (!companyMap.has(shipping.mining_company_id)) {
          companyMap.set(shipping.mining_company_id, {
            id: shipping.mining_company_id,
            name: shipping.mining_company_name,
            country: shipping.mining_company_country,
            expeditionCount: 0,
            certificateCount: 0,
          });
        }

        const company = companyMap.get(shipping.mining_company_id)!;
        company.expeditionCount++;
        company.certificateCount += shipping.certificates.length;
      });

      const tabs = Array.from(companyMap.values()).sort((a, b) =>
        b.expeditionCount - a.expeditionCount
      );

      setMiningCompanyTabs(tabs);

      if (tabs.length > 0 && !activeTab) {
        setActiveTab(tabs[0].id);
      }
    } catch (error: any) {
      console.error('Error loading data:', error);
      alert.showAlert('Erreur lors du chargement des données', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getFilteredShippings = () => {
    let filtered = shippingGroups.filter(s => s.mining_company_id === activeTab);

    if (searchTerm) {
      filtered = filtered.filter(s =>
        s.expedition_lot_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.shipped_to_company.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  };

  const getTotalStats = () => {
    return {
      expeditions: shippingGroups.length,
      total: shippingGroups.reduce((sum, s) => sum + s.certificates.length, 0),
      pending: shippingGroups.reduce((sum, s) =>
        sum + s.certificates.filter(c => c.approval_status === 'pending').length, 0
      ),
      approved: shippingGroups.reduce((sum, s) =>
        sum + s.certificates.filter(c => c.approval_status === 'approved').length, 0
      ),
    };
  };

  const getApprovalStatusBadge = (status: string) => {
    const config = {
      approved: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Approuvé' },
      rejected: { bg: 'bg-red-100', text: 'text-red-700', label: 'Rejeté' },
      pending: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'En Attente' },
    };

    const { bg, text, label } = config[status as keyof typeof config] || config.pending;

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${bg} ${text}`}>
        {label}
      </span>
    );
  };

  if (loading) {
    return (
      <MainLayout>
        <Loading />
      </MainLayout>
    );
  }

  const stats = getTotalStats();
  const filteredShippings = getFilteredShippings();
  const activeCompany = miningCompanyTabs.find(t => t.id === activeTab);

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        {/* Modern Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-slate-700">Assay Certificates</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Gestion des certificats d'analyse par compagnie minière
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4">
          <Card className="p-4 bg-gradient-to-br from-slate-50 to-slate-100 border-l-4 border-slate-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500 font-medium">Expéditions</p>
                <p className="text-2xl font-bold text-slate-700 mt-1">{stats.expeditions}</p>
              </div>
              <Ship className="h-8 w-8 text-slate-400" />
            </div>
          </Card>

          <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 border-l-4 border-blue-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-600 font-medium">Total Certificats</p>
                <p className="text-2xl font-bold text-blue-700 mt-1">{stats.total}</p>
              </div>
              <FileText className="h-8 w-8 text-blue-400" />
            </div>
          </Card>

          <Card className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 border-l-4 border-orange-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-orange-600 font-medium">En Attente</p>
                <p className="text-2xl font-bold text-orange-700 mt-1">{stats.pending}</p>
              </div>
              <XCircle className="h-8 w-8 text-orange-400" />
            </div>
          </Card>

          <Card className="p-4 bg-gradient-to-br from-emerald-50 to-emerald-100 border-l-4 border-emerald-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-emerald-600 font-medium">Approuvés</p>
                <p className="text-2xl font-bold text-emerald-700 mt-1">{stats.approved}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-emerald-400" />
            </div>
          </Card>
        </div>

        {/* Mining Company Tabs */}
        <div className="border-b border-gray-200">
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {miningCompanyTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 px-4 py-2.5 rounded-t-lg border-b-2 transition-all whitespace-nowrap
                  ${activeTab === tab.id
                    ? 'border-[#B8860B] bg-[#B8860B]/10 text-[#B8860B] font-semibold'
                    : 'border-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }
                `}
              >
                <Building2 className="w-4 h-4" />
                <div className="flex flex-col items-start">
                  <span className="text-sm">{tab.name}</span>
                  <span className="text-xs opacity-75">
                    {tab.expeditionCount} exp • {tab.certificateCount} cert
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Search Bar */}
        {activeTab && (
          <Card className="p-3">
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  placeholder="Rechercher une expédition..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              {activeCompany && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <MapPin className="w-4 h-4" />
                  <span>{activeCompany.country}</span>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Expedition Tiles Grid */}
        {activeTab && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredShippings.length === 0 ? (
              <Card className="col-span-full p-12">
                <div className="text-center">
                  <Ship className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-500 font-medium">Aucune expédition trouvée</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Essayez de modifier votre recherche
                  </p>
                </div>
              </Card>
            ) : (
              filteredShippings.map((shipping, idx) => {
                // Gradient colors for tiles
                const tileColors = [
                  'from-blue-50 to-blue-100 border-l-4 border-blue-500',
                  'from-emerald-50 to-emerald-100 border-l-4 border-emerald-500',
                  'from-amber-50 to-amber-100 border-l-4 border-amber-500',
                  'from-purple-50 to-purple-100 border-l-4 border-purple-500',
                  'from-rose-50 to-rose-100 border-l-4 border-rose-500',
                  'from-cyan-50 to-cyan-100 border-l-4 border-cyan-500',
                ];
                const tileColor = tileColors[idx % tileColors.length];

                // Border animation colors based on approval status
                const hasApproved = shipping.certificates.some(c => c.approval_status === 'approved');
                const hasPending = shipping.certificates.some(c => c.approval_status === 'pending');
                const borderAnimationColor = hasApproved ? 'hover:shadow-emerald-400/50' : 'hover:shadow-red-400/50';

                return (
                  <Card
                    key={shipping.id}
                    className={`group bg-gradient-to-br ${tileColor} hover:shadow-xl transition-all duration-300 relative overflow-hidden ${borderAnimationColor}`}
                    style={{
                      boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                    }}
                    onMouseEnter={(e) => {
                      const color = hasApproved ? 'rgba(16, 185, 129, 0.6)' : 'rgba(239, 68, 68, 0.6)';
                      e.currentTarget.style.boxShadow = `0 0 0 3px ${color}, 0 10px 30px rgba(0,0,0,0.15)`;
                      e.currentTarget.style.transform = 'translateY(-2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.12)';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }}
                  >
                    <div className="p-4">
                      {/* Expedition Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="p-1.5 bg-white/70 rounded-lg">
                              <Ship className="w-4 h-4 text-slate-700" />
                            </div>
                            <h3 className="font-bold text-slate-900 text-base">
                              {shipping.expedition_lot_number}
                            </h3>
                          </div>
                          <div className="space-y-1.5 text-xs text-slate-700">
                            <div className="flex items-center gap-2 bg-white/50 rounded px-2 py-1">
                              <Package className="w-3.5 h-3.5 text-slate-600" />
                              <span className="font-medium">{shipping.shipped_to_company}</span>
                            </div>
                            <div className="flex items-center gap-2 bg-white/50 rounded px-2 py-1">
                              <Scale className="w-3.5 h-3.5 text-slate-600" />
                              <span className="font-medium">{(shipping.total_net_weight_grams / 1000).toFixed(2)} kg</span>
                            </div>
                            <div className="flex items-center gap-2 bg-white/50 rounded px-2 py-1">
                              <Calendar className="w-3.5 h-3.5 text-slate-600" />
                              <span className="font-medium">
                                {new Date(shipping.created_at).toLocaleDateString('fr-FR', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric'
                                })}
                              </span>
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setUploadingForShipping(shipping.id)}
                          className="h-8 w-8 p-0 bg-white/70 hover:bg-white"
                        >
                          <Plus className="w-4 h-4 text-slate-700" />
                        </Button>
                      </div>

                      {/* Certificates List */}
                      <div className="border-t border-white/50 pt-3 space-y-2">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-slate-700 bg-white/60 px-2 py-1 rounded">
                            Certificats ({shipping.certificates.length})
                          </span>
                        </div>

                        {shipping.certificates.length === 0 ? (
                          <div className="text-center py-4 bg-white/60 rounded-lg border-2 border-dashed border-slate-300">
                            <FileText className="h-8 w-8 mx-auto text-slate-400 mb-2" />
                            <p className="text-xs text-slate-600 font-medium">Aucun certificat</p>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setUploadingForShipping(shipping.id)}
                              className="mt-2 text-xs"
                            >
                              Ajouter
                            </Button>
                          </div>
                        ) : (
                          shipping.certificates.map(cert => {
                            const certDate = cert.certificate_date
                              ? new Date(cert.certificate_date).toLocaleDateString('fr-FR', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric'
                                })
                              : 'Date inconnue';

                            return (
                              <div
                                key={cert.id}
                                className="flex items-center justify-between p-2.5 bg-white/80 rounded-lg hover:bg-white transition-all hover:shadow-md group/cert"
                              >
                                <div className="flex-1 min-w-0 mr-2">
                                  <div className="flex items-center gap-2 mb-1.5">
                                    <FileText className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
                                    <p className="text-xs font-semibold text-slate-900 truncate">
                                      {cert.file_name.replace(/^[a-f0-9-]+_/, '').replace(/\.[^.]+$/, '')}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-3 text-xs">
                                    {cert.parsed_data?.gold_content_gpt && (
                                      <div className="flex items-center gap-1 bg-yellow-100 px-2 py-0.5 rounded">
                                        <span className="font-bold text-yellow-800">Au:</span>
                                        <span className="font-bold text-yellow-900">
                                          {cert.parsed_data.gold_content_gpt} g/t
                                        </span>
                                      </div>
                                    )}
                                    {cert.parsed_data?.gold_purity_percentage && (
                                      <div className="flex items-center gap-1 bg-amber-100 px-2 py-0.5 rounded">
                                        <span className="font-semibold text-amber-800">
                                          {cert.parsed_data.gold_purity_percentage}%
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500">
                                    <Calendar className="w-3 h-3" />
                                    <span>{certDate}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {getApprovalStatusBadge(cert.approval_status)}
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedCertificate(cert);
                                      setShowPdfModal(true);
                                    }}
                                    className={`h-8 w-8 p-0 transition-all ${
                                      cert.approval_status === 'approved'
                                        ? 'bg-emerald-500 hover:bg-emerald-600'
                                        : 'bg-blue-500 hover:bg-blue-600'
                                    } text-white shadow-md hover:shadow-lg`}
                                    title="Visualiser le certificat"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* PDF Viewer Modal */}
      {showPdfModal && selectedCertificate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-6xl h-[90vh] bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex-shrink-0 p-4 border-b border-gray-200 bg-gradient-to-r from-slate-50 to-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-bold text-slate-700 truncate">
                    {selectedCertificate.file_name}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    {getApprovalStatusBadge(selectedCertificate.approval_status)}
                    {selectedCertificate.certificate_number && (
                      <span className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded">
                        {selectedCertificate.certificate_number}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {pdfUrl && (
                    <a href={pdfUrl} download target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm">
                        <Download className="w-4 h-4 mr-2" />
                        Télécharger
                      </Button>
                    </a>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowPdfModal(false);
                      setSelectedCertificate(null);
                    }}
                    className="h-9 w-9 p-0"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            </div>

            {/* PDF Content */}
            <div className="flex-1 bg-gray-100 overflow-hidden">
              {loadingPdf ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <Loader className="h-12 w-12 mx-auto text-[#B8860B] animate-spin mb-4" />
                    <p className="text-sm text-gray-600">Chargement du PDF...</p>
                  </div>
                </div>
              ) : pdfBlobUrl ? (
                <PDFViewer url={pdfBlobUrl} />
              ) : (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <XCircle className="h-16 w-16 mx-auto text-red-400 mb-4" />
                    <p className="text-gray-600 font-medium">Impossible de charger le PDF</p>
                    <p className="text-sm text-gray-500 mt-2">
                      Le fichier est peut-être manquant ou corrompu
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {uploadingForShipping && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-white rounded-xl shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-slate-50 to-slate-100">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-slate-700">Ajouter un Certificat</h3>
                <button
                  onClick={() => setUploadingForShipping(null)}
                  className="p-1 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="mb-6">
                <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
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
                  loadData();
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
