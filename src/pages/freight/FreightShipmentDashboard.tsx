import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, Eye, Package, TrendingUp, AlertCircle } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Loading } from '@/components/ui/Loading';
import { freightShipmentService, FreightShipment, FreightShipmentStatus } from '@/services/freightShipmentService';
import { useNotification } from '@/contexts/NotificationContext';

const STATUS_LABELS: Record<FreightShipmentStatus, { label: string; color: string; bgColor: string }> = {
  pending: {
    label: 'En Attente',
    color: 'text-gray-700',
    bgColor: 'bg-gray-100',
  },
  approved: {
    label: 'Approuvé',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
  },
  shipped_to_refinery: {
    label: 'Expédié',
    color: 'text-slate-700',
    bgColor: 'bg-slate-100',
  },
  received_at_refinery: {
    label: 'Reçu',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
  },
};

export default function FreightShipmentDashboard() {
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotification();
  const [shipments, setShipments] = useState<FreightShipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<FreightShipmentStatus | 'all'>('all');

  useEffect(() => {
    loadShipments();
  }, []);

  const loadShipments = async () => {
    try {
      setLoading(true);
      const data = await freightShipmentService.listShipments();
      setShipments(data);
    } catch (error: any) {
      console.error('Erreur chargement:', error);
      showError('Erreur de chargement', error.message || 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  const filteredShipments = shipments.filter((shipment) => {
    const matchesSearch =
      shipment.reference_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      shipment.notes?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || shipment.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleViewDetails = (id: string) => {
    navigate(`/freight/shipments/${id}`);
  };

  // Statistiques
  const stats = {
    total: shipments.length,
    pending: shipments.filter((s) => s.status === 'pending').length,
    approved: shipments.filter((s) => s.status === 'approved').length,
    shipped: shipments.filter((s) => s.status === 'shipped_to_refinery').length,
    received: shipments.filter((s) => s.status === 'received_at_refinery').length,
    totalValue: shipments.reduce((sum, s) => sum + s.total_value_usd, 0),
    totalOz: shipments.reduce((sum, s) => sum + s.total_pure_gold_oz, 0),
  };

  if (loading) {
    return (
      <MainLayout>
        <Loading />
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Invoice & Consignment</h1>
            <p className="text-sm text-gray-600 mt-1">
              Gestion des expéditions internationales et opérations douanières
            </p>
          </div>
          <Button
            onClick={() => navigate('/freight/shipments/create')}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nouvelle Expédition
          </Button>
        </div>

        {/* Alert - Éléments en attente */}
        {stats.pending > 0 && (
          <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-lg shadow-sm">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-blue-900">
                  {stats.pending} expédition{stats.pending > 1 ? 's' : ''} en attente de traitement
                </p>
                <p className="text-xs text-blue-700 mt-0.5">
                  Ces expéditions nécessitent une approbation avant l'envoi à la raffinerie
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Total</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
              </div>
              <Package className="w-8 h-8 text-gray-400" />
            </div>
          </Card>

          <Card className="p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-600 uppercase tracking-wide">En Attente</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{stats.pending}</p>
              </div>
              <Package className="w-8 h-8 text-gray-400" />
            </div>
          </Card>

          <Card className="p-4 border border-blue-200 bg-blue-50/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-700 uppercase tracking-wide">Approuvé</p>
                <p className="text-2xl font-bold text-blue-900 mt-1">{stats.approved}</p>
              </div>
              <Package className="w-8 h-8 text-blue-500" />
            </div>
          </Card>

          <Card className="p-4 border border-slate-200 bg-slate-50/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-700 uppercase tracking-wide">Expédié</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{stats.shipped}</p>
              </div>
              <Package className="w-8 h-8 text-slate-500" />
            </div>
          </Card>

          <Card className="p-4 border border-emerald-200 bg-emerald-50/50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-emerald-700 uppercase tracking-wide">Reçu</p>
                <p className="text-2xl font-bold text-emerald-900 mt-1">{stats.received}</p>
              </div>
              <Package className="w-8 h-8 text-emerald-500" />
            </div>
          </Card>
        </div>

        {/* Value Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-4 border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-amber-700 uppercase tracking-wide font-medium">Or Pur Total</p>
                <p className="text-3xl font-bold text-amber-900 mt-1">{stats.totalOz.toFixed(3)} oz</p>
                <p className="text-xs text-amber-600 mt-1">
                  {(stats.totalOz * 31.1035).toFixed(2)} g
                </p>
              </div>
              <TrendingUp className="w-10 h-10 text-amber-600" />
            </div>
          </Card>

          <Card className="p-4 border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-green-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-emerald-700 uppercase tracking-wide font-medium">Valeur Totale</p>
                <p className="text-3xl font-bold text-emerald-900 mt-1">${stats.totalValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
                <p className="text-xs text-emerald-600 mt-1">USD</p>
              </div>
              <TrendingUp className="w-10 h-10 text-emerald-600" />
            </div>
          </Card>
        </div>

        {/* Filtres et Recherche */}
        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Rechercher par référence..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as FreightShipmentStatus | 'all')}
            >
              <option value="all">Tous les statuts</option>
              <option value="pending">En Attente</option>
              <option value="approved">Approuvé</option>
              <option value="shipped_to_refinery">Expédié</option>
              <option value="received_at_refinery">Reçu</option>
            </Select>
            <div className="flex items-center text-sm text-gray-600">
              <Filter className="w-4 h-4 mr-2" />
              {filteredShipments.length} expédition(s) trouvée(s)
            </div>
          </div>
        </Card>

        {/* Tableau des Expéditions */}
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-100 border-b-2 border-slate-300">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-800 uppercase tracking-wide">
                    Référence
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-800 uppercase tracking-wide">
                    Date
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-800 uppercase tracking-wide">
                    Productions
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-800 uppercase tracking-wide">
                    Or Pur (oz)
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-800 uppercase tracking-wide">
                    Valeur (USD)
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-800 uppercase tracking-wide">
                    Boîtes
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-800 uppercase tracking-wide">
                    Statut
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-800 uppercase tracking-wide">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {filteredShipments.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center">
                      <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-sm text-gray-500">Aucune expédition trouvée</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Créez une nouvelle expédition pour commencer
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredShipments.map((shipment) => {
                    const statusConfig = STATUS_LABELS[shipment.status];
                    return (
                      <tr
                        key={shipment.id}
                        className="hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => handleViewDetails(shipment.id)}
                      >
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {shipment.reference_number}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {new Date(shipment.shipment_date).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="px-4 py-3 text-center text-sm font-medium text-gray-700">
                          {shipment.production_count}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                          {shipment.total_pure_gold_oz.toFixed(3)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-green-700">
                          ${shipment.total_value_usd.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-gray-600">
                          {shipment.number_of_boxes}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig.bgColor} ${statusConfig.color}`}
                          >
                            {statusConfig.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewDetails(shipment.id);
                            }}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}
