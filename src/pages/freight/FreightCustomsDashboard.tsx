import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, Eye, Package } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Loading } from '@/components/ui/Loading';
import { FreightStatusBadge } from '@/components/freight/FreightStatusBadge';
import { freightCustomsService, FreightCustomsOperation, FreightCustomsStatus } from '@/services/freightCustomsService';
import { useNotification } from '@/contexts/NotificationContext';

export default function FreightCustomsDashboard() {
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const [operations, setOperations] = useState<FreightCustomsOperation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<FreightCustomsStatus | 'all'>('all');

  useEffect(() => {
    loadOperations();
  }, []);

  const loadOperations = async () => {
    try {
      setLoading(true);
      const data = await freightCustomsService.listOperations();
      setOperations(data);
    } catch (error: any) {
      showNotification('error', 'Erreur lors du chargement des opérations: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredOperations = operations.filter(op => {
    const matchesSearch =
      op.reference_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      op.shipping_preparation?.reference_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      op.awb_number?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || op.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleViewDetails = (id: string) => {
    navigate(`/freight-customs/${id}`);
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
          <h1 className="text-2xl font-bold text-gray-900">Freight & Customs</h1>
          <p className="text-sm text-gray-600 mt-1">
            Gestion des opérations douanières et transport
          </p>
        </div>
        <Button
          onClick={() => navigate('/freight-customs/create')}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nouvelle Opération
        </Button>
      </div>

      {/* Filtres et Recherche */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Rechercher par référence, AWB..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as FreightCustomsStatus | 'all')}
          >
            <option value="all">Tous les statuts</option>
            <option value="customs_pending">En Attente Douane</option>
            <option value="customs_approved">Approuvé Douane</option>
            <option value="ready_for_transport">Prêt Transport</option>
            <option value="shipped_to_refinery">Expédié</option>
          </Select>
          <div className="flex items-center text-sm text-gray-600">
            <Filter className="w-4 h-4 mr-2" />
            {filteredOperations.length} opération(s) trouvée(s)
          </div>
        </div>
      </Card>

      {/* Tableau des Opérations */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-blue-700 to-indigo-700 text-white">
              <tr>
                <th className="px-3 py-2.5 text-left text-[10px] font-medium uppercase tracking-wide whitespace-nowrap">
                  Référence FC
                </th>
                <th className="px-3 py-2.5 text-left text-[10px] font-medium uppercase tracking-wide whitespace-nowrap">
                  N° Expédition
                </th>
                <th className="px-3 py-2.5 text-left text-[10px] font-medium uppercase tracking-wide whitespace-nowrap">
                  Société Minière
                </th>
                <th className="px-3 py-2.5 text-right text-[10px] font-medium uppercase tracking-wide whitespace-nowrap">
                  Poids Total (g)
                </th>
                <th className="px-3 py-2.5 text-right text-[10px] font-medium uppercase tracking-wide whitespace-nowrap">
                  Poids Total (oz)
                </th>
                <th className="px-3 py-2.5 text-left text-[10px] font-medium uppercase tracking-wide whitespace-nowrap">
                  AWB #
                </th>
                <th className="px-3 py-2.5 text-left text-[10px] font-medium uppercase tracking-wide whitespace-nowrap">
                  Statut
                </th>
                <th className="px-3 py-2.5 text-center text-[10px] font-medium uppercase tracking-wide whitespace-nowrap">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filteredOperations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-12 text-center">
                    <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">Aucune opération trouvée</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Les expéditions avec statut "Expédié" apparaîtront ici
                    </p>
                  </td>
                </tr>
              ) : (
                filteredOperations.map((operation) => (
                  <tr
                    key={operation.id}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className="text-xs font-mono text-blue-700 font-medium">
                        {operation.reference_number}
                      </span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className="text-xs text-gray-900">
                        {operation.shipping_preparation?.reference_number || '-'}
                      </span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className="text-xs text-gray-700">
                        {operation.shipping_preparation?.mining_companies?.name || '-'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      <span className="text-xs text-gray-900">
                        {operation.shipping_preparation?.total_weight_grams?.toLocaleString('fr-FR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        }) || '-'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      <span className="text-xs font-medium text-emerald-700">
                        {operation.shipping_preparation?.total_weight_oz?.toLocaleString('fr-FR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        }) || '-'}
                      </span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className="text-xs font-mono text-gray-700">
                        {operation.awb_number || '-'}
                      </span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <FreightStatusBadge status={operation.status} size="sm" />
                    </td>
                    <td className="px-3 py-3 text-center whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewDetails(operation.id)}
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Voir
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4 border-l-4 border-l-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 font-medium">En Attente</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {operations.filter(op => op.status === 'customs_pending').length}
              </p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
              <Package className="w-6 h-6 text-yellow-700" />
            </div>
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 font-medium">Approuvés</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {operations.filter(op => op.status === 'customs_approved').length}
              </p>
            </div>
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
              <Package className="w-6 h-6 text-emerald-700" />
            </div>
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 font-medium">Prêt Transport</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {operations.filter(op => op.status === 'ready_for_transport').length}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Package className="w-6 h-6 text-blue-700" />
            </div>
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-l-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-600 font-medium">Expédiés</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {operations.filter(op => op.status === 'shipped_to_refinery').length}
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
              <Package className="w-6 h-6 text-purple-700" />
            </div>
          </div>
        </Card>
      </div>
      </div>
    </MainLayout>
  );
}
