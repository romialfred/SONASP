import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Calendar, Building, Package, TrendingUp, FileText, History, Users, Ship } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Loading } from '@/components/ui/Loading';
import { ErrorDialog } from '@/components/ui/ErrorDialog';
import { Tabs } from '@/components/ui/Tabs';
import { shippingPreparationService, ShippingPreparation, ShippingProductionItem, ShippingSignatory, ShippingDocument } from '@/services/shippingPreparationService';
import { ShippingStatusBadge } from '@/components/shipping/ShippingStatusBadge';
import { ShippingStatusWorkflowEnhanced } from '@/components/shipping/ShippingStatusWorkflowEnhanced';
import { ShippingStatusHistory } from '@/components/shipping/ShippingStatusHistory';
import { ShippingStatus } from '@/constants/shippingStatuses';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { AssayCertificateCard } from '@/components/shipping/AssayCertificateCard';
import { getShippingCertificates, AssayCertificate } from '@/services/assayCertificateService';

interface ShippingStatusHistoryEntry {
  id: string;
  entity_id: string;
  old_status: string | null;
  new_status: string;
  changed_by: string | null;
  changed_at: string;
  notes: string | null;
  action_description: string | null;
  user_email?: string;
}

interface MiningCompany {
  id: string;
  name: string;
}

interface Refinery {
  id: string;
  name: string;
}

interface TransportCompany {
  id: string;
  name: string;
}

interface ExportLicense {
  id: string;
  license_number: string;
}

export function ShippingPreparationDetailsEnhanced() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ title: string; message: string } | null>(null);
  const [activeTab, setActiveTab] = useState('details');

  const returnPath = '/shipping';

  useEffect(() => {
    if (id) {
      loadShippingDetails();
    }
  }, [id]);

  const loadShippingDetails = async (forceRefresh = false) => {
    if (!id) {
      setError({
        title: 'ID Invalide',
        message: 'L\'identifiant de l\'expédition est manquant.'
      });
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      if (forceRefresh) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const prep = await shippingPreparationService.getPreparationById(id);
      if (!prep) {
        setError({
          title: 'Expédition introuvable',
          message: 'L\'expédition demandée n\'existe pas ou a été supprimée.'
        });
        setLoading(false);
        return;
      }

      setPreparation(prep);

      // Load production items
      const items = await shippingPreparationService.getProductionItems(id);
      setProductionItems(items);

      // Load signatories
      const sigs = await shippingPreparationService.getSignatories(id);
      setSignatories(sigs);

      // Load documents
      const docs = await shippingPreparationService.getDocuments(id);
      setDocuments(docs);

      // Load certificates
      await loadCertificates();

      // Load status history
      await loadStatusHistory(id);

      // Load related entities
      if (prep.refinery_id) {
        const { data } = await supabase
          .from('refinery_plants')
          .select('id, name')
          .eq('id', prep.refinery_id)
          .maybeSingle();
        if (data) setRefinery(data);
      }

      if (prep.freight_company_id) {
        const { data } = await supabase
          .from('freight_companies')
          .select('id, name')
          .eq('id', prep.freight_company_id)
          .maybeSingle();
        if (data) setTransportCompany(data);
      }

      if (prep.export_license_id) {
        const { data } = await supabase
          .from('export_licenses')
          .select('id, license_number')
          .eq('id', prep.export_license_id)
          .maybeSingle();
        if (data) setLicense(data);
      }

      if (prep.mining_company_id) {
        const { data } = await supabase
          .from('mining_companies')
          .select('id, name')
          .eq('id', prep.mining_company_id)
          .maybeSingle();
        if (data) setMiningCompany(data);
      }
    } catch (error: any) {
      console.error('Error loading shipping details:', error);
      setError({
        title: 'Erreur de chargement',
        message: error.message || 'Impossible de charger les détails de l\'expédition. Veuillez réessayer.'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadCertificates = async () => {
    if (!id) return;
    try {
      const certs = await getShippingCertificates(id);
      setCertificates(certs);
    } catch (error) {
      console.warn('Could not load certificates:', error);
    }
  };

  const loadStatusHistory = async (shippingId: string) => {
    try {
      const { data: historyData, error: historyError } = await supabase
        .from('shipping_status_history')
        .select(`
          id,
          shipping_preparation_id,
          old_status,
          new_status,
          changed_by,
          changed_at,
          notes
        `)
        .eq('shipping_preparation_id', shippingId)
        .order('changed_at', { ascending: false });

      if (historyError) throw historyError;

      const formattedHistory: ShippingStatusHistoryEntry[] = (historyData || []).map(h => ({
        id: h.id,
        entity_id: h.shipping_preparation_id,
        old_status: h.old_status,
        new_status: h.new_status,
        changed_by: h.changed_by,
        changed_at: h.changed_at,
        notes: h.notes,
        action_description: null
      }));

      setStatusHistory(formattedHistory);
    } catch (error) {
      console.error('Error loading status history:', error);
      setStatusHistory([]);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatWeight = (grams: number) => {
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(grams);
  };

  if (loading) {
    return (
      <MainLayout>
        <Loading />
      </MainLayout>
    );
  }

  if (!preparation) {
    return (
      <MainLayout>
        <div className="text-center py-12">
          <p className="text-sm text-gray-600">Expédition introuvable</p>
          <Button onClick={() => navigate(returnPath)} className="mt-4" size="sm">
            Retour à la liste
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      {error && (
        <ErrorDialog
          title={error.title}
          message={error.message}
          onClose={() => setError(null)}
        />
      )}

      <div className="space-y-4">
        {/* Header - Same as Production Details */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => navigate(returnPath)}
              size="sm"
              className="text-xs"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
              Retour
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900">
                  Expédition {preparation.reference_number || preparation.expedition_number}
                </h1>
                <ShippingStatusBadge
                  status={preparation.status as ShippingStatus}
                  size="sm"
                  showIcon
                />
              </div>
              <p className="text-xs text-gray-600 mt-0.5 flex items-center gap-1.5">
                <Calendar className="w-3 h-3" />
                {formatDate(preparation.shipment_date || preparation.production_date)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => navigate(`/shipping/preparation/${id}/edit`)}
              variant="outline"
              size="sm"
              className="text-xs"
            >
              <Edit className="w-3.5 h-3.5 mr-1.5" />
              Modifier
            </Button>
          </div>
        </div>

        {/* Workflow Section - Full Width - Horizontal like Production */}
        <ShippingStatusWorkflowEnhanced
          currentStatus={preparation.status as ShippingStatus}
          statusHistory={statusHistory}
        />

        {/* Tabs Navigation */}
        <Tabs
          tabs={[
            {
              id: 'details',
              label: 'Détails de l\'Expédition',
              icon: Package,
            },
            {
              id: 'items',
              label: 'Boîtes',
              icon: Package,
              count: productionItems.length,
            },
            {
              id: 'certificates',
              label: 'Certificats d\'Essai',
              icon: FileText,
              count: certificates.length,
            },
            {
              id: 'signatories',
              label: 'Signataires',
              icon: Users,
              count: signatories.length,
            },
            {
              id: 'documents',
              label: 'Documents',
              icon: FileText,
              count: documents.length,
            },
          ]}
          defaultTab="details"
        >
          {(activeTab) => {
            if (activeTab === 'details') {
              return (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left Column - Main Info */}
                  <div className="lg:col-span-2 space-y-6">
                    {/* Informations Générales */}
                    <Card className="p-6">
                      <h3 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wide">
                        Informations d'Expédition
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-gray-500 flex items-center gap-1.5">
                            <Building className="w-3 h-3" />
                            Raffinerie de Destination
                          </p>
                          <p className="text-sm font-medium text-gray-900 mt-1">
                            {refinery?.name || 'Non spécifiée'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 flex items-center gap-1.5">
                            <Building className="w-3 h-3" />
                            Mining Company
                          </p>
                          <p className="text-sm font-medium text-gray-900 mt-1">
                            {miningCompany?.name || 'Non spécifiée'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 flex items-center gap-1.5">
                            <Ship className="w-3 h-3" />
                            Compagnie de Fret
                          </p>
                          <p className="text-sm font-medium text-gray-900 mt-1">
                            {transportCompany?.name || 'Non spécifiée'}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Numéro de License</p>
                          <p className="text-sm font-medium text-gray-900 mt-1">
                            {license?.license_number || 'Non spécifié'}
                          </p>
                        </div>
                      </div>
                    </Card>

                    {/* Poids et Conversions */}
                    <Card className="p-6">
                      <h3 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wide">
                        Poids et Conversions
                      </h3>
                      <div className="grid grid-cols-1 gap-4">
                        <div>
                          <p className="text-xs text-gray-500">Nombre de Boîtes</p>
                          <p className="text-2xl font-bold text-gray-900">{preparation.total_boxes}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100">
                            <p className="text-xs text-yellow-800 mb-2">Poids Net Total</p>
                            <div className="space-y-1">
                              <p className="text-sm font-medium text-yellow-900">
                                Grammes
                              </p>
                              <p className="text-xl font-bold text-yellow-900">
                                {formatWeight(preparation.total_net_weight_grams)} g
                              </p>
                            </div>
                            <div className="space-y-1 mt-3">
                              <p className="text-sm font-medium text-yellow-900">
                                Onces
                              </p>
                              <p className="text-xl font-bold text-yellow-900">
                                {formatWeight(preparation.total_weight_oz)} oz
                              </p>
                            </div>
                          </div>
                          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                            <p className="text-xs text-blue-800 mb-2">Poids Brut Total</p>
                            <div className="space-y-1">
                              <p className="text-sm font-medium text-blue-900">
                                Grammes
                              </p>
                              <p className="text-xl font-bold text-blue-900">
                                {formatWeight(preparation.total_gross_weight_grams)} g
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  </div>

                  {/* Right Column - Status History */}
                  <div className="lg:col-span-1">
                    <Card className="p-6">
                      <div className="flex items-center gap-2 mb-4">
                        <History className="w-4 h-4 text-gray-500" />
                        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                          Historique des Changements
                        </h3>
                      </div>
                      {statusHistory.length > 0 ? (
                        <ShippingStatusHistory history={statusHistory} />
                      ) : (
                        <div className="text-center py-8">
                          <History className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                          <p className="text-sm text-gray-500">Aucun changement enregistré</p>
                          <p className="text-xs text-gray-400 mt-1">
                            L'historique des changements apparaîtra ici
                          </p>
                        </div>
                      )}
                    </Card>
                  </div>
                </div>
              );
            }

            if (activeTab === 'items') {
              return (
                <Card className="p-6">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">Boîtes d'Expédition</h3>
                  {productionItems.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700">N° Boîte</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-700">Poids Net (g)</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-700">Poids Brut (g)</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-700">Finesse (%)</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-700">Or Pur (g)</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-700">Scellés</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {productionItems.map((item) => (
                            <tr key={item.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 font-medium text-gray-900">
                                {item.box_number || item.ingot_box_number}
                              </td>
                              <td className="px-4 py-3 text-right text-gray-900">
                                {formatWeight(item.net_weight_grams)}
                              </td>
                              <td className="px-4 py-3 text-right text-gray-900">
                                {formatWeight(item.gross_weight_grams)}
                              </td>
                              <td className="px-4 py-3 text-right text-gray-900">
                                {item.fineness_pct.toFixed(2)}%
                              </td>
                              <td className="px-4 py-3 text-right font-medium text-yellow-700">
                                {formatWeight(item.pure_gold_grams)}
                              </td>
                              <td className="px-4 py-3 text-gray-600 text-xs">
                                {[item.seal_number_1, item.seal_number_2].filter(Boolean).join(', ') || 'N/A'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-sm">Aucune boîte enregistrée</p>
                    </div>
                  )}
                </Card>
              );
            }

            if (activeTab === 'certificates') {
              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {certificates.length > 0 ? (
                    certificates.map((cert) => (
                      <AssayCertificateCard key={cert.id} certificate={cert} />
                    ))
                  ) : (
                    <Card className="col-span-2 p-8 text-center">
                      <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-sm text-gray-500">Aucun certificat d'essai disponible</p>
                    </Card>
                  )}
                </div>
              );
            }

            if (activeTab === 'signatories') {
              return (
                <Card className="p-6">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">Signataires</h3>
                  {signatories.length > 0 ? (
                    <div className="space-y-3">
                      {signatories.map((sig) => (
                        <div key={sig.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-start gap-3">
                            <Users className="w-5 h-5 text-gray-400 mt-1" />
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">
                                {sig.full_name || sig.name}
                              </p>
                              <p className="text-sm text-gray-600">{sig.title || sig.position}</p>
                              {sig.organization && (
                                <p className="text-xs text-gray-500 mt-1">{sig.organization}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-sm">Aucun signataire enregistré</p>
                    </div>
                  )}
                </Card>
              );
            }

            if (activeTab === 'documents') {
              return (
                <Card className="p-6">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">Documents</h3>
                  {documents.length > 0 ? (
                    <div className="space-y-2">
                      {documents.map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                          <div className="flex items-center gap-3">
                            <FileText className="w-5 h-5 text-gray-400" />
                            <div>
                              <p className="text-sm font-medium text-gray-900">{doc.title}</p>
                              <p className="text-xs text-gray-500">{doc.file_name}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-sm">Aucun document disponible</p>
                    </div>
                  )}
                </Card>
              );
            }

            return null;
          }}
        </Tabs>
      </div>
    </MainLayout>
  );
}

export default ShippingPreparationDetailsEnhanced;
