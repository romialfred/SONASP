import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Flame, CheckCircle2, TrendingUp, Eye, AlertCircle } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loading } from '@/components/ui/Loading';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { formatWeightGrams, formatWeightOunces } from '@/utils/numberUtils';

interface FreightShipment {
  id: string;
  reference_number: string;
  status: string;
  total_pure_gold_grams: number;
  total_pure_gold_oz: number;
  total_pure_silver_grams: number;
  gold_price_usd_per_oz: number;
  total_value_usd: number;
  created_at: string;
  approved_at: string | null;
  shipped_at: string | null;
  received_at: string | null;
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
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [shipments, setShipments] = useState<FreightShipment[]>([]);

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
          destination_refinery:refineries!freight_shipments_destination_refinery_id_fkey(id, name),
          mining_company:mining_companies(id, name)
        `)
        .in('status', ['approved', 'shipped_to_refinery', 'received_at_refinery'])
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching shipments:', error);
      } else {
        setShipments(data || []);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  }

  // Calcul des métriques
  const approvedCount = shipments.filter(s => s.status === 'approved').length;
  const refiningCount = shipments.filter(s => s.status === 'shipped_to_refinery').length;
  const completedCount = shipments.filter(s => s.status === 'received_at_refinery').length;

  const totalGoldOz = shipments.reduce((sum, s) => sum + (s.total_pure_gold_oz || 0), 0);
  const totalValue = shipments.reduce((sum, s) => sum + (s.total_value_usd || 0), 0);

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      approved: {
        label: 'Approuvé',
        className: 'bg-blue-100 text-blue-800',
        icon: Package
      },
      shipped_to_refinery: {
        label: 'En Raffinage',
        className: 'bg-orange-100 text-orange-800',
        icon: Flame
      },
      received_at_refinery: {
        label: 'Raffiné',
        className: 'bg-green-100 text-green-800',
        icon: CheckCircle2
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
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 px-6">
            <Loading size="lg" />
          </div>
        ) : (
          <>
            {/* Alert - Éléments en attente */}
            {(approvedCount > 0 || refiningCount > 0) && (
              <div className="px-6">
                <div className="bg-orange-50 border-l-4 border-orange-400 p-4 rounded-lg shadow-sm">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-orange-900">
                        {approvedCount > 0 && (
                          <span>{approvedCount} expédition{approvedCount > 1 ? 's' : ''} approuvée{approvedCount > 1 ? 's' : ''} en attente de raffinage</span>
                        )}
                        {approvedCount > 0 && refiningCount > 0 && (
                          <span> • </span>
                        )}
                        {refiningCount > 0 && (
                          <span>{refiningCount} expédition{refiningCount > 1 ? 's' : ''} en cours de raffinage</span>
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Approuvés */}
                <Card className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Package className="w-6 h-6 text-blue-600" />
                    </div>
                  </div>
                  <div className="mt-4">
                    <p className="text-sm font-medium text-gray-600">Approuvés</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">
                      {approvedCount}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Prêt pour raffinage</p>
                  </div>
                </Card>

                {/* En Cours de Raffinage */}
                <Card className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-shrink-0 w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                      <Flame className="w-6 h-6 text-orange-600" />
                    </div>
                  </div>
                  <div className="mt-4">
                    <p className="text-sm font-medium text-gray-600">En Raffinage</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">
                      {refiningCount}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">En cours de traitement</p>
                  </div>
                </Card>

                {/* Raffinés */}
                <Card className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-shrink-0 w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                      <CheckCircle2 className="w-6 h-6 text-green-600" />
                    </div>
                  </div>
                  <div className="mt-4">
                    <p className="text-sm font-medium text-gray-600">Raffinés</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">
                      {completedCount}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Traitement terminé</p>
                  </div>
                </Card>

                {/* Total Or */}
                <Card className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-shrink-0 w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-amber-600" />
                    </div>
                  </div>
                  <div className="mt-4">
                    <p className="text-sm font-medium text-gray-600">Total Or</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">
                      {formatWeightOunces(totalGoldOz)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">oz en traitement</p>
                  </div>
                </Card>

                {/* Valeur Totale */}
                <Card className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-shrink-0 w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-emerald-600" />
                    </div>
                  </div>
                  <div className="mt-4">
                    <p className="text-sm font-medium text-gray-600">Valeur Totale</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      ${(totalValue / 1000000).toFixed(2)}M
                    </p>
                    <p className="text-xs text-gray-500 mt-1">USD en traitement</p>
                  </div>
                </Card>
              </div>
            </div>

            {/* Tableau des Expéditions */}
            <div className="px-6">
              {shipments.length === 0 ? (
                <Card className="p-12">
                  <div className="text-center">
                    <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-lg font-medium text-gray-500">
                      Aucune expédition en raffinage
                    </p>
                    <p className="text-sm text-gray-400 mt-2">
                      Les expéditions approuvées apparaîtront ici
                    </p>
                  </div>
                </Card>
              ) : (
                <Card>
                  <div className="px-6 py-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Expéditions en Raffinage ({shipments.length})
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap">
                            Référence
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap">
                            Statut
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap">
                            Compagnie Minière
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap">
                            Raffinerie
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap">
                            Or Pur (g)
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap">
                            Or Pur (oz)
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap">
                            Valeur (USD)
                          </th>
                          <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider whitespace-nowrap">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {shipments.map((shipment) => (
                          <tr key={shipment.id} className="hover:bg-gray-50">
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
                            <td className="px-6 py-4 whitespace-nowrap text-right">
                              <span className="text-sm font-semibold text-green-700">
                                ${shipment.total_value_usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate(`/freight/shipment/${shipment.id}`)}
                                className="text-blue-600 hover:text-blue-800"
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                Voir
                              </Button>
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
    </MainLayout>
  );
}
