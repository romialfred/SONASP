import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Calendar, Building, Package, TrendingUp, FileText, History } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Loading } from '@/components/ui/Loading';
import { ErrorDialog } from '@/components/ui/ErrorDialog';
import { Tabs } from '@/components/ui/Tabs';
import { dailyProductionService, DailyProduction } from '@/services/dailyProductionService';
import { productionStatusService, StatusHistoryEntry } from '@/services/productionStatusService';
import { productionDocumentService } from '@/services/productionDocumentService';
import { ProductionStatusBadge } from '@/components/production/ProductionStatusBadge';
import { ProductionStatusWorkflow } from '@/components/production/ProductionStatusWorkflow';
import { ProductionStatusWorkflowEnhanced } from '@/components/production/ProductionStatusWorkflowEnhanced';
import { ProductionDocumentsList, ProductionDocument } from '@/components/production/ProductionDocumentsList';
import { ProductionDocumentUpload } from '@/components/production/ProductionDocumentUpload';
import { ProductionStatusHistory } from '@/components/production/ProductionStatusHistory';
import { ProductionStatus } from '@/constants/productionStatuses';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface MiningCompany {
  id: string;
  name: string;
}

export function ProductionDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [production, setProduction] = useState<DailyProduction | null>(null);
  const [miningCompany, setMiningCompany] = useState<MiningCompany | null>(null);
  const [statusHistory, setStatusHistory] = useState<StatusHistoryEntry[]>([]);
  const [documents, setDocuments] = useState<ProductionDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDocumentUpload, setShowDocumentUpload] = useState(false);
  const [error, setError] = useState<{ title: string; message: string } | null>(null);
  const [siteCountry, setSiteCountry] = useState<string>('Guinée');
  const [activeTab, setActiveTab] = useState('details');

  // Function to handle back navigation
  const handleBack = () => {
    navigate(-1);
  };

  useEffect(() => {
    if (id) {
      loadProductionDetails();
    }
  }, [id]);

  const loadProductionDetails = async (forceRefresh = false) => {
    if (!id) {
      setError({
        title: 'ID Invalide',
        message: 'L\'identifiant de la production est manquant.'
      });
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Si forceRefresh, attendre un peu pour que le trigger s'exécute
      if (forceRefresh) {
        console.log('🔄 Force refresh - Waiting for trigger to complete...');
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const prodData = await dailyProductionService.getProductionById(id);

      if (!prodData) {
        setError({
          title: 'Production introuvable',
          message: 'La production demandée n\'existe pas ou a été supprimée.'
        });
        setLoading(false);
        return;
      }

      if (!prodData.status) {
        prodData.status = 'prepared';
      }

      setProduction(prodData);

      // Load status history with direct database query as fallback
      try {
        console.log('📊 Loading status history for production:', id);
        const history = await loadStatusHistory(id);
        console.log('✅ Status history loaded:', history.length, 'entries');
        setStatusHistory(history);
      } catch (historyError) {
        console.warn('Could not load status history:', historyError);
        setStatusHistory([]);
      }

      // Load documents
      try {
        const docsData = await productionDocumentService.listDocuments(id);
        setDocuments(docsData);
      } catch (docsError) {
        console.warn('Could not load documents:', docsError);
        setDocuments([]);
      }

      // Load mining company
      if (prodData.mining_company_id) {
        try {
          const { data: companyData } = await supabase
            .from('mining_companies')
            .select('id, name')
            .eq('id', prodData.mining_company_id)
            .maybeSingle();

          if (companyData) {
            setMiningCompany(companyData);
          }
        } catch (companyError) {
          console.warn('Could not load mining company:', companyError);
        }
      }
    } catch (error: any) {
      console.error('Error loading production details:', error);
      setError({
        title: 'Erreur de chargement',
        message: error.message || 'Impossible de charger les détails de la production. Veuillez réessayer.'
      });
    } finally {
      setLoading(false);
    }
  };

  const loadStatusHistory = async (productionId: string): Promise<StatusHistoryEntry[]> => {
    try {
      // Query unified_status_history table with user email join
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
        .eq('entity_type', 'production')
        .eq('entity_id', productionId)
        .order('changed_at', { ascending: false });

      if (historyError) {
        console.error('Error loading unified status history:', historyError);
        return [];
      }

      if (!historyData || historyData.length === 0) {
        return [];
      }

      // Fetch user emails for each entry
      const historyWithEmails = await Promise.all(
        historyData.map(async (entry) => {
          let userEmail = 'Système';

          if (entry.changed_by) {
            try {
              const { data: userData } = await supabase
                .from('profiles')
                .select('email')
                .eq('id', entry.changed_by)
                .maybeSingle();

              if (userData?.email) {
                userEmail = userData.email;
              }
            } catch (err) {
              console.warn('Could not fetch user email:', err);
            }
          }

          return {
            id: entry.id,
            production_id: entry.entity_id,
            old_status: entry.old_status,
            new_status: entry.new_status,
            changed_by: entry.changed_by || '',
            changed_at: entry.changed_at,
            notes: entry.notes || entry.action_description,
            user_email: userEmail
          } as StatusHistoryEntry;
        })
      );

      return historyWithEmails;
    } catch (error) {
      console.error('Error in loadStatusHistory:', error);
      return [];
    }
  };

  const handleDocumentUpload = async (file: File, documentName: string) => {
    if (!id) return;

    try {
      await productionDocumentService.uploadDocument(id, file, documentName);
      const docsData = await productionDocumentService.listDocuments(id);
      setDocuments(docsData);
      setShowDocumentUpload(false);
    } catch (error: any) {
      setError({
        title: 'Erreur d\'upload',
        message: error.message || 'Impossible de télécharger le document. Veuillez réessayer.'
      });
      throw error;
    }
  };

  const handleDocumentView = async (doc: ProductionDocument) => {
    try {
      const url = await productionDocumentService.getDocumentUrl(doc.file_path);
      window.open(url, '_blank');
    } catch (error: any) {
      setError({
        title: 'Erreur',
        message: error.message || 'Impossible d\'ouvrir le document. Veuillez réessayer.'
      });
    }
  };

  const handleDocumentDownload = async (doc: ProductionDocument) => {
    try {
      await productionDocumentService.downloadDocument(doc);
    } catch (error: any) {
      setError({
        title: 'Erreur de téléchargement',
        message: error.message || 'Impossible de télécharger le document. Veuillez réessayer.'
      });
    }
  };

  const handleDocumentDelete = async (documentId: string) => {
    if (!id) return;

    try {
      await productionDocumentService.deleteDocument(documentId);
      const docsData = await productionDocumentService.listDocuments(id);
      setDocuments(docsData);
    } catch (error: any) {
      setError({
        title: 'Erreur de suppression',
        message: error.message || 'Impossible de supprimer le document. Veuillez réessayer.'
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <MainLayout>
        <Loading />
      </MainLayout>
    );
  }

  if (!production) {
    return (
      <MainLayout>
        <div className="text-center py-12">
          <p className="text-sm text-gray-600">Production introuvable</p>
          <Button onClick={handleBack} className="mt-4" size="sm">
            Retour à la liste
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-4">
        {/* Header - Refined */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleBack}
              size="sm"
              className="text-xs"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
              Retour
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900">
                  Production {production.bar_reference || `KOURO-${production.id.slice(0, 8)}`}
                </h1>
                <ProductionStatusBadge status={production.status as ProductionStatus} size="sm" showIcon />
              </div>
              <p className="text-xs text-gray-600 mt-0.5 flex items-center gap-1.5">
                <Calendar className="w-3 h-3" />
                {formatDate(production.production_date)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => navigate(`/production/daily-production`)}
              variant="outline"
              size="sm"
              className="text-xs"
            >
              <Edit className="w-3.5 h-3.5 mr-1.5" />
              Modifier
            </Button>
          </div>
        </div>

        {/* Workflow Section - Full Width */}
        <ProductionStatusWorkflowEnhanced
          currentStatus={production.status as ProductionStatus}
          statusHistory={statusHistory}
        />

        {/* Tabs Navigation */}
        <Tabs
          tabs={[
            {
              id: 'details',
              label: 'Détails de la Production',
              icon: Package,
            },
            {
              id: 'documents',
              label: 'Documents',
              icon: FileText,
              count: documents.length,
            },
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
        >
          {(currentTab) => (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Left Column - Content based on active tab */}
              <div className="lg:col-span-2 space-y-4">
                {currentTab === 'details' && (
                  <>
                    {/* Production Details Card */}
                    <Card className="p-4">
                <h3 className="text-xs font-semibold text-gray-700 mb-3 uppercase tracking-wide">
                  Informations Générales
                </h3>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-start gap-2">
                  <Calendar className="w-4 h-4 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-600">Date de Production</p>
                    <p className="text-sm font-medium text-gray-900">
                      {formatDate(production.production_date)}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <Building className="w-4 h-4 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-600">Mining Company</p>
                    <p className="text-sm font-medium text-gray-900">
                      {miningCompany?.name || 'Kourousa'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <Package className="w-4 h-4 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-gray-600">Bar Reference</p>
                    <p className="text-sm font-medium text-gray-900 font-mono">
                      {production.bar_reference || 'KOURO-2511-1000'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2 col-span-2">
                  <TrendingUp className="w-4 h-4 text-gray-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs text-gray-600 mb-1">Composition</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded">
                        OR: {production.estimated_fineness_pct.toFixed(2)}%
                      </span>
                      {production.estimated_silver_pct !== undefined && production.estimated_silver_pct > 0 && (
                        <span className="text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 px-2 py-1 rounded">
                          Argent: {production.estimated_silver_pct.toFixed(2)}%
                        </span>
                      )}
                      {(() => {
                        const silverPct = production.estimated_silver_pct || 0;
                        const impurityPct = 100 - production.estimated_fineness_pct - silverPct;
                        if (impurityPct > 0) {
                          return (
                            <span className="text-xs font-semibold text-red-700 bg-red-50 border border-red-200 px-2 py-1 rounded">
                              Impuretés: {impurityPct.toFixed(2)}%
                            </span>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200">
                <h3 className="text-xs font-semibold text-gray-900 mb-3">
                  Poids et Conversions
                </h3>

                {/* Bullion Total */}
                <div className="bg-gray-50 rounded-lg p-3 mb-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-700">Bullion Total</p>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900">
                        {production.bullion_grams.toFixed(2)} g
                      </p>
                      <p className="text-xs text-gray-500">
                        {(production.bullion_grams / 31.1035).toFixed(4)} oz
                      </p>
                    </div>
                  </div>
                </div>

                {/* OR - Gold */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-amber-900">OR (Gold)</p>
                    <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                      {production.estimated_fineness_pct.toFixed(2)}%
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-xs text-amber-700">Poids</p>
                      <p className="text-sm font-bold text-amber-900">
                        {production.pure_gold_grams.toFixed(2)} g
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-amber-700">Onces</p>
                      <p className="text-sm font-bold text-amber-900">
                        {production.estimated_oz.toFixed(4)} oz
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-amber-200">
                    <p className="text-xs text-amber-700">
                      Calcul: {production.bullion_grams.toFixed(2)} g × {production.estimated_fineness_pct.toFixed(2)}% = {production.pure_gold_grams.toFixed(2)} g
                    </p>
                  </div>
                </div>

                {/* Argent - Silver */}
                {production.estimated_silver_pct !== undefined && production.estimated_silver_pct > 0 && (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-slate-900">Argent (Silver)</p>
                      <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                        {production.estimated_silver_pct.toFixed(2)}%
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-xs text-slate-700">Poids</p>
                        <p className="text-sm font-bold text-slate-900">
                          {((production.bullion_grams * production.estimated_silver_pct) / 100).toFixed(2)} g
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-700">Onces</p>
                        <p className="text-sm font-bold text-slate-900">
                          {(((production.bullion_grams * production.estimated_silver_pct) / 100) / 31.1035).toFixed(4)} oz
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-slate-200">
                      <p className="text-xs text-slate-700">
                        Calcul: {production.bullion_grams.toFixed(2)} g × {production.estimated_silver_pct.toFixed(2)}% = {((production.bullion_grams * production.estimated_silver_pct) / 100).toFixed(2)} g
                      </p>
                    </div>
                  </div>
                )}

                {/* Impuretés */}
                {(() => {
                  const silverPct = production.estimated_silver_pct || 0;
                  const impurityPct = 100 - production.estimated_fineness_pct - silverPct;

                  if (impurityPct > 0) {
                    return (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold text-red-900">Impuretés</p>
                          <span className="text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded">
                            {impurityPct.toFixed(2)}%
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <p className="text-xs text-red-700">Poids</p>
                            <p className="text-sm font-bold text-red-900">
                              {((production.bullion_grams * impurityPct) / 100).toFixed(2)} g
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-red-700">Composition</p>
                            <p className="text-xs text-red-800 mt-1">
                              100% - {production.estimated_fineness_pct.toFixed(2)}% - {silverPct.toFixed(2)}%
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              {production.notes && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <h3 className="text-xs font-semibold text-gray-900 mb-1">Notes</h3>
                  <p className="text-xs text-gray-700 whitespace-pre-wrap">
                    {production.notes}
                  </p>
                </div>
              )}
              </Card>

                    {/* Status Action Button */}
                    <ProductionStatusWorkflow
                      productionId={production.id}
                      currentStatus={production.status as ProductionStatus}
                      production={{
                        id: production.id,
                        bar_reference: production.bar_reference,
                        production_date: production.production_date,
                        bullion_grams: production.bullion_grams,
                        estimated_fineness_pct: production.estimated_fineness_pct,
                        pure_gold_grams: production.pure_gold_grams,
                        estimated_oz: production.estimated_oz,
                        estimated_silver_pct: production.estimated_silver_pct,
                        mining_company_name: miningCompany?.name,
                        site_country: siteCountry
                      }}
                      userEmail={user?.email}
                      onStatusChanged={() => loadProductionDetails(true)}
                      compactButton
                    />
                  </>
                )}

                {currentTab === 'documents' && (
                  <>
                    {/* Documents Card */}
                    <Card className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                          Documents Attachés
                        </h3>
                        <Button
                          onClick={() => setShowDocumentUpload(true)}
                          size="sm"
                          className="bg-emerald-600 hover:bg-emerald-700 text-xs"
                        >
                          Ajouter
                        </Button>
                      </div>

                      <ProductionDocumentsList
                        documents={documents}
                        onView={handleDocumentView}
                        onDownload={handleDocumentDownload}
                        onDelete={handleDocumentDelete}
                        canDelete={true}
                      />
                    </Card>
                  </>
                )}
              </div>

              {/* Right Column - History */}
              <div className="space-y-4">
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-200">
                    <History className="w-4 h-4 text-blue-600" />
                    <h2 className="text-sm font-semibold text-gray-900">
                      Historique des Changements
                    </h2>
                  </div>

                  <ProductionStatusHistory
                    history={statusHistory}
                    siteCountry={siteCountry}
                  />
                </Card>
              </div>
            </div>
          )}
        </Tabs>
      </div>

      {/* Document Upload Modal */}
      <ProductionDocumentUpload
        isOpen={showDocumentUpload}
        onClose={() => setShowDocumentUpload(false)}
        onUpload={handleDocumentUpload}
      />

      {/* Error Dialog */}
      <ErrorDialog
        isOpen={!!error}
        onClose={() => setError(null)}
        title={error?.title}
        message={error?.message || ''}
      />
    </MainLayout>
  );
}
