import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Eye,
  Edit2,
  Trash2,
  DollarSign,
  Calendar,
  TrendingUp,
  Clock,
  Coins,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Loading } from '@/components/ui/Loading';
import { artisanGoldSalesService, ArtisanGoldSale } from '@/services/artisanGoldSalesService';
import { useCustomAlert } from '@/hooks/useCustomAlert';
import { CustomAlert } from '@/components/ui/CustomAlert';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  en_attente: { label: 'En Attente', color: 'bg-yellow-100 text-yellow-800' },
  validee: { label: 'Validée', color: 'bg-blue-100 text-blue-800' },
  payee: { label: 'Payée', color: 'bg-green-100 text-green-800' },
  annulee: { label: 'Annulée', color: 'bg-red-100 text-red-800' },
};

const TYPE_OR_LABELS: Record<string, string> = {
  poudre: 'Poudre',
  lingot: 'Lingot',
  pepites: 'Pépites',
  bijoux: 'Bijoux',
  autre: 'Autre',
};

export default function VentesOr() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [ventes, setVentes] = useState<ArtisanGoldSale[]>([]);
  const [filteredVentes, setFilteredVentes] = useState<ArtisanGoldSale[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { alertState, showSuccess, showError, closeAlert } = useCustomAlert();

  useEffect(() => {
    loadVentes();
  }, []);

  useEffect(() => {
    filterVentes();
  }, [searchTerm, statusFilter, ventes]);

  const loadVentes = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await artisanGoldSalesService.getAll();
      setVentes(data || []);
      setFilteredVentes(data || []);
    } catch (err: any) {
      console.error('Error loading ventes:', err);
      const errorMessage = err.message || 'Impossible de charger les ventes d\'or';
      setError(errorMessage);
      showError(errorMessage);
      setVentes([]);
      setFilteredVentes([]);
    } finally {
      setLoading(false);
    }
  };

  const filterVentes = () => {
    let filtered = [...ventes];

    if (searchTerm) {
      filtered = filtered.filter(
        (vente) =>
          vente.numero_recu?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          vente.observations?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter((vente) => vente.statut === statusFilter);
    }

    setFilteredVentes(filtered);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette vente ?')) return;

    try {
      await artisanGoldSalesService.delete(id);
      showSuccess('Vente supprimée avec succès');
      loadVentes();
    } catch (error) {
      showError('Impossible de supprimer la vente');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const getTotalStats = () => {
    return {
      total: filteredVentes.length,
      en_attente: filteredVentes.filter((v) => v.statut === 'en_attente').length,
      validee: filteredVentes.filter((v) => v.statut === 'validee').length,
      payee: filteredVentes.filter((v) => v.statut === 'payee').length,
      montant_total: filteredVentes.reduce((sum, v) => sum + v.montant_total_fcfa, 0),
      quantite_totale: filteredVentes.reduce((sum, v) => sum + v.quantite_grammes, 0),
    };
  };

  const stats = getTotalStats();

  if (loading) {
    return (
      <MainLayout>
        <div className="flex justify-center items-center h-96">
          <Loading />
        </div>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Ventes d'Or des Artisans</h1>
            <p className="text-gray-600 mt-2">
              Gestion de la collecte et des ventes d'or auprès des artisans miniers
            </p>
          </div>
          <Card className="p-8">
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <Coins className="w-16 h-16 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Erreur de chargement</h3>
              <p className="text-gray-600 mb-4">{error}</p>
              <p className="text-sm text-gray-500 mb-4">
                La table des ventes d'or n'existe peut-être pas encore. Veuillez exécuter le script SQL de création.
              </p>
              <Button onClick={loadVentes}>
                Réessayer
              </Button>
            </div>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <CustomAlert {...alertState} onClose={closeAlert} />

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Ventes d'Or des Artisans</h1>
            <p className="text-gray-600 mt-2">
              Gestion de la collecte et des ventes d'or auprès des artisans miniers
            </p>
          </div>
          <Button
            onClick={() => navigate('/artisan-minier/ventes-or/nouvelle')}
            className="flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Nouvelle Vente
          </Button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Ventes</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <DollarSign className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Montant Total</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(stats.montant_total)}
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Quantité Totale</p>
                <p className="text-2xl font-bold text-gray-900">{stats.quantite_totale.toFixed(2)} g</p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-lg">
                <Calendar className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">En Attente</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.en_attente}</p>
              </div>
              <div className="p-3 bg-yellow-50 rounded-lg">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </Card>
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  placeholder="Rechercher par numéro de reçu ou observations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="lg:w-64">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              >
                <option value="all">Tous les statuts</option>
                <option value="en_attente">En Attente</option>
                <option value="validee">Validée</option>
                <option value="payee">Payée</option>
                <option value="annulee">Annulée</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Ventes Table */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Numéro Reçu
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type d'Or
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantité (g)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pureté (K)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Montant Total
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredVentes.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                      Aucune vente trouvée
                    </td>
                  </tr>
                ) : (
                  filteredVentes.map((vente) => (
                    <tr key={vente.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(vente.date_vente)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {vente.numero_recu || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {TYPE_OR_LABELS[vente.type_or] || vente.type_or}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {vente.quantite_grammes.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {vente.purete_karat}K
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                        {formatCurrency(vente.montant_total_fcfa)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            STATUS_LABELS[vente.statut]?.color || 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {STATUS_LABELS[vente.statut]?.label || vente.statut}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => navigate(`/artisan-minier/ventes-or/${vente.id}`)}
                            className="text-blue-600 hover:text-blue-900"
                            title="Voir détails"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() =>
                              navigate(`/artisan-minier/ventes-or/${vente.id}/modifier`)
                            }
                            className="text-emerald-600 hover:text-emerald-900"
                            title="Modifier"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(vente.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Supprimer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}
