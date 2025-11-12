import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Eye, CheckCircle, XCircle, Search, MapPin, Calendar, Scale, ChevronDown, ChevronUp, Building2, Ship, Package, Upload, Plus } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { StatusBadge } from '@/components/dashboard/StatusBadge';
import { Loading } from '@/components/ui/Loading';
import { Modal } from '@/components/ui/Modal';
import { AssayCertificateViewer } from '@/components/batch/AssayCertificateViewer';
import { AssayCertificateUploadForShipping } from '@/components/shipping/AssayCertificateUploadForShipping';
import { useAlert } from '@/hooks/useAlert';
import { supabase } from '@/lib/supabase';
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
  const [uploadingForShipping, setUploadingForShipping] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterApproval, setFilterApproval] = useState<string>('all');
  const [expandedShippings, setExpandedShippings] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadCertificatesByShipping();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [shippingGroups, searchTerm, filterStatus, filterApproval]);

  const loadCertificatesByShipping = async () => {
    setLoading(true);
    try {
      // Load all shipping preparations with their certificates
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

      // Load all certificates
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

      // Group certificates by shipping
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
      alert.error('Erreur lors du chargement des certificats: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...shippingGroups];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (group) =>
          group.expedition_lot_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
          group.mining_company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          group.shipped_to_company.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter((group) => group.status === filterStatus);
    }

    // Approval filter
    if (filterApproval !== 'all') {
      filtered = filtered.filter((group) =>
        group.certificates.some((cert) => cert.approval_status === filterApproval)
      );
    }

    setFilteredGroups(filtered);
  };

  const toggleShipping = (shippingId: string) => {
    const newExpanded = new Set(expandedShippings);
    if (newExpanded.has(shippingId)) {
      newExpanded.delete(shippingId);
    } else {
      newExpanded.add(shippingId);
    }
    setExpandedShippings(newExpanded);
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

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-screen">
          <Loading size="large" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                <div className="p-3 bg-blue-100 rounded-xl">
                  <FileText className="w-8 h-8 text-blue-600" />
                </div>
                Assay Certificates
              </h1>
              <p className="text-gray-600 mt-2">
                Gestion des certificats d'assay par expédition
              </p>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="p-6 border-l-4 border-blue-500 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Total Expéditions</p>
                <p className="text-3xl font-bold text-gray-900">{shippingGroups.length}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-xl">
                <Ship className="w-8 h-8 text-blue-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6 border-l-4 border-gray-500 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Total Certificats</p>
                <p className="text-3xl font-bold text-gray-900">{getTotalCertificates()}</p>
              </div>
              <div className="p-3 bg-gray-100 rounded-xl">
                <FileText className="w-8 h-8 text-gray-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6 border-l-4 border-orange-500 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">En Attente</p>
                <p className="text-3xl font-bold text-orange-600">{getPendingCertificates()}</p>
              </div>
              <div className="p-3 bg-orange-100 rounded-xl">
                <XCircle className="w-8 h-8 text-orange-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6 border-l-4 border-green-500 hover:shadow-lg transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Approuvés</p>
                <p className="text-3xl font-bold text-green-600">{getApprovedCertificates()}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-xl">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
            </div>
          </Card>
        </div>

        {/* Filters */}
        <Card className="p-6 mb-6 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Search className="w-4 h-4 inline mr-1" />
                Recherche
              </label>
              <Input
                type="text"
                placeholder="Numéro d'expédition, compagnie..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Statut Expédition
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Tous</option>
                <option value="draft">Brouillon</option>
                <option value="prepared">Préparée</option>
                <option value="shipped">Expédiée</option>
                <option value="delivered">Livrée</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Statut Approbation
              </label>
              <select
                value={filterApproval}
                onChange={(e) => setFilterApproval(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Tous</option>
                <option value="pending">En attente</option>
                <option value="approved">Approuvé</option>
                <option value="rejected">Rejeté</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Shipping Groups */}
        <div className="space-y-4">
          {filteredGroups.length === 0 ? (
            <Card className="p-12 text-center">
              <FileText className="w-16 h-16 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 text-lg">Aucune expédition trouvée</p>
              <p className="text-gray-500 text-sm mt-2">
                Les certificats d'assay apparaîtront ici une fois uploadés pour les expéditions
              </p>
            </Card>
          ) : (
            filteredGroups.map((group) => (
              <Card key={group.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                {/* Shipping Header */}
                <div
                  className="p-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200 cursor-pointer hover:from-gray-100 hover:to-gray-150 transition-colors"
                  onClick={() => toggleShipping(group.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-white rounded-lg shadow-sm">
                          <Ship className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-gray-900">
                            {group.expedition_lot_number}
                          </h3>
                          <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                            <span className="flex items-center gap-1">
                              <Building2 className="w-4 h-4" />
                              {group.mining_company_name} ({group.mining_company_country})
                            </span>
                            <span className="flex items-center gap-1">
                              <Package className="w-4 h-4" />
                              {group.total_net_weight_grams.toFixed(2)}g
                            </span>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              {new Date(group.created_at).toLocaleDateString('fr-FR')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <StatusBadge status={group.status} />
                      <div className="text-center px-4">
                        <p className="text-2xl font-bold text-gray-900">
                          {group.certificates.length}
                        </p>
                        <p className="text-xs text-gray-600">
                          {group.certificates.length === 1 ? 'Certificat' : 'Certificats'}
                        </p>
                      </div>
                      <Button variant="ghost" size="sm">
                        {expandedShippings.has(group.id) ? (
                          <ChevronUp className="w-5 h-5" />
                        ) : (
                          <ChevronDown className="w-5 h-5" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Certificates List */}
                {expandedShippings.has(group.id) && (
                  <div className="p-6 bg-white">
                    {group.certificates.length === 0 ? (
                      <div className="text-center py-12 text-gray-500">
                        <div className="p-4 bg-gray-50 rounded-full w-20 h-20 mx-auto mb-4 flex items-center justify-center">
                          <FileText className="w-10 h-10 text-gray-400" />
                        </div>
                        <p className="text-lg font-medium text-gray-700 mb-2">
                          Aucun certificat uploadé
                        </p>
                        <p className="text-sm text-gray-500 mb-6">
                          Uploadez le premier certificat d'assay pour cette expédition
                        </p>
                        <Button
                          variant="primary"
                          size="md"
                          onClick={() => setUploadingForShipping(group.id)}
                          className="gap-2"
                        >
                          <Plus className="w-5 h-5" />
                          Ajouter un certificat
                        </Button>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <p className="text-sm font-medium text-gray-700">
                            {group.certificates.length} certificat(s) uploadé(s)
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setUploadingForShipping(group.id)}
                            className="gap-2"
                          >
                            <Plus className="w-4 h-4" />
                            Ajouter un certificat
                          </Button>
                        </div>
                        <div className="space-y-3">
                          {group.certificates.map((cert) => (
                            <div
                              key={cert.id}
                              className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-md transition-all"
                            >
                              <div className="flex-1">
                                <div className="flex items-center gap-3">
                                  <div className="p-2 bg-white rounded-lg">
                                    <FileText className="w-5 h-5 text-gray-600" />
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-3 mb-1">
                                      <p className="font-medium text-gray-900">
                                        {cert.parsed_data?.laboratory_name
                                          ? cert.parsed_data.laboratory_name.substring(0, 100) + (cert.parsed_data.laboratory_name.length > 100 ? '...' : '')
                                          : 'Laboratory N/A'}
                                      </p>
                                      {cert.approval_status === 'pending' && (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 border border-orange-200">
                                          Waiting for approval
                                        </span>
                                      )}
                                      {cert.approval_status === 'approved' && (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                                          <CheckCircle className="w-3 h-3 mr-1" />
                                          Approved
                                        </span>
                                      )}
                                      {cert.approval_status === 'rejected' && (
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
                                          <XCircle className="w-3 h-3 mr-1" />
                                          Rejected
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-4 text-sm text-gray-600">
                                      {cert.parsed_data?.sample_weight_g && (
                                        <span className="flex items-center gap-1">
                                          <Scale className="w-3.5 h-3.5" />
                                          {cert.parsed_data.sample_weight_g.toFixed(2)}g
                                        </span>
                                      )}
                                      {cert.parsed_data?.gold_purity_percentage && (
                                        <span className="flex items-center gap-1">
                                          Au: {cert.parsed_data.gold_purity_percentage.toFixed(2)}%
                                        </span>
                                      )}
                                      {cert.certificate_date && (
                                        <span className="flex items-center gap-1">
                                          <Calendar className="w-3.5 h-3.5" />
                                          {new Date(cert.certificate_date).toLocaleDateString('fr-FR')}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setSelectedCertificate(cert)}
                                  className="gap-2"
                                >
                                  <Eye className="w-4 h-4" />
                                  Voir
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Certificate Viewer Modal */}
      {selectedCertificate && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedCertificate(null)}
          title="Détails du Certificat"
          size="xl"
        >
          <AssayCertificateViewer
            certificate={selectedCertificate}
            onClose={() => setSelectedCertificate(null)}
            onDataUpdate={loadCertificatesByShipping}
            onApprove={loadCertificatesByShipping}
            onReject={loadCertificatesByShipping}
          />
        </Modal>
      )}

      {/* Upload Modal */}
      {uploadingForShipping && (
        <Modal
          isOpen={true}
          onClose={() => setUploadingForShipping(null)}
          title="Ajouter un Certificat d'Assay"
          size="lg"
        >
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
                alert.success('Certificat uploadé avec succès');
              }}
            />
          </div>
        </Modal>
      )}
    </MainLayout>
  );
}
