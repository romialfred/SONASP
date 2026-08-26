import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Flame, CheckCircle2, TrendingUp, AlertCircle, Archive, ArrowRight, FileSpreadsheet, Columns } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loading } from '@/components/ui/Loading';
import { supabase } from '@/lib/supabase';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { useNotification } from '@/contexts/NotificationContext';
import { formatWeightGrams, formatWeightOunces } from '@/utils/numberUtils';
import { freightShipmentService, FreightShipmentStatus } from '@/services/freightShipmentService';
import { RefiningStatusChangeModal } from '@/components/refining/RefiningStatusChangeModal';
import { RefiningFilters, FilterValues } from '@/components/refining/RefiningFilters';
import { ColumnSelectorModal, AVAILABLE_COLUMNS } from '@/components/refining/ColumnSelectorModal';
import { exportToExcel, exportToCSV } from '@/services/refiningExportService';

interface FreightShipment {
  id: string;
  reference_number: string;
  status: FreightShipmentStatus;
  total_pure_gold_grams: number | null;
  total_pure_gold_oz: number | null;
  total_pure_silver_grams: number;
  gold_price_usd_per_oz: number;
  total_value_usd: number;
  created_at: string;
  approved_at: string | null;
  shipped_at: string | null;
  received_at: string | null;
  processing_started_at?: string | null;
  processed_at?: string | null;
  stocked_at?: string | null;
  refining_notes?: string | null;
  destination_refinery?: {
    id: string;
    name: string;
  };
  mining_company?: {
    id: string;
    name: string;
  };
}

export function RefiningProcess() {
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotification();
  const [loading, setLoading] = useState(true);
  const [shipments, setShipments] = useState<FreightShipment[]>([]);
  const [selectedShipment, setSelectedShipment] = useState<FreightShipment | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [filters, setFilters] = useState<FilterValues>({
    search: '',
    status: 'all',
    refineryId: '',
    miningCompanyId: '',
    datePreset: 'all',
    dateFrom: '',
    dateTo: ''
  });
  const [isColumnSelectorOpen, setIsColumnSelectorOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(
    AVAILABLE_COLUMNS.filter(col => col.defaultVisible).map(col => col.id)
  );

  useEffect(() => {
    fetchShipments();
  }, []);

  useAutoRefresh({
    enabled: true,
    onRefresh: () => {
      fetchShipments();
    },
  });

  async function fetchShipments() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('freight_shipments')
        .select(`
          *,
          destination_refinery:refineries!freight_shipments_destination_refinery_id_fkey(id, name)
        `)
        .in('status', ['received_at_refinery', 'processing', 'processed', 'in_stock'])
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching shipments:', error);
        showError('Erreur', 'Impossible de charger les expéditions');
      } else {
        // Enrichir avec les données de mining_company depuis les productions
        const enrichedData = await Promise.all((data || []).map(async (shipment) => {
          const { data: productions } = await supabase
            .from('freight_shipment_productions')
            .select(`
              production_id,
              daily_production!inner(mining_company_id, mining_companies(id, name))
            `)
            .eq('freight_shipment_id', shipment.id)
            .limit(1)
            .single();

          return {
            ...shipment,
            mining_company: productions?.daily_production?.mining_companies || null
          };
        }));

        setShipments(enrichedData);
      }
    } catch (error) {
      console.error('Error:', error);
      showError('Erreur', 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  }

  // Appliquer les filtres
  const filteredShipments = useMemo(() => {
    return shipments.filter(shipment => {
      // Recherche textuelle
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesSearch =
          shipment.reference_number.toLowerCase().includes(searchLower) ||
          shipment.mining_company?.name?.toLowerCase().includes(searchLower) ||
          shipment.destination_refinery?.name?.toLowerCase().includes(searchLower);

        if (!matchesSearch) return false;
      }

      // Filtre par statut
      if (filters.status !== 'all' && shipment.status !== filters.status) {
        return false;
      }

      // Filtre par raffinerie
      if (filters.refineryId && shipment.destination_refinery?.id !== filters.refineryId) {
        return false;
      }

      // Filtre par compagnie minière
      if (filters.miningCompanyId && shipment.mining_company?.id !== filters.miningCompanyId) {
        return false;
      }

      // Filtre par date
      if (filters.dateFrom) {
        const shipmentDate = new Date(shipment.created_at);
        const fromDate = new Date(filters.dateFrom);
        if (shipmentDate < fromDate) return false;
      }

      if (filters.dateTo) {
        const shipmentDate = new Date(shipment.created_at);
        const toDate = new Date(filters.dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (shipmentDate > toDate) return false;
      }

      return true;
    });
  }, [shipments, filters]);

  // Compter les filtres actifs
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filters.status !== 'all') count++;
    if (filters.refineryId) count++;
    if (filters.miningCompanyId) count++;
    if (filters.datePreset !== 'all') count++;
    return count;
  }, [filters]);

  // Calcul des métriques sur les données filtrées
  const receivedCount = filteredShipments.filter(s => s.status === 'received_at_refinery').length;
  const processingCount = filteredShipments.filter(s => s.status === 'processing').length;
  const processedCount = filteredShipments.filter(s => s.status === 'processed').length;
  const inStockCount = filteredShipments.filter(s => s.status === 'in_stock').length;

  const totalGoldOz = filteredShipments.reduce((sum, s) => sum + (s.total_pure_gold_oz || 0), 0);

  const getStatusBadge = (status: FreightShipmentStatus) => {
    const statusConfig = {
      received_at_refinery: {
        label: 'Reçu',
        className: 'bg-blue-100 text-blue-800',
        icon: Package
      },
      processing: {
        label: 'En Raffinage',
        className: 'bg-orange-100 text-orange-800',
        icon: Flame
      },
      processed: {
        label: 'Raffiné',
        className: 'bg-green-100 text-green-800',
        icon: CheckCircle2
      },
      in_stock: {
        label: 'En Stock',
        className: 'bg-teal-100 text-teal-800',
        icon: Archive
      }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || {
      label: status,
      className: 'bg-gray-100 text-gray-800',
      icon: Package
    };

    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.className}`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </span>
    );
  };

  const handleChangeStatus = (shipment: FreightShipment) => {
    setSelectedShipment(shipment);
    setIsModalOpen(true);
  };

  const handleConfirmStatusChange = async (newStatus: FreightShipmentStatus, notes: string) => {
    if (!selectedShipment) return;

    try {
      setChangingStatus(true);
      await freightShipmentService.updateStatus(selectedShipment.id, newStatus, notes);
      showSuccess('Succès', 'Le statut a été mis à jour avec succès');
      setIsModalOpen(false);
      setSelectedShipment(null);
      await fetchShipments();
    } catch (error: any) {
      console.error('Error updating status:', error);
      showError('Erreur', error.message || 'Impossible de mettre à jour le statut');
    } finally {
      setChangingStatus(false);
    }
  };

  const canChangeStatus = (status: FreightShipmentStatus) => {
    return ['received_at_refinery', 'processing', 'processed'].includes(status);
  };

  const handleExport = (selectedColumns: string[], format: 'excel' | 'csv' = 'excel') => {
    setVisibleColumns(selectedColumns);
    if (format === 'csv') {
      exportToCSV(filteredShipments as any, selectedColumns, 'processus_raffinage');
      showSuccess('Export réussi', 'Le fichier CSV a été téléchargé avec succès');
      return;
    }
    exportToExcel(filteredShipments as any, selectedColumns, 'processus_raffinage');
    showSuccess('Export réussi', 'Le fichier Excel a été téléchargé avec succès');
  };

  const handleQuickExportCSV = () => {
    exportToCSV(filteredShipments as any,visibleColumns, 'processus_raffinage');
    showSuccess('Export réussi', 'Le fichier CSV a été téléchargé avec succès');
  };

  return (
    <MainLayout>
      <div className="space-y-6 -mx-6">
        {/* Header */}
        <div className="px-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Processus de Raffinage
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Suivi des expéditions en raffinage
                {filteredShipments.length !== shipments.length && (
                  <span className="ml-2 text-blue-600 font-medium">
                    ({filteredShipments.length} sur {shipments.length} affichées)
                  </span>
                )}
              </p>
            </div>

            {/* Boutons d'export */}
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleQuickExportCSV}
                disabled={filteredShipments.length === 0}
                className="gap-2"
              >
                <FileSpreadsheet className="w-4 h-4" />
                CSV
              </Button>
              <Button
                onClick={() => setIsColumnSelectorOpen(true)}
                disabled={filteredShipments.length === 0}
                className="gap-2 bg-blue-600 hover:bg-blue-700"
              >
                <Columns className="w-4 h-4" />
                Personnaliser Export
              </Button>
            </div>
          </div>
        </div>

        {/* Filtres */}
        <div className="px-6">
          <RefiningFilters
            onFilterChange={setFilters}
            activeFiltersCount={activeFiltersCount}
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 px-6">
            <Loading size="lg" />
          </div>
        ) : (
          <>
            {/* Alert - Éléments en attente */}
            {(receivedCount > 0 || processingCount > 0) && (
              <div className="px-6">
                <div className="bg-orange-50 border-l-4 border-orange-400 p-4 rounded-lg shadow-sm">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-orange-900">
                        {receivedCount > 0 && (
                          <span>{receivedCount} expédition{receivedCount > 1 ? 's' : ''} reçue{receivedCount > 1 ? 's' : ''} en attente de raffinage</span>
                        )}
                        {receivedCount > 0 && processingCount > 0 && (
                          <span> • </span>
                        )}
                        {processingCount > 0 && (
                          <span>{processingCount} expédition{processingCount > 1 ? 's' : ''} en cours de raffinage</span>
                        )}
                      </p>
                      <p className="text-xs text-orange-700 mt-0.5">
                        Ces expéditions nécessitent un suivi et une action
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tuiles KPI */}
            <div className="px-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Reçu */}
                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Package className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-gray-600">Reçu</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {receivedCount}
                      </p>
                      <p className="text-xs text-gray-500">À raffiner</p>
                    </div>
                  </div>
                </Card>

                {/* Raffinés */}
                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-gray-600">Raffinés</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {processedCount}
                      </p>
                      <p className="text-xs text-gray-500">Terminé</p>
                    </div>
                  </div>
                </Card>

                {/* En Stock */}
                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                      <Archive className="w-5 h-5 text-teal-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-gray-600">En Stock</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {inStockCount}
                      </p>
                      <p className="text-xs text-gray-500">Inventaire</p>
                    </div>
                  </div>
                </Card>

                {/* Total Or */}
                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0 w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-amber-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-gray-600">Total Or</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {formatWeightOunces(totalGoldOz)}
                      </p>
                      <p className="text-xs text-gray-500">oz</p>
                    </div>
                  </div>
                </Card>
              </div>
            </div>

            {/* Tableau des Expéditions */}
            <div className="px-6">
              {filteredShipments.length === 0 ? (
                <Card className="p-12">
                  <div className="text-center">
                    <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-lg font-medium text-gray-500">
                      {shipments.length === 0
                        ? 'Aucune expédition en raffinage'
                        : 'Aucune expédition ne correspond aux filtres'}
                    </p>
                    <p className="text-sm text-gray-400 mt-2">
                      {shipments.length === 0
                        ? 'Les expéditions reçues apparaîtront ici'
                        : 'Essayez de modifier vos critères de recherche'}
                    </p>
                  </div>
                </Card>
              ) : (
                <Card>
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Expéditions en Raffinage ({filteredShipments.length})
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 whitespace-nowrap">
                            Numéro d'Expédition
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 whitespace-nowrap">
                            Statut
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 whitespace-nowrap">
                            Compagnie minière
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 whitespace-nowrap">
                            Raffinerie
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 whitespace-nowrap">
                            Or pur (g)
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 whitespace-nowrap">
                            Or pur (oz)
                          </th>
                          <th className="px-6 py-3 text-center text-xs font-semibold text-gray-700 whitespace-nowrap">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {filteredShipments.map((shipment) => (
                          <tr
                            key={shipment.id}
                            onClick={() => navigate(`/freight/shipments/${shipment.id}`)}
                            className="hover:bg-gray-50 cursor-pointer transition-colors"
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-sm font-medium text-gray-900">
                                {shipment.reference_number}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {getStatusBadge(shipment.status)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-sm text-gray-900">
                                {shipment.mining_company?.name || '-'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-sm text-gray-900">
                                {shipment.destination_refinery?.name || '-'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right">
                              <span className="text-sm font-medium text-amber-700">
                                {formatWeightGrams(shipment.total_pure_gold_grams)}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right">
                              <span className="text-sm font-medium text-amber-700">
                                {formatWeightOunces(shipment.total_pure_gold_oz)}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-center gap-2">
                                {canChangeStatus(shipment.status) && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleChangeStatus(shipment)}
                                    className="text-green-600 hover:text-green-800"
                                  >
                                    <ArrowRight className="w-4 h-4" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </div>
          </>
        )}
      </div>

      {/* Modal de changement de statut */}
      {selectedShipment && (
        <RefiningStatusChangeModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setSelectedShipment(null);
          }}
          onConfirm={handleConfirmStatusChange}
          currentStatus={selectedShipment.status}
          shipmentReference={selectedShipment.reference_number}
          totalGoldOz={selectedShipment.total_pure_gold_oz}
          totalValueUsd={selectedShipment.total_value_usd}
          loading={changingStatus}
        />
      )}

      {/* Modal de sélection de colonnes */}
      <ColumnSelectorModal
        isOpen={isColumnSelectorOpen}
        onClose={() => setIsColumnSelectorOpen(false)}
        onConfirm={handleExport}
        currentColumns={visibleColumns}
        previewData={filteredShipments}
      />
    </MainLayout>
  );
}
