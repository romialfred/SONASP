import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Plus, TrendingUp, Box, Clock, CheckCircle, AlertCircle, FileText } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { shippingPreparationService, ShippingPreparation } from '@/services/shippingPreparationService';

export default function ShippingDashboard() {
  const navigate = useNavigate();
  const [preparations, setPreparations] = useState<ShippingPreparation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await shippingPreparationService.getAllPreparations();
      setPreparations(data);
    } catch (error) {
      console.error('Error loading preparations:', error);
    } finally {
      setLoading(false);
    }
  };

  const stats = {
    total: preparations.length,
    pending: preparations.filter(p => p.status === 'pending').length,
    prepared: preparations.filter(p => p.status === 'prepared').length,
    validated_for_refinery: preparations.filter(p => p.status === 'validated_for_refinery').length,
    totalWeight: preparations.reduce((sum, p) => sum + (p.total_net_weight_grams || 0), 0),
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      prepared: 'bg-blue-100 text-blue-800 border-blue-300',
      validated_for_refinery: 'bg-green-100 text-green-800 border-green-300',
    };
    const labels = {
      pending: 'En attente',
      prepared: 'Préparé',
      validated_for_refinery: 'Validé pour Raffinerie',
    };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'prepared': return <Box className="w-4 h-4 text-blue-600" />;
      case 'validated_for_refinery': return <CheckCircle className="w-4 h-4 text-green-600" />;
      default: return <AlertCircle className="w-4 h-4 text-gray-600" />;
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between page-header">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-yellow-500 to-amber-600 rounded-lg">
              <Package className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="page-title">Shipping Preparation</h1>
              <p className="page-subtitle">Gérez vos expéditions d'or</p>
            </div>
          </div>
          <Button
            onClick={() => navigate('/shipping/preparation/new')}
            className="gap-2 bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-700 hover:to-amber-700 text-white btn-text-base"
            size="sm"
          >
            <Plus className="w-4 h-4" />
            Nouvelle Expédition
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="metric-card-title text-blue-600">Total</div>
                <div className="metric-card-value text-blue-900">{stats.total}</div>
              </div>
              <div className="p-3 bg-blue-500 rounded-lg">
                <FileText className="w-6 h-6 text-white" />
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-yellow-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="metric-card-title text-yellow-600">En attente</div>
                <div className="metric-card-value text-yellow-900">{stats.pending}</div>
              </div>
              <div className="p-3 bg-yellow-500 rounded-lg">
                <Clock className="w-6 h-6 text-white" />
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="metric-card-title text-blue-600">Préparés</div>
                <div className="metric-card-value text-blue-900">{stats.prepared}</div>
              </div>
              <div className="p-3 bg-blue-500 rounded-lg">
                <Box className="w-6 h-6 text-white" />
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-green-50 to-yellow-50 border-2 border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="metric-card-title text-green-600">Expédiés</div>
                <div className="metric-card-value text-green-900">{stats.shipped}</div>
              </div>
              <div className="p-3 bg-green-500 rounded-lg">
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="metric-card-title text-purple-600">Poids Total</div>
                <div className="text-2xl font-normal text-purple-900 tabular-nums">
                  <span className="number-display">{(stats.totalWeight / 1000).toFixed(2)}</span> <span className="metric-card-unit">kg</span>
                </div>
              </div>
              <div className="p-3 bg-purple-500 rounded-lg">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
            </div>
          </Card>
        </div>

        {/* Recent Preparations */}
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">Expéditions Récentes</h2>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-yellow-500"></div>
              <p className="text-gray-600 mt-4">Chargement...</p>
            </div>
          ) : preparations.length === 0 ? (
            <div className="p-12 text-center">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucune Expédition</h3>
              <p className="text-gray-600 mb-6">Commencez par créer votre première expédition</p>
              <Button
                onClick={() => navigate('/shipping/preparation/new')}
                className="gap-2"
              >
                <Plus className="w-4 h-4" />
                Nouvelle Expédition
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Statut
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Expedition Lot
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Seal Number
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Boxes
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Net Weight (g)
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {preparations.map((prep) => (
                    <tr key={prep.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(prep.status)}
                          {getStatusBadge(prep.status)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-semibold text-gray-900 font-mono">
                          {prep.expedition_lot_number || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-gray-900 font-mono">{prep.seal_number || '-'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="font-semibold text-gray-900">{prep.total_boxes || 0}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="font-semibold text-gray-900">
                          {prep.total_net_weight_grams?.toFixed(2) || '0.00'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {new Date(prep.created_at).toLocaleDateString('fr-FR')}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(prep.created_at).toLocaleTimeString('fr-FR')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <Button
                          onClick={() => navigate(`/shipping/preparation/${prep.id}`)}
                          variant="outline"
                          size="sm"
                          className="hover:bg-yellow-50 hover:border-yellow-500 hover:text-yellow-800"
                        >
                          Voir Détails
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </MainLayout>
  );
}
