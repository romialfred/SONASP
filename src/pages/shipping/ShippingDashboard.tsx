import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Plus, TrendingUp, Box, Clock, CheckCircle, FileText } from 'lucide-react';
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
    shipped: preparations.filter(p => p.status === 'shipped' || p.status === 'validated_for_refinery').length,
    totalWeight: preparations.reduce((sum, p) => sum + (p.total_net_weight_grams || 0), 0),
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
      prepared: 'bg-blue-50 text-blue-700 border-blue-200',
      validated_for_refinery: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      shipped: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    };
    const labels = {
      pending: 'En attente',
      prepared: 'Préparé',
      validated_for_refinery: 'Expédié',
      shipped: 'Expédié',
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium border ${styles[status as keyof typeof styles] || 'bg-slate-50 text-slate-700 border-slate-200'}`}>
        {labels[status as keyof typeof labels] || status}
      </span>
    );
  };

  const getStatusIcon = (status: string) => {
    const iconClass = "w-3.5 h-3.5";
    switch (status) {
      case 'pending': return <Clock className={`${iconClass} text-yellow-600`} />;
      case 'prepared': return <Box className={`${iconClass} text-blue-600`} />;
      case 'validated_for_refinery':
      case 'shipped': return <CheckCircle className={`${iconClass} text-emerald-600`} />;
      default: return <Package className={`${iconClass} text-slate-600`} />;
    }
  };

  const handleRowClick = (prepId: string) => {
    navigate(`/shipping/preparation/${prepId}`);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl shadow-sm">
              <Package className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Shipping Preparation</h1>
              <p className="text-sm text-slate-500">Gérez vos expéditions d'or</p>
            </div>
          </div>
          <Button
            onClick={() => navigate('/shipping/preparation/new')}
            className="gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-sm"
            size="sm"
          >
            <Plus className="w-4 h-4" />
            Nouvelle Expédition
          </Button>
        </div>

        {/* Stats Cards - Compact Design */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {/* Total */}
          <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50/50 to-slate-100/30 p-4">
            <div className="absolute top-0 right-0 w-24 h-24 bg-slate-400/5 rounded-full -mr-12 -mt-12" />
            <div className="relative flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Total</div>
                <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
              </div>
              <div className="p-2 bg-slate-500/10 rounded-lg">
                <FileText className="w-5 h-5 text-slate-600" />
              </div>
            </div>
          </div>

          {/* En Attente */}
          <div className="relative overflow-hidden rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50/50 to-yellow-50/30 p-4">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-400/5 rounded-full -mr-12 -mt-12" />
            <div className="relative flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-amber-600 uppercase tracking-wide mb-1">En Attente</div>
                <div className="text-2xl font-bold text-amber-900">{stats.pending}</div>
              </div>
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <Clock className="w-5 h-5 text-amber-600" />
              </div>
            </div>
          </div>

          {/* Préparés */}
          <div className="relative overflow-hidden rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50/50 to-cyan-50/30 p-4">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-400/5 rounded-full -mr-12 -mt-12" />
            <div className="relative flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-blue-600 uppercase tracking-wide mb-1">Préparés</div>
                <div className="text-2xl font-bold text-blue-900">{stats.prepared}</div>
              </div>
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Box className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </div>

          {/* Expédiés */}
          <div className="relative overflow-hidden rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/50 to-teal-50/30 p-4">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-400/5 rounded-full -mr-12 -mt-12" />
            <div className="relative flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-emerald-600 uppercase tracking-wide mb-1">Expédiés</div>
                <div className="text-2xl font-bold text-emerald-900">{stats.shipped}</div>
              </div>
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              </div>
            </div>
          </div>

          {/* Poids Total */}
          <div className="relative overflow-hidden rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50/50 to-purple-50/30 p-4">
            <div className="absolute top-0 right-0 w-24 h-24 bg-violet-400/5 rounded-full -mr-12 -mt-12" />
            <div className="relative flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-violet-600 uppercase tracking-wide mb-1">Poids Total</div>
                <div className="text-xl font-bold text-violet-900">
                  {(stats.totalWeight / 1000).toFixed(2)}
                  <span className="text-sm font-normal text-violet-600 ml-1">kg</span>
                </div>
              </div>
              <div className="p-2 bg-violet-500/10 rounded-lg">
                <TrendingUp className="w-5 h-5 text-violet-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Recent Preparations Table */}
        <Card className="overflow-hidden border-slate-200">
          <div className="bg-slate-50 px-6 py-3.5 border-b border-slate-200">
            <h2 className="text-base font-semibold text-slate-900">Expéditions Récentes</h2>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-slate-200 border-t-amber-500"></div>
              <p className="text-slate-600 mt-4 text-sm">Chargement...</p>
            </div>
          ) : preparations.length === 0 ? (
            <div className="p-12 text-center">
              <Package className="w-14 h-14 text-slate-300 mx-auto mb-4" />
              <h3 className="text-base font-semibold text-slate-900 mb-2">Aucune Expédition</h3>
              <p className="text-sm text-slate-600 mb-6">Commencez par créer votre première expédition</p>
              <Button
                onClick={() => navigate('/shipping/preparation/new')}
                className="gap-2"
                size="sm"
              >
                <Plus className="w-4 h-4" />
                Nouvelle Expédition
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                      Statut
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                      Expedition Lot
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                      Seal Number
                    </th>
                    <th className="px-4 py-2.5 text-center text-xs font-medium text-slate-600 uppercase tracking-wider">
                      Boxes
                    </th>
                    <th className="px-4 py-2.5 text-right text-xs font-medium text-slate-600 uppercase tracking-wider">
                      Net Weight (g)
                    </th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-slate-600 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-4 py-2.5 text-center text-xs font-medium text-slate-600 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {preparations.map((prep) => (
                    <tr
                      key={prep.id}
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => handleRowClick(prep.id)}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(prep.status)}
                          {getStatusBadge(prep.status)}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-slate-900 font-mono">
                          {prep.expedition_lot_number || 'N/A'}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-slate-700 font-mono">{prep.seal_number || '-'}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <div className="text-sm text-slate-900">{prep.total_boxes || 0}</div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <div className="text-sm text-slate-900 font-mono">
                          {prep.total_net_weight_grams?.toFixed(2) || '0.00'}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm text-slate-900">
                          {new Date(prep.created_at).toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                          })}
                        </div>
                        <div className="text-xs text-slate-500">
                          {new Date(prep.created_at).toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/shipping/preparation/${prep.id}`);
                          }}
                          variant="outline"
                          size="sm"
                          className="text-xs hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700"
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
