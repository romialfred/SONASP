import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Calendar, Building, Package, FileText, History, Users, Ship, Check, ClipboardList, FlaskConical, Receipt, Truck, Paperclip, AlertCircle } from 'lucide-react';
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
import { useDialog } from '@/contexts/DialogContext';
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
  issue_date?: string;
  expiry_date?: string;
}

const getDocumentType = (title: string): { type: string; order: number; icon: any; label: string } => {
  const titleLower = title.toLowerCase();

  if (titleLower.includes('packing') || titleLower.includes('liste de colisage')) {
    return { type: 'packing', order: 1, icon: ClipboardList, label: 'Packing List' };
  }
  if (titleLower.includes('assay') || titleLower.includes('certificat') || titleLower.includes('essai')) {
    return { type: 'assay', order: 2, icon: FlaskConical, label: 'Certificat d\'Essai' };
  }
  if (titleLower.includes('invoice') || titleLower.includes('facture')) {
    return { type: 'invoice', order: 3, icon: Receipt, label: 'Invoice' };
  }
  if (titleLower.includes('consignment') || titleLower.includes('consignation')) {
    return { type: 'consignment', order: 4, icon: Truck, label: 'Consignment' };
  }

  return { type: 'other', order: 5, icon: Paperclip, label: 'Autre Document' };
};

export function ShippingPreparationDetailsEnhanced() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showConfirm, showSuccess, showError: showErrorDialog } = useDialog();

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

      const items = await shippingPreparationService.getProductionItems(id);
      setProductionItems(items || []);

      const sigs = await shippingPreparationService.getSignatories(id);
      setSignatories(sigs || []);

      try {
        const docs = await shippingPreparationService.getDocuments(id);
        setDocuments(docs || []);
      } catch (docError) {
        console.warn('Error loading documents:', docError);
        setDocuments([]);
      }

      try {
        await loadCertificates();
      } catch (certError) {
        console.warn('Error loading certificates:', certError);
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
          .from('freight_companies')
          .select('id, name')
          .eq('id', prep.freight_company_id)
          .maybeSingle();
        if (data) setTransportCompany(data);
      }

      if (prep.export_license_id) {
        const { data } = await supabase
          .from('export_licenses')
          .select('id, license_number, issue_date, expiry_date')
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
      const result = await getShippingCertificates(id);
      if (result.success && result.data && Array.isArray(result.data)) {
        const certsWithUrls = result.data.map(cert => {
          const { data } = supabase.storage
            .from('ASSAY-CERTIFICATES')
            .getPublicUrl(cert.file_path);
          return {
            ...cert,
            public_url: data.publicUrl
          };
        });
        setCertificates(certsWithUrls as any);
      } else {
        console.warn('Failed to load certificates:', result.error);
        setCertificates([]);
      }
    } catch (error) {
      console.warn('Could not load certificates:', error);
      setCertificates([]);
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
          let userEmail = 'Système';
          if (entry.changed_by) {
            const { data: userData } = await supabase
              .from('profiles')
              .select('email')
              .eq('id', entry.changed_by)
              .maybeSingle();
            userEmail = userData?.email || 'Utilisateur Inconnu';
          }
          return {
            ...entry,
            user_email: userEmail
          } as ShippingStatusHistoryEntry;
        })
      );

      setStatusHistory(historyWithEmails);
    } catch (error) {
      console.error('Error loading status history:', error);
      setStatusHistory([]);
    }
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'Non spécifié';

    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Date invalide';
      return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      });
    } catch (error) {
      return 'Date invalide';
    }
  };

  const formatWeight = (grams: number | null | undefined) => {
    if (grams === null || grams === undefined) return '0,00';
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(grams);
  };

  const handleStatusChange = async (newStatus: ShippingStatus) => {
    if (!preparation || !id) return;

    const confirmMessages = {
      'approved_by_customs': 'Confirmer l\'approbation douanière ?',
      'ready_for_expedition': 'Confirmer le statut prêt pour expédition ?'
    };

    const confirmMessage = confirmMessages[newStatus as keyof typeof confirmMessages];
    if (!confirmMessage) return;

    showConfirm(
      'Confirmation',
      confirmMessage,
      async () => {
        try {
          setLoading(true);

          const { error: updateError } = await supabase
            .from('shipping_preparations')
            .update({ status: newStatus })
            .eq('id', id);

          if (updateError) throw updateError;

          await supabase
            .from('unified_status_history')
            .insert({
              entity_type: 'shipping',
              entity_id: id,
              old_status: preparation.status,
              new_status: newStatus,
              change_context: 'shipping_management',
              changed_by: user?.id,
              action_description: `Status changé: ${preparation.status} → ${newStatus}`,
            });

          await loadShippingDetails(true);
          showSuccess('Succès', `Le statut a été changé avec succès vers "${newStatus}"`);
        } catch (err: any) {
          console.error('Error changing status:', err);
          showErrorDialog('Erreur', err.message || 'Erreur lors du changement de status');
        } finally {
          setLoading(false);
        }
      }
    );
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
          <Button onClick={handleBack} className="mt-4" size="sm">
            Retour à la liste
          </Button>
        </div>
      </MainLayout>
    );
  }

  const totalDocumentsCount = (documents?.length || 0) + (certificates?.length || 0);

  return (
    <MainLayout>
      {error && (
        <ErrorDialog
          title={error.title}
          message={error.message}
          onClose={() => setError(null)}
        />
      )}

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleBack}
              size="sm"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-gray-900">
                  Expédition {preparation.reference_number || preparation.expedition_number}
                </h1>
                <ShippingStatusBadge
                  status={preparation.status as ShippingStatus}
                  size="md"
                  showIcon
                />
              </div>
              <p className="text-sm text-gray-600 mt-1 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {formatDate(preparation.created_at)}
              </p>
            </div>
          </div>
          <Button
            onClick={() => navigate(`/shipping/preparation/${id}/edit`)}
            variant="outline"
            size="sm"
          >
            <Edit className="w-4 h-4 mr-2" />
            Modifier
          </Button>
        </div>

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
                label: 'Détails de l\'Expédition',
                icon: Package,
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
                count: totalDocumentsCount,
              },
              {
                id: 'history',
                label: 'Historique',
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
                        Informations d'Expédition
                      </h3>
                      <div className="space-y-3">
                        <div className="flex items-start">
                          <span className="text-sm font-medium text-gray-600 w-48 flex-shrink-0">Mining Company :</span>
                          <span className="text-sm text-gray-900 font-medium">{miningCompany?.name || 'Non spécifié'}</span>
                        </div>
                        <div className="flex items-start">
                          <span className="text-sm font-medium text-gray-600 w-48 flex-shrink-0">Raffinerie de Destination :</span>
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
                              <span className="text-sm text-gray-500 italic">Non spécifiée</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-start">
                          <span className="text-sm font-medium text-gray-600 w-48 flex-shrink-0">Compagnie de Fret :</span>
                          <span className="text-sm text-gray-900">{transportCompany?.name || 'Non spécifiée'}</span>
                        </div>
                        <div className="flex items-start">
                          <span className="text-sm font-medium text-gray-600 w-48 flex-shrink-0">License d'Exportation :</span>
                          <div>
                            {license ? (
                              <>
                                <span className="text-sm text-gray-900 font-medium">{license.license_number}</span>
                                {license.expiry_date && (
                                  <span className="text-sm text-gray-600 ml-2">
                                    (Expire: {formatDate(license.expiry_date)})
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="text-sm text-gray-500 italic">Non spécifié</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-start">
                          <span className="text-sm font-medium text-gray-600 w-48 flex-shrink-0">Date de Création :</span>
                          <span className="text-sm text-gray-900">{formatDate(preparation.created_at)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Détails des Productions avec Poids - Tableau */}
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">
                        Détails des Productions
                      </h3>
                      {productionItems.length > 0 ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
                            <thead className="bg-gradient-to-r from-slate-50 to-gray-50">
                              <tr>
                                <th className="px-4 py-3 text-left font-semibold text-gray-700 border-b border-gray-200">N° Boîte</th>
                                <th className="px-4 py-3 text-right font-semibold text-gray-700 border-b border-gray-200">Poids Net (g)</th>
                                <th className="px-4 py-3 text-right font-semibold text-gray-700 border-b border-gray-200">Poids Net (oz)</th>
                                <th className="px-4 py-3 text-right font-semibold text-gray-700 border-b border-gray-200">Poids Brut (g)</th>
                                <th className="px-4 py-3 text-right font-semibold text-gray-700 border-b border-gray-200">Finesse (%)</th>
                                <th className="px-4 py-3 text-right font-semibold text-gray-700 border-b border-gray-200">Or Pur (g)</th>
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
                                    {formatWeight(item.net_weight_grams / 31.1035)}
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
                                  TOTAL ({productionItems.length} boîte{productionItems.length > 1 ? 's' : ''})
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
                          <p className="text-sm text-gray-600">Aucune production enregistrée</p>
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
                                  {sig.full_name || sig.name}
                                </p>
                                <p className="text-sm text-gray-600 mt-1">{sig.title || sig.position}</p>
                                {sig.organization && (
                                  <p className="text-xs text-gray-500 mt-1">{sig.organization}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
                        <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-sm text-gray-600 font-medium">Aucun signataire enregistré</p>
                      </div>
                    )}
                  </div>
                );
              }

              if (activeTab === 'documents') {
                const allDocs = [
                  ...(documents || []).map(doc => ({ ...doc, isDocument: true })),
                  ...(certificates || []).map(cert => ({
                    id: cert.id,
                    title: `Certificat d'Essai - ${cert.certificate_number || cert.file_name || 'N/A'}`,
                    file_name: cert.file_name || 'certificate.pdf',
                    document_url: (cert as any).public_url || '',
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
                                  onClick={() => window.open(doc.document_url, '_blank')}
                                >
                                  Voir
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
                        <p className="text-xs text-gray-500 mt-2">Les documents apparaîtront ici une fois ajoutés</p>
                      </div>
                    )}
                  </div>
                );
              }

              if (activeTab === 'history') {
                return (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Historique des Changements
                    </h3>
                    {statusHistory.length > 0 ? (
                      <ShippingStatusHistory history={statusHistory} />
                    ) : (
                      <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
                        <History className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-sm text-gray-600 font-medium">Aucun changement enregistré</p>
                        <p className="text-xs text-gray-500 mt-2">L'historique des changements apparaîtra ici</p>
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
                  {preparation.status === 'waiting_for_customs_approval' && 'Approuver cette expédition pour la douane'}
                  {preparation.status === 'approved_by_customs' && 'Marquer comme prêt pour expédition'}
                  {preparation.status === 'ready_for_expedition' && 'Cette expédition est prête. Gérer l\'expédition dans le module Invoice & Consignment.'}
                </p>
              </div>
              <div className="flex gap-3">
                {preparation.status === 'waiting_for_customs_approval' && (
                  <Button
                    onClick={() => handleStatusChange('approved_by_customs')}
                    variant="primary"
                    size="md"
                    className="bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Approuver Douane
                  </Button>
                )}
                {preparation.status === 'approved_by_customs' && (
                  <Button
                    onClick={() => handleStatusChange('ready_for_expedition')}
                    variant="primary"
                    size="md"
                    className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800"
                  >
                    <Ship className="w-4 h-4 mr-2" />
                    Prêt pour Expédition
                  </Button>
                )}
                {preparation.status === 'ready_for_expedition' && (
                  <Button
                    onClick={() => navigate('/freight')}
                    variant="outline"
                    size="md"
                  >
                    <Ship className="w-4 h-4 mr-2" />
                    Gérer dans Invoice & Consignment
                  </Button>
                )}
              </div>
            </div>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}

export default ShippingPreparationDetailsEnhanced;
