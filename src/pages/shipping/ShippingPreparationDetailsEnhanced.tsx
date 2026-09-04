import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DossierComplet } from '@/components/dossier/DossierComplet';
import { ArrowLeft, Edit, Package, FileText, History, Users, Ship, Check, ClipboardList, FlaskConical, Receipt, Truck, Paperclip } from 'lucide-react';
import { NationalDashboardLayout } from '@/components/layout/NationalDashboardLayout';
import { PageHeader } from '@/components/ui/sn';
import '@/components/shipping/logistics-workspace.css';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Loading } from '@/components/ui/Loading';
import { ErrorDialog } from '@/components/ui/ErrorDialog';
import { Tabs } from '@/components/ui/Tabs';
import { shippingPreparationService, ShippingPreparation, ShippingProductionItem, ShippingSignatory, ShippingDocument } from '@/services/shippingPreparationService';
import { ShippingStatusBadge } from '@/components/shipping/ShippingStatusBadge';
import { ShippingStatusWorkflowEnhanced } from '@/components/shipping/ShippingStatusWorkflowEnhanced';
import { ShippingStatusHistory, type ShippingStatusHistoryEntry } from '@/components/shipping/ShippingStatusHistory';
import { SHIPPING_STATUSES, ShippingStatus } from '@/constants/shippingStatuses';
import { supabase } from '@/lib/supabase';
import { useDialog } from '@/contexts/DialogContext';
import { getCertificateUrl, getShippingCertificates, AssayCertificate } from '@/services/assayCertificateService';
import { shippingStatusService } from '@/services/shippingStatusService';
import { useAuth } from '@/contexts/AuthContext';
import { CAPABILITIES, hasSensitiveCapability } from '@/lib/capabilities';

interface MiningCompany {
  id: string;
  name: string;
}

interface Refinery {
  id: string;
  name: string;
  location?: string;
  country?: string;
}

interface TransportCompany {
  id: string;
  name: string;
}

interface ExportLicense {
  id: string;
  license_number: string;
  start_date?: string;
  end_date?: string;
}

const isShippingStatus = (status: string | null): status is ShippingStatus =>
  Boolean(status && status in SHIPPING_STATUSES);

const getDocumentType = (title: string): { type: string; order: number; icon: any; label: string } => {
  const titleLower = title.toLowerCase();

  if (titleLower.includes('packing') || titleLower.includes('liste de colisage')) {
    return { type: 'packing', order: 1, icon: ClipboardList, label: 'Liste de colisage' };
  }
  if (titleLower.includes('assay') || titleLower.includes('certificat') || titleLower.includes('essai')) {
    return { type: 'assay', order: 2, icon: FlaskConical, label: 'Certificat d’analyse' };
  }
  if (titleLower.includes('invoice') || titleLower.includes('facture')) {
    return { type: 'invoice', order: 3, icon: Receipt, label: 'Facture' };
  }
  if (titleLower.includes('consignment') || titleLower.includes('consignation')) {
    return { type: 'consignment', order: 4, icon: Truck, label: 'Consignation' };
  }

  return { type: 'other', order: 5, icon: Paperclip, label: 'Autre document' };
};

export function ShippingPreparationDetailsEnhanced() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showConfirm, showSuccess, showError: showErrorDialog } = useDialog();
  const { user } = useAuth();
  const canPrepare = hasSensitiveCapability(user, CAPABILITIES.SONASP_PREPARE);
  const canApprove = hasSensitiveCapability(user, CAPABILITIES.SONASP_APPROVE);

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
  const [openingDocumentId, setOpeningDocumentId] = useState<string | null>(null);

  const handleBack = () => {
    navigate(-1);
  };

  useEffect(() => {
    if (id) {
      loadShippingDetails();
    }
  }, [id]);

  const loadShippingDetails = async (forceRefresh = false) => {
    if (!id) {
      setError({
        title: 'Identifiant invalide',
        message: "L’identifiant de l’expédition est manquant."
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
          title: "Expédition indisponible",
          message: "L’expédition demandée est introuvable ou ne vous est pas accessible."
        });
        setLoading(false);
        return;
      }

      setPreparation(prep);

      const items = await shippingPreparationService.getProductionItems(id);
      setProductionItems(items || []);

      const sigs = await shippingPreparationService.getSignatories(id);
      setSignatories(sigs || []);

      try {
        const docs = await shippingPreparationService.getDocuments(id);
        setDocuments(docs || []);
      } catch (docError) {
        console.warn('Erreur lors du chargement des documents :', docError);
        setDocuments([]);
      }

      try {
        await loadCertificates();
      } catch (certError) {
        console.warn('Erreur lors du chargement des certificats :', certError);
        setCertificates([]);
      }

      await loadStatusHistory(id);

      if (prep.refinery_id) {
        const { data } = await supabase
          .from('refineries')
          .select('id, name, location, country')
          .eq('id', prep.refinery_id)
          .maybeSingle();
        if (data) setRefinery(data);
      }

      if (prep.freight_company_id) {
        const { data } = await supabase
          .from('transport_companies')
          .select('id, name')
          .eq('id', prep.freight_company_id)
          .maybeSingle();
        if (data) setTransportCompany(data);
      }

      if (prep.export_license_id) {
        const { data } = await supabase
          .from('export_licenses')
          .select('id, license_number, start_date, end_date')
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
      console.error('Erreur lors du chargement du détail de l’expédition :', error);
      setError({
        title: "Données indisponibles",
        message: error.message || "Impossible de charger le détail de l’expédition. Veuillez réessayer."
      });
    } finally {
      setLoading(false);
    }
  };

  const loadCertificates = async () => {
    if (!id) return;
    try {
      const result = await getShippingCertificates(id);
      if (result.success && result.data && Array.isArray(result.data)) {
        setCertificates(result.data);
      } else {
        console.warn('Échec du chargement des certificats :', result.error);
        setCertificates([]);
      }
    } catch (error) {
      console.warn('Impossible de charger les certificats :', error);
      setCertificates([]);
    }
  };

  const openPrivateDocument = async (
    documentId: string,
    reference: string,
    certificate: boolean,
  ) => {
    const popup = window.open('about:blank', '_blank');
    if (popup) popup.opener = null;
    setOpeningDocumentId(documentId);
    try {
      const signedUrl = certificate
        ? await getCertificateUrl(reference)
        : await shippingPreparationService.getDocumentUrl(reference);
      if (!popup) throw new Error("Autorisez les fenêtres contextuelles pour ouvrir ce document.");
      popup.location.replace(signedUrl);
    } catch (reason) {
      popup?.close();
      showErrorDialog(
        'Document indisponible',
        reason instanceof Error && reason.message.startsWith('Autorisez les fenêtres')
          ? reason.message
          : 'Impossible d’ouvrir le document privé.',
      );
    } finally {
      setOpeningDocumentId(null);
    }
  };

  const loadStatusHistory = async (shippingId: string) => {
    try {
      const { data: historyData, error: historyError } = await supabase
        .from('unified_status_history')
        .select(`
          id,
          entity_id,
          old_status,
          new_status,
          changed_by,
          changed_at,
          notes,
          action_description
        `)
        .eq('entity_type', 'shipping')
        .eq('entity_id', shippingId)
        .order('changed_at', { ascending: false });

      if (historyError || !historyData || historyData.length === 0) {
        setStatusHistory([]);
        return;
      }

      const historyWithEmails = await Promise.all(
        historyData.map(async (entry) => {
          let userEmail = "System";
          if (entry.changed_by) {
            const { data: userData } = await supabase
              .from('user_profiles')
              .select('email, full_name')
              .eq('id', entry.changed_by)
              .maybeSingle();

            if (userData) {
              if (userData.email) {
                userEmail = userData.email;
              } else if (userData.full_name) {
                userEmail = userData.full_name;
              } else {
                userEmail = 'System';
              }
            } else {
              userEmail = 'System';
            }
          }
          return {
            id: entry.id,
            shipping_preparation_id: entry.entity_id,
            old_status: isShippingStatus(entry.old_status) ? entry.old_status : null,
            new_status: isShippingStatus(entry.new_status)
              ? entry.new_status
              : 'waiting_for_customs_approval',
            changed_by: entry.changed_by ?? 'system',
            changed_at: entry.changed_at,
            notes: entry.notes,
            user_email: userEmail,
          } satisfies ShippingStatusHistoryEntry;
        })
      );

      setStatusHistory(historyWithEmails);
    } catch (error) {
      console.error('Erreur lors du chargement de l’historique des statuts :', error);
      setStatusHistory([]);
    }
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "Non renseignée";

    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Date non valide';
      return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });
    } catch (error) {
      return 'Date non valide';
    }
  };

  const formatWeight = (grams: number | null | undefined) => {
    if (grams === null || grams === undefined || !Number.isFinite(grams)) return '—';
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(grams);
  };

  const handleStatusChange = async (newStatus: ShippingStatus) => {
    if (!preparation || !id) return;

    const confirmMessages = {
      'approved_by_customs': "Confirmer l’approbation douanière ?",
      'ready_for_expedition': "Confirmer que la préparation est prête pour l’expédition ?"
    };

    const confirmMessage = confirmMessages[newStatus as keyof typeof confirmMessages];
    if (!confirmMessage) return;

    showConfirm(
      'Confirmation',
      confirmMessage,
      async () => {
        try {
          setLoading(true);

          await shippingStatusService.changeStatus(
            id,
            preparation.status,
            newStatus,
          );

          await loadShippingDetails(true);
          showSuccess('Statut modifié', `Le statut est désormais « ${SHIPPING_STATUSES[newStatus].label} ».`);
        } catch (err: any) {
          console.error('Erreur lors du changement de statut :', err);
          showErrorDialog("Erreur", err.message || "Impossible de mettre à jour le statut du circuit");
        } finally {
          setLoading(false);
        }
      }
    );
  };

  if (loading) {
    return (
      <NationalDashboardLayout>
        <div className="sn-page flex min-h-[400px] items-center justify-center"><Loading /></div>
      </NationalDashboardLayout>
    );
  }

  if (!preparation) {
    return (
      <NationalDashboardLayout>
        <div className="sn-page text-center py-12">
          <p className="text-sm text-gray-600">Expédition indisponible</p>
          <Button onClick={handleBack} className="mt-4" size="sm">
            Retour à la liste
          </Button>
        </div>
      </NationalDashboardLayout>
    );
  }

  const totalDocumentsCount = (documents?.length || 0) + (certificates?.length || 0);

  return (
    <NationalDashboardLayout>
      <div className="sn-page logistics-workspace">
      {error && (
        <ErrorDialog
          isOpen
          title={error.title}
          message={error.message}
          onClose={() => setError(null)}
        />
      )}

      <div className="space-y-6">
        <PageHeader
          title={`Préparation d’expédition ${preparation.expedition_lot_number || 'sans référence de lot'}`}
          subtitle={`Créée le ${formatDate(preparation.created_at)} · Quantités, scellés et pièces justificatives de référence.`}
          icon={Package}
          breadcrumb={[{ label: 'Mine industrielle' }, { label: 'Gestion des expéditions', to: '/shipping/preparation' }, { label: preparation.expedition_lot_number || 'Détail de la préparation' }]}
          actions={<div className="flex items-center gap-3">
            <ShippingStatusBadge status={preparation.status as ShippingStatus} size="md" showIcon />
            {canPrepare && preparation.status === 'waiting_for_customs_approval' && (
              <Button onClick={() => navigate(`/shipping/preparation/${id}/edit`)} variant="outline" size="sm">
                <Edit className="w-4 h-4 mr-2" />Modifier
              </Button>
            )}
            <Button variant="outline" onClick={handleBack} size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />Retour au registre
            </Button>
          </div>}
        />

        {/* Workflow - Full Width */}
        <ShippingStatusWorkflowEnhanced
          currentStatus={preparation.status as ShippingStatus}
          statusHistory={statusHistory}
        />

        {/* Refined Tabs */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <Tabs
            tabs={[
              {
                id: 'details',
                label: 'Détail de l’expédition',
                icon: Package,
              },
              {
                id: 'signatories',
                label: "Signataires",
                icon: Users,
                count: signatories.length,
              },
              {
                id: 'documents',
                label: 'Documents',
                icon: FileText,
                count: totalDocumentsCount,
              },
              {
                id: 'history',
                label: "Historique",
                icon: History,
                count: statusHistory.length,
              },
            ]}
            activeTab={activeTab}
            onChange={setActiveTab}
            className="p-6"
          >
            {(activeTab) => {
              if (activeTab === 'details') {
                return (
                  <div className="space-y-6">
                    {/* Informations d'Expédition - Format ligne par ligne */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
                        Informations sur l’expédition
                      </h3>
                      <div className="space-y-3">
                        <div className="flex items-start">
                          <span className="text-sm font-medium text-gray-600 w-48 flex-shrink-0">Société minière :</span>
                          <span className="text-sm text-gray-900 font-medium">{miningCompany?.name || "Non renseignée"}</span>
                        </div>
                        <div className="flex items-start">
                          <span className="text-sm font-medium text-gray-600 w-48 flex-shrink-0">Raffinerie de destination :</span>
                          <div>
                            {refinery ? (
                              <>
                                <span className="text-sm text-gray-900 font-medium">{refinery.name}</span>
                                {(refinery.location || refinery.country) && (
                                  <span className="text-sm text-gray-600 ml-2">
                                    ({[refinery.location, refinery.country].filter(Boolean).join(', ')})
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="text-sm text-gray-500 italic">Non renseignée</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-start">
                          <span className="text-sm font-medium text-gray-600 w-48 flex-shrink-0">Société de transport :</span>
                          <span className="text-sm text-gray-900">{transportCompany?.name || "Non renseignée"}</span>
                        </div>
                        <div className="flex items-start">
                          <span className="text-sm font-medium text-gray-600 w-48 flex-shrink-0">Licence d’exportation :</span>
                          <div>
                            {license ? (
                              <div className="group relative inline-block">
                                <span className="text-sm text-gray-900 font-medium cursor-help border-b border-dotted border-gray-400 hover:border-blue-500 hover:text-blue-600 transition-colors">
                                  {license.license_number}
                                </span>

                                {/* Popup Tooltip */}
                                <div className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity duration-200 absolute z-50 bottom-full left-0 mb-2 w-80 bg-white border border-gray-300 rounded-lg shadow-xl p-4">
                                  <div className="space-y-2">
                                    <div className="flex items-start justify-between border-b border-gray-200 pb-2">
                                      <h4 className="font-semibold text-gray-900 text-sm">Détail de la licence</h4>
                                      <FileText className="w-4 h-4 text-blue-600" />
                                    </div>

                                    <div className="space-y-1.5">
                                      <div className="flex justify-between">
                                        <span className="text-xs font-medium text-gray-600">Numéro :</span>
                                        <span className="text-xs text-gray-900 font-semibold">{license.license_number}</span>
                                      </div>

                                      {license.start_date && (
                                        <div className="flex justify-between">
                                          <span className="text-xs font-medium text-gray-600">Délivrée le :</span>
                                          <span className="text-xs text-gray-900">{formatDate(license.start_date)}</span>
                                        </div>
                                      )}

                                      {license.end_date && (
                                        <div className="flex justify-between">
                                          <span className="text-xs font-medium text-gray-600">Expire le :</span>
                                          <span className="text-xs text-gray-900">{formatDate(license.end_date)}</span>
                                        </div>
                                      )}

                                      {license.end_date && (
                                        <div className="mt-2 pt-2 border-t border-gray-200">
                                          <div className="flex items-center gap-1.5">
                                            {new Date(license.end_date) > new Date() ? (
                                              <>
                                                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                                <span className="text-xs text-green-700 font-medium">Licence valide</span>
                                              </>
                                            ) : (
                                              <>
                                                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                                <span className="text-xs text-red-700 font-medium">Licence expirée</span>
                                              </>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Arrow pointing down */}
                                  <div className="absolute top-full left-4 w-0 h-0 border-l-8 border-l-transparent border-r-8 border-r-transparent border-t-8 border-t-white"></div>
                                  <div className="absolute top-full left-4 w-0 h-0 border-l-8 border-l-transparent border-r-8 border-r-transparent border-t-8 border-t-gray-300 -mt-px"></div>
                                </div>
                              </div>
                            ) : (
                              <span className="text-sm text-gray-500 italic">Non renseignée</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-start">
                          <span className="text-sm font-medium text-gray-600 w-48 flex-shrink-0">Créée le :</span>
                          <span className="text-sm text-gray-900">{formatDate(preparation.created_at)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Détails des Productions avec Poids - Tableau */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
                        Détail des productions
                      </h3>
                      {productionItems.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                            <thead className="bg-gradient-to-r from-slate-50 to-gray-50">
                              <tr>
                                <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b border-gray-200">N° de colis</th>
                                <th className="px-4 py-3 text-right font-semibold text-gray-700 border-b border-gray-200">Poids net (g)</th>
                                <th className="px-4 py-3 text-right font-semibold text-gray-700 border-b border-gray-200">Poids net (oz)</th>
                                <th className="px-4 py-3 text-right font-semibold text-gray-700 border-b border-gray-200">Poids brut (g)</th>
                                <th className="px-4 py-3 text-right font-semibold text-gray-700 border-b border-gray-200">Titre (%)</th>
                                <th className="px-4 py-3 text-right font-semibold text-gray-700 border-b border-gray-200">Or fin (g)</th>
                                <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b border-gray-200">Scellés</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {productionItems.map((item, index) => (
                                <tr key={item.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                  <td className="px-4 py-3 font-medium text-gray-900">
                                    {item.box_number || item.ingot_box_number || 'N/A'}
                                  </td>
                                  <td className="px-4 py-3 text-right text-gray-900">
                                    {formatWeight(item.net_weight_grams)}
                                  </td>
                                  <td className="px-4 py-3 text-right text-gray-900">
                                    {formatWeight(item.net_weight_grams / 31.1034768)}
                                  </td>
                                  <td className="px-4 py-3 text-right text-gray-900">
                                    {formatWeight(item.gross_weight_grams)}
                                  </td>
                                  <td className="px-4 py-3 text-right text-gray-900">
                                    {formatWeight(item.fineness_pct)}%
                                  </td>
                                  <td className="px-4 py-3 text-right font-medium text-yellow-700">
                                    {formatWeight(item.pure_gold_grams)}
                                  </td>
                                  <td className="px-4 py-3 text-gray-600 text-xs">
                                    {[item.seal_number_1, item.seal_number_2].filter(Boolean).join(', ') || 'N/A'}
                                  </td>
                                </tr>
                              ))}
                              {/* Ligne de Total */}
                              <tr className="bg-gradient-to-r from-amber-50 to-yellow-50 font-bold border-t-2 border-amber-200">
                                <td className="px-4 py-4 text-gray-900">
                                  TOTAL ({productionItems.length} colis)
                                </td>
                                <td className="px-4 py-4 text-right text-gray-900">
                                  {formatWeight(preparation.total_net_weight_grams)}
                                </td>
                                <td className="px-4 py-4 text-right text-gray-900">
                                  {formatWeight(preparation.total_weight_oz)}
                                </td>
                                <td className="px-4 py-4 text-right text-gray-900">
                                  {formatWeight(preparation.total_gross_weight_grams)}
                                </td>
                                <td className="px-4 py-4 text-right text-gray-600">-</td>
                                <td className="px-4 py-4 text-right text-yellow-700">
                                  {formatWeight(productionItems.reduce((sum, item) => sum + (item.pure_gold_grams || 0), 0))}
                                </td>
                                <td className="px-4 py-4"></td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
                          <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                          <p className="text-sm text-gray-600">Aucune production n’a été enregistrée</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }

              if (activeTab === 'signatories') {
                return (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Signataires</h3>
                    {signatories.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {signatories.map((sig) => (
                          <div key={sig.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <Users className="w-5 h-5 text-blue-600" />
                              </div>
                              <div className="flex-1">
                                <p className="font-semibold text-gray-900">
                                  {sig.name}
                                </p>
                                <p className="text-sm text-gray-600 mt-1">{sig.position}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
                        <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-sm text-gray-600 font-medium">Aucun signataire n’a été enregistré</p>
                      </div>
                    )}
                  </div>
                );
              }

              if (activeTab === 'documents') {
                const allDocs = [
                  ...(documents || []).map(doc => ({ ...doc, isDocument: true, isCertificate: false })),
                  ...(certificates || []).map(cert => ({
                    id: cert.id,
                    title: `Certificat d’analyse — ${cert.certificate_number || cert.file_name || 'N/R'}`,
                    file_name: cert.file_name || 'certificate.pdf',
                    document_url: cert.file_path,
                    isDocument: false,
                    isCertificate: true
                  }))
                ];

                const sortedDocuments = allDocs.sort((a, b) => {
                  const typeA = getDocumentType(a.title || '');
                  const typeB = getDocumentType(b.title || '');
                  return typeA.order - typeB.order;
                });

                return (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Documents ({sortedDocuments.length})
                    </h3>
                    {sortedDocuments.length > 0 ? (
                      <div className="space-y-3">
                        {sortedDocuments.map((doc) => {
                          const docType = getDocumentType(doc.title);
                          const Icon = docType.icon;

                          return (
                            <div key={doc.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:shadow-md transition-all hover:border-blue-300">
                              <div className="flex items-center gap-4 flex-1">
                                <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
                                  <Icon className="w-6 h-6 text-blue-600" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-2.5 py-1 rounded-full">
                                      {docType.label}
                                    </span>
                                    <p className="text-sm font-semibold text-gray-900 truncate">{doc.title}</p>
                                  </div>
                                  <p className="text-xs text-gray-500">{doc.file_name}</p>
                                </div>
                              </div>
                              {doc.document_url && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => void openPrivateDocument(
                                    doc.id,
                                    doc.document_url,
                                    doc.isCertificate,
                                  )}
                                  disabled={openingDocumentId === doc.id}
                                >
                                  Consulter
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
                        <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-sm text-gray-600 font-medium">Aucun document disponible</p>
                        <p className="text-xs text-gray-500 mt-2">Les documents joints apparaîtront ici</p>
                      </div>
                    )}
                  </div>
                );
              }

              if (activeTab === 'history') {
                return (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Historique des statuts
                    </h3>
                    {statusHistory.length > 0 ? (
                      <ShippingStatusHistory history={statusHistory} />
                    ) : (
                      <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
                        <History className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-sm text-gray-600 font-medium">Aucune modification enregistrée</p>
                        <p className="text-xs text-gray-500 mt-2">Les modifications enregistrées apparaîtront ici</p>
                      </div>
                    )}
                  </div>
                );
              }

              return null;
            }}
          </Tabs>
        </div>

        {/* Action Buttons */}
        {preparation && (
          <Card className="p-6 bg-gradient-to-r from-slate-50 to-gray-50 border-2">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-gray-900 mb-1">Actions disponibles</h3>
                <p className="text-sm text-gray-600">
                   {preparation.status === 'waiting_for_customs_approval' && (canApprove
                     ? 'Approuvez le dédouanement de cette préparation.'
                     : 'L’approbation douanière est en attente. Cette page est en lecture seule pour vos responsabilités actuelles.')}
                   {preparation.status === 'approved_by_customs' && (canPrepare
                     ? 'Déclarez cette préparation prête pour l’expédition.'
                     : 'La préparation finale est en attente. Cette page est en lecture seule pour vos responsabilités actuelles.')}
                  {preparation.status === 'ready_for_expedition' && "Cette préparation est prête. Gérez son départ depuis Douane et consignation."}
                </p>
              </div>
              <div className="flex gap-3">
                 {preparation.status === 'waiting_for_customs_approval' && canApprove && (
                  <Button
                    onClick={() => handleStatusChange('approved_by_customs')}
                    variant="primary"
                    size="md"
                    className="bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Approuver le dédouanement
                  </Button>
                )}
                 {preparation.status === 'approved_by_customs' && canPrepare && (
                  <Button
                    onClick={() => handleStatusChange('ready_for_expedition')}
                    variant="primary"
                    size="md"
                    className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800"
                  >
                    <Ship className="w-4 h-4 mr-2" />
                    Prête pour l’expédition
                  </Button>
                )}
                {preparation.status === 'ready_for_expedition' && (
                  <Button
                    onClick={() => navigate('/freight')}
                    variant="outline"
                    size="md"
                  >
                    <Ship className="w-4 h-4 mr-2" />
                    Ouvrir Douane et consignation
                  </Button>
                )}
              </div>
            </div>
          </Card>
        )}
        {id && <DossierComplet type="expedition" id={id} />}
      </div>
      </div>
    </NationalDashboardLayout>
  );
}

export default ShippingPreparationDetailsEnhanced;
