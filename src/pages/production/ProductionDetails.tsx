import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, Calendar, Building, Package, TrendingUp, FileText, History } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Loading } from '@/components/ui/Loading';
import { ErrorDialog } from '@/components/ui/ErrorDialog';
import { dailyProductionService, DailyProduction } from '@/services/dailyProductionService';
import { productionStatusService, StatusHistoryEntry } from '@/services/productionStatusService';
import { productionDocumentService } from '@/services/productionDocumentService';
import { ProductionStatusBadge } from '@/components/production/ProductionStatusBadge';
import { ProductionStatusWorkflow } from '@/components/production/ProductionStatusWorkflow';
import { ProductionDocumentsList, ProductionDocument } from '@/components/production/ProductionDocumentsList';
import { ProductionDocumentUpload } from '@/components/production/ProductionDocumentUpload';
import { ProductionStatus } from '@/constants/productionStatuses';
import { supabase } from '@/lib/supabase';

interface MiningCompany {
  id: string;
  name: string;
}

export function ProductionDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [production, setProduction] = useState<DailyProduction | null>(null);
  const [miningCompany, setMiningCompany] = useState<MiningCompany | null>(null);
  const [statusHistory, setStatusHistory] = useState<StatusHistoryEntry[]>([]);
  const [documents, setDocuments] = useState<ProductionDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDocumentUpload, setShowDocumentUpload] = useState(false);
  const [error, setError] = useState<{ title: string; message: string } | null>(null);

  useEffect(() => {
    if (id) {
      loadProductionDetails();
    }
  }, [id]);

  const loadProductionDetails = async () => {
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

      // Load production data first
      const prodData = await dailyProductionService.getProductionById(id);

      if (!prodData) {
        setError({
          title: 'Production introuvable',
          message: 'La production demandée n\'existe pas ou a été supprimée.'
        });
        setLoading(false);
        return;
      }

      // Ensure status exists with default value
      if (!prodData.status) {
        prodData.status = 'prepared';
      }

      setProduction(prodData);

      // Load additional data (non-blocking)
      const [historyData, docsData] = await Promise.allSettled([
        productionStatusService.getStatusHistory(id),
        productionDocumentService.listDocuments(id)
      ]);

      // Set status history (default to empty array if failed)
      setStatusHistory(
        historyData.status === 'fulfilled' ? historyData.value : []
      );

      // Set documents (default to empty array if failed)
      setDocuments(
        docsData.status === 'fulfilled' ? docsData.value : []
      );

      // Load mining company if available
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
          // Non-critical, continue without company data
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

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
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
          <p className="text-gray-600">Production introuvable</p>
          <Button onClick={() => navigate('/production/daily-production')} className="mt-4">
            Retour à la liste
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => navigate('/production/daily-production')}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Production {production.bar_reference || `#${production.id.slice(0, 8)}`}
              </h1>
              <p className="text-gray-600 mt-1">
                {formatDate(production.production_date)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ProductionStatusBadge status={production.status as ProductionStatus} size="lg" showIcon />
            <Button
              onClick={() => navigate(`/production/daily-production`)}
              variant="outline"
            >
              <Edit className="w-4 h-4 mr-2" />
              Modifier
            </Button>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Production Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Production Details Card */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Détails de Production
              </h2>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-600">Date de Production</p>
                    <p className="text-base font-medium text-gray-900">
                      {formatDate(production.production_date)}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Building className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-600">Mining Company</p>
                    <p className="text-base font-medium text-gray-900">
                      {miningCompany?.name || 'N/A'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Package className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-600">Bar Reference</p>
                    <p className="text-base font-medium text-gray-900 font-mono">
                      {production.bar_reference || 'N/A'}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <TrendingUp className="w-5 h-5 text-gray-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-600">Finesse Estimée</p>
                    <p className="text-base font-medium text-gray-900">
                      {production.estimated_fineness_pct.toFixed(2)}%
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">
                  Poids et Conversions
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-600">Bullion</p>
                    <p className="text-lg font-bold text-gray-900">
                      {production.bullion_grams.toFixed(2)} g
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {(production.bullion_grams / 31.1035).toFixed(2)} oz
                    </p>
                  </div>

                  <div className="bg-blue-50 rounded-lg p-3">
                    <p className="text-xs text-blue-700">Pure Gold</p>
                    <p className="text-lg font-bold text-blue-900">
                      {production.pure_gold_grams.toFixed(2)} g
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                      {production.estimated_oz.toFixed(4)} oz
                    </p>
                  </div>

                  <div className="bg-emerald-50 rounded-lg p-3 col-span-2">
                    <p className="text-xs text-emerald-700">Calcul</p>
                    <p className="text-sm text-emerald-900 mt-1">
                      {production.bullion_grams.toFixed(2)} g × {production.estimated_fineness_pct.toFixed(2)}% = {production.pure_gold_grams.toFixed(2)} g
                    </p>
                  </div>
                </div>
              </div>

              {production.notes && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">Notes</h3>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {production.notes}
                  </p>
                </div>
              )}
            </Card>

            {/* Status Workflow Card */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Workflow de Statut
              </h2>
              <ProductionStatusWorkflow
                productionId={production.id}
                currentStatus={production.status as ProductionStatus}
                onStatusChanged={loadProductionDetails}
              />
            </Card>

            {/* Documents Card */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-gray-600" />
                  <h2 className="text-lg font-semibold text-gray-900">
                    Documents Attachés
                  </h2>
                  <span className="text-sm text-gray-500">({documents.length})</span>
                </div>
                <Button
                  onClick={() => setShowDocumentUpload(true)}
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700"
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
          </div>

          {/* Right Column - History */}
          <div className="space-y-6">
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <History className="w-5 h-5 text-gray-600" />
                <h2 className="text-lg font-semibold text-gray-900">
                  Historique des Changements
                </h2>
              </div>

              <div className="space-y-3">
                {statusHistory.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">
                    Aucun changement enregistré
                  </p>
                ) : (
                  statusHistory.map((entry) => (
                    <div
                      key={entry.id}
                      className="border-l-2 border-gray-300 pl-4 pb-3 relative"
                    >
                      <div className="absolute -left-[5px] top-0 w-2 h-2 rounded-full bg-emerald-500" />

                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          {entry.old_status && (
                            <>
                              <ProductionStatusBadge
                                status={entry.old_status as ProductionStatus}
                                size="sm"
                              />
                              <span className="text-gray-400">→</span>
                            </>
                          )}
                          <ProductionStatusBadge
                            status={entry.new_status as ProductionStatus}
                            size="sm"
                          />
                        </div>
                      </div>

                      <p className="text-xs text-gray-600 mb-1">
                        {formatDateTime(entry.changed_at)}
                      </p>

                      {entry.user_email && (
                        <p className="text-xs text-gray-500">
                          Par: {entry.user_email}
                        </p>
                      )}

                      {entry.notes && (
                        <p className="text-sm text-gray-700 mt-2 bg-gray-50 rounded p-2">
                          {entry.notes}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </div>
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
