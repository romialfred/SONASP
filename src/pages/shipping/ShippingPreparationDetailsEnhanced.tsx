import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Package, ArrowLeft, FileText, Calendar, Building2, Truck,
  User, Clock, MapPin, Weight, Box, Users, FileCheck, Upload,
  Edit, History, RefreshCw
} from 'lucide-react';
import { Tabs } from '@/components/ui/Tabs';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loading } from '@/components/ui/Loading';
import { ErrorDialog } from '@/components/ui/ErrorDialog';
import { NotificationDialog } from '@/components/ui/NotificationDialog';
import { ShippingStatusWorkflowEnhanced } from '@/components/shipping/ShippingStatusWorkflowEnhanced';
import { ShippingStatusHistory, ShippingStatusHistoryEntry } from '@/components/shipping/ShippingStatusHistory';
import { ShippingStatusBadge } from '@/components/shipping/ShippingStatusBadge';
import { DocumentUploadSection } from '@/components/shipping/DocumentUploadSection';
import { AssayCertificateUploadForShipping } from '@/components/shipping/AssayCertificateUploadForShipping';
import { shippingPreparationService, ShippingPreparation, ShippingProductionItem, ShippingSignatory, ShippingDocument } from '@/services/shippingPreparationService';
import { shippingStatusService } from '@/services/shippingStatusService';
import { supabase } from '@/lib/supabase';
import { ShippingStatus } from '@/constants/shippingStatuses';
import { useAuth } from '@/contexts/AuthContext';

interface Refinery {
  id: string;
  name: string;
  location: string;
  country: string;
}

interface TransportCompany {
  id: string;
  name: string;
  address: string | null;
}

interface AssayCertificate {
  id: string;
  shipping_preparation_id: string;
  certificate_number: string | null;
  certificate_date: string | null;
  issuing_laboratory: string | null;
  file_name: string;
  approval_status: string;
  created_at: string;
}

interface ExportLicense {
  id: string;
  license_number: string;
  issue_date: string;
  end_date: string;
  authorized_quantity_grams: number;
  used_quantity_grams: number;
  status: string;
}

interface MiningCompany {
  id: string;
  name: string;
  code: string;
}

const statusLabels: Record<string, string> = {
  waiting_for_customs_approval: 'En Attente Douane',
  approved_by_customs: 'Approuvé par Douane',
  ready_for_expedition: 'Prêt pour Expédition',
  cancelled: 'Annulée'
};

const statusDescriptions: Record<string, string> = {
  waiting_for_customs_approval: 'Expédition créée, en attente d\'approbation douanière (peut durer plusieurs jours)',
  approved_by_customs: 'Approuvé par la douane, prêt pour l\'expédition',
  ready_for_expedition: 'Validé et prêt pour le départ',
  cancelled: 'Expédition annulée'
};

export default function ShippingPreparationDetailsEnhanced() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [preparation, setPreparation] = useState<ShippingPreparation | null>(null);
  const [productionItems, setProductionItems] = useState<ShippingProductionItem[]>([]);
  const [signatories, setSignatories] = useState<ShippingSignatory[]>([]);
  const [documents, setDocuments] = useState<ShippingDocument[]>([]);
  const [certificates, setCertificates] = useState<AssayCertificate[]>([]);
  const [statusHistory, setStatusHistory] = useState<ShippingStatusHistoryEntry[]>([]);
  const [refinery, setRefinery] = useState<Refinery | null>(null);
  const [transportCompany, setTransportCompany] = useState<TransportCompany | null>(null);
  const [license, setLicense] = useState<ExportLicense | null>(null);
  const [miningCompany, setMiningCompany] = useState<MiningCompany | null>(null);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (id) {
      loadPreparationDetails();
    }
  }, [id]);

  const loadPreparationDetails = async () => {
    try {
      setLoading(true);

      const prep = await shippingPreparationService.getPreparationById(id!);

      if (!prep) {
        setErrorMessage('Préparation non trouvée.');
        setShowError(true);
        setLoading(false);
        return;
      }

      setPreparation(prep);

      const [items, sigs, docs] = await Promise.all([
        shippingPreparationService.getProductionItems(id!),
        shippingPreparationService.getSignatories(id!),
        shippingPreparationService.getDocuments(id!),
      ]);

      setProductionItems(items);
      setSignatories(sigs);
      setDocuments(docs);

      // Load certificates
      const { data: certsData } = await supabase
        .from('assay_certificates')
        .select('*')
        .eq('shipping_preparation_id', id!);

      if (certsData) setCertificates(certsData);

      // Load status history
      const historyData = await shippingStatusService.getStatusHistory(id!).catch(() => []);
      setStatusHistory(historyData);

      if (prep.shipped_to_address) {
        const { data: refineryData } = await supabase
          .from('refineries')
          .select('*')
          .eq('id', prep.shipped_to_address)
          .maybeSingle();

        if (refineryData) setRefinery(refineryData);
      }

      if (prep.shipped_to_company) {
        const { data: companyData } = await supabase
          .from('transport_companies')
          .select('*')
          .eq('id', prep.shipped_to_company)
          .maybeSingle();

        if (companyData) setTransportCompany(companyData);
      }

      // Load export license
      if (prep.license_id) {
        const { data: licenseData } = await supabase
          .from('export_licenses')
          .select('*')
          .eq('id', prep.license_id)
          .maybeSingle();

        if (licenseData) setLicense(licenseData);
      }

      // Load mining company
      if (prep.mining_company_id) {
        const { data: companyData } = await supabase
          .from('mining_companies')
          .select('*')
          .eq('id', prep.mining_company_id)
          .maybeSingle();

        if (companyData) setMiningCompany(companyData);
      }

    } catch (error) {
      console.error('Error loading preparation:', error);
      setErrorMessage('Erreur lors du chargement des détails.');
      setShowError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string, notes?: string) => {
    try {
      await shippingPreparationService.updateStatus(id!, newStatus as any, notes);
      setSuccessMessage('Statut mis à jour avec succès');
      setShowSuccess(true);
      await loadPreparationDetails();
    } catch (error) {
      console.error('Error updating status:', error);
      setErrorMessage('Erreur lors du changement de statut');
      setShowError(true);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-screen">
          <Loading size="lg" />
        </div>
      </MainLayout>
    );
  }

  if (!preparation) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <Package className="w-16 h-16 mx-auto mb-4 text-slate-400" />
            <p className="text-slate-600">Préparation non trouvée</p>
            <Button onClick={() => navigate('/shipping/preparation')} className="mt-4">
              Retour
            </Button>
          </div>
        </div>
      </MainLayout>
    );
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatShortDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR');
  };

  return (
    <MainLayout>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-[1800px] mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  onClick={() => navigate('/shipping/preparation')}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Retour
                </Button>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">
                    Expédition {preparation.expedition_lot_number}
                  </h1>
                  <div className="flex items-center gap-2 mt-1">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-600">
                      {formatShortDate(preparation.prepared_at || preparation.created_at)}
                    </span>
                  </div>
                </div>
              </div>
              <Button
                onClick={() => navigate(`/shipping/preparation/${id}/edit`)}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <Edit className="w-4 h-4" />
                Modifier
              </Button>
            </div>
          </div>
        </div>

        <div className="max-w-[1800px] mx-auto px-6 py-6">
          <div className="flex gap-6">
            {/* Main Content */}
            <div className="flex-1">
              {/* Workflow Visual */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                <ShippingStatusWorkflowEnhanced
                  shippingId={preparation.id}
                  currentStatus={preparation.status as ShippingStatus}
                  onStatusChanged={loadPreparationDetails}
                  userEmail={user?.email}
                />
              </div>

              {/* Metrics Tiles - Compact */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                {/* Boxes */}
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-lg border border-amber-200 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Box className="w-4 h-4 text-amber-600" />
                    <span className="text-xs font-semibold text-amber-700 uppercase">Boîtes</span>
                  </div>
                  <p className="text-2xl font-bold text-amber-900">{productionItems.length}</p>
                </div>

                {/* Net Weight */}
                <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-lg border border-emerald-200 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Weight className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-semibold text-emerald-700 uppercase">Poids Net</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <p className="text-2xl font-bold text-emerald-900">{preparation.total_net_weight_grams.toFixed(2)}</p>
                    <span className="text-xs text-emerald-600">g</span>
                  </div>
                </div>

                {/* Gross Weight */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Weight className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-semibold text-blue-700 uppercase">Poids Brut</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <p className="text-2xl font-bold text-blue-900">{preparation.total_gross_weight_grams.toFixed(2)}</p>
                    <span className="text-xs text-blue-600">g</span>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <Tabs
                tabs={[
                  { id: 'overview', label: 'Vue d\'ensemble', icon: <Package className="w-4 h-4" /> },
                  { id: 'productions', label: 'Productions', icon: <Box className="w-4 h-4" /> },
                  { id: 'signatories', label: 'Signataires', icon: <Users className="w-4 h-4" /> },
                  { id: 'documents', label: 'Documents', icon: <FileText className="w-4 h-4" />, badge: documents.length > 0 ? documents.length : undefined },
                  { id: 'certificates', label: 'Certificats', icon: <FileCheck className="w-4 h-4" />, badge: certificates.length > 0 ? certificates.length : undefined }
                ]}
                activeTab={activeTab}
                onChange={setActiveTab}
              />

              <div className="mt-6">
                {/* Overview Tab */}
                {activeTab === 'overview' && (
                  <Card className="p-6">
                    <div className="flex items-center gap-3 mb-6">
                      <FileText className="w-5 h-5 text-blue-600" />
                      <h2 className="text-lg font-bold text-gray-900">Informations d'Expédition</h2>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      {/* Raffinerie */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          RAFFINERIE DE DESTINATION
                        </label>
                        <div className="flex items-start gap-3">
                          <Building2 className="w-5 h-5 text-gray-400 mt-1" />
                          <div>
                            <p className="font-medium text-gray-900">{refinery?.name || 'N/A'}</p>
                            {refinery && (
                              <p className="text-sm text-gray-600 flex items-center gap-1 mt-1">
                                <MapPin className="w-3.5 h-3.5" />
                                {refinery.location}, {refinery.country}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Date */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          DATE DE PRÉPARATION
                        </label>
                        <div className="flex items-center gap-3">
                          <Calendar className="w-5 h-5 text-gray-400" />
                          <p className="font-medium text-gray-900">
                            {formatDate(preparation.prepared_at || preparation.created_at)}
                          </p>
                        </div>
                      </div>

                      {/* Freight Company */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          COMPAGNIE DE FRET
                        </label>
                        <div className="flex items-start gap-3">
                          <Truck className="w-5 h-5 text-gray-400 mt-1" />
                          <div>
                            <p className="font-medium text-gray-900">{transportCompany?.name || 'N/A'}</p>
                            {transportCompany?.address && (
                              <p className="text-sm text-gray-600 mt-1">{transportCompany.address}</p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Seal Number */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          NUMÉRO DE SCELLÉ
                        </label>
                        <div className="flex items-center gap-3">
                          <FileCheck className="w-5 h-5 text-gray-400" />
                          <p className="font-mono font-medium text-gray-900">
                            {preparation.seal_number || 'N/A'}
                          </p>
                        </div>
                      </div>

                      {/* Mining Company */}
                      {miningCompany && (
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            COMPAGNIE MINIÈRE
                          </label>
                          <div className="flex items-center gap-3">
                            <Building2 className="w-5 h-5 text-gray-400" />
                            <p className="font-medium text-gray-900">{miningCompany.name}</p>
                          </div>
                        </div>
                      )}

                      {/* License */}
                      {license && (
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            LICENCE D'EXPORTATION
                          </label>
                          <div className="flex items-center gap-3">
                            <FileText className="w-5 h-5 text-gray-400" />
                            <div>
                              <p className="font-medium text-gray-900">{license.license_number}</p>
                              <p className="text-xs text-gray-500 mt-1">
                                Expire: {formatShortDate(license.end_date)}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                )}

                {activeTab === 'productions' && (
                  <Card className="p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-lg font-bold text-gray-900">Productions Incluses</h2>
                      <span className="text-sm text-gray-500">{productionItems.length} items</span>
                    </div>

                    {productionItems.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">#</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Box Number</th>
                              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Poids Brut (g)</th>
                              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Finesse (%)</th>
                              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Or Pur (g)</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Scellé 1</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Scellé 2</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {productionItems.map((item, index) => (
                              <tr key={item.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-sm text-gray-600">{index + 1}</td>
                                <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.ingot_box_number}</td>
                                <td className="px-4 py-3 text-sm text-right font-medium">{item.gross_weight_grams.toFixed(2)}</td>
                                <td className="px-4 py-3 text-sm text-right text-amber-600 font-semibold">{item.fineness_pct.toFixed(2)}%</td>
                                <td className="px-4 py-3 text-sm text-right font-bold text-emerald-700">{item.pure_gold_grams.toFixed(2)}</td>
                                <td className="px-4 py-3 text-sm font-mono text-gray-700">{item.seal_number_1 || '-'}</td>
                                <td className="px-4 py-3 text-sm font-mono text-gray-700">{item.seal_number_2 || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-12 text-gray-500">
                        <Box className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>Aucune production associée</p>
                      </div>
                    )}
                  </Card>
                )}

                {activeTab === 'signatories' && (
                  <Card className="p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-lg font-bold text-gray-900">Signataires</h2>
                      <span className="text-sm text-gray-500">{signatories.length} signataires</span>
                    </div>
                    {signatories.length > 0 ? (
                      <div className="space-y-4">
                        {signatories.map((signatory, index) => (
                          <div key={signatory.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-full">
                              <User className="w-5 h-5 text-blue-600" />
                            </div>
                            <div className="flex-1">
                              <p className="font-semibold text-gray-900">{signatory.name}</p>
                              <p className="text-sm text-gray-600">{signatory.position}</p>
                            </div>
                            {signatory.signed_at && (
                              <div className="text-right">
                                <p className="text-xs text-gray-500">Signé le</p>
                                <p className="text-sm font-medium text-gray-700">
                                  {formatShortDate(signatory.signed_at)}
                                </p>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-gray-500">
                        <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                        <p>Aucun signataire enregistré</p>
                      </div>
                    )}
                  </Card>
                )}

                {activeTab === 'documents' && (
                  <Card className="p-6">
                    <DocumentUploadSection
                      shippingId={id!}
                      documents={documents}
                      onDocumentUploaded={loadPreparationDetails}
                    />
                  </Card>
                )}

                {activeTab === 'certificates' && (
                  <Card className="p-6">
                    <AssayCertificateUploadForShipping
                      shippingPreparationId={id!}
                      certificates={certificates}
                      onCertificateUploaded={loadPreparationDetails}
                    />
                  </Card>
                )}
              </div>
            </div>

            {/* Right Sidebar - Status & History */}
            <div className="w-96">
              {/* Current Status */}
              <Card className="p-5 mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-5 h-5 text-blue-600" />
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Statut Actuel</h3>
                </div>
                <ShippingStatusBadge status={preparation.status} size="lg" />
              </Card>

              {/* Workflow Status Card */}
              <Card className="p-5 mb-4">
                <div className="flex items-center gap-2 mb-4">
                  <Package className="w-5 h-5 text-amber-600" />
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Workflow de Statut</h3>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex items-center justify-center w-10 h-10 bg-amber-500 rounded-full flex-shrink-0">
                      <Clock className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-amber-900 mb-1">
                        {statusLabels[preparation.status] || preparation.status}
                      </p>
                      <p className="text-xs text-amber-700">
                        {statusDescriptions[preparation.status] || ''}
                      </p>
                    </div>
                  </div>
                </div>
              </Card>

              {/* History */}
              <Card className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <History className="w-5 h-5 text-blue-600" />
                  <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Historique des Changements</h3>
                </div>
                <ShippingStatusHistory history={statusHistory} />
              </Card>
            </div>
          </div>
        </div>
      </div>

      <ErrorDialog
        isOpen={showError}
        onClose={() => setShowError(false)}
        title="Erreur"
        message={errorMessage}
      />
      <NotificationDialog
        isOpen={showSuccess}
        onClose={() => setShowSuccess(false)}
        type="success"
        title="Succès"
        message={successMessage}
      />
    </MainLayout>
  );
}
