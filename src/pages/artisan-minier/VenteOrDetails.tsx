import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Edit2,
  Calendar,
  Coins,
  DollarSign,
  FileText,
  User,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
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

export default function VenteOrDetails() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [vente, setVente] = useState<ArtisanGoldSale | null>(null);
  const { alertState, showError, closeAlert } = useCustomAlert();

  useEffect(() => {
    if (id) {
      loadVente(id);
    }
  }, [id]);

  const loadVente = async (venteId: string) => {
    try {
      setLoading(true);
      const data = await artisanGoldSalesService.getById(venteId);
      if (data) {
        setVente(data);
      } else {
        showError('Vente introuvable');
      }
    } catch (error) {
      showError('Impossible de charger les détails de la vente');
    } finally {
      setLoading(false);
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

  if (loading) {
    return (
      <MainLayout>
        <div className="flex justify-center items-center h-96">
          <Loading />
        </div>
      </MainLayout>
    );
  }

  if (!vente) {
    return (
      <MainLayout>
        <div className="space-y-6">
          <Card className="p-8">
            <div className="text-center">
              <Coins className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Vente introuvable
              </h3>
              <p className="text-gray-600 mb-4">
                Cette vente n'existe pas ou a été supprimée.
              </p>
              <Button onClick={() => navigate('/artisan-minier/ventes-or')}>
                Retour à la liste
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => navigate('/artisan-minier/ventes-or')}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Détails de la Vente
              </h1>
              <p className="text-gray-600 mt-2">
                {vente.numero_recu || `Vente ${id}`}
              </p>
            </div>
          </div>
          <Button onClick={() => navigate(`/artisan-minier/ventes-or/${id}/modifier`)}>
            <Edit2 className="w-5 h-5 mr-2" />
            Modifier
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Informations de la Vente
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    <Calendar className="w-4 h-4 inline mr-2" />
                    Date de Vente
                  </label>
                  <p className="text-base font-medium text-gray-900">
                    {formatDate(vente.date_vente)}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    <FileText className="w-4 h-4 inline mr-2" />
                    Numéro de Reçu
                  </label>
                  <p className="text-base font-medium text-gray-900">
                    {vente.numero_recu || '-'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    <Coins className="w-4 h-4 inline mr-2" />
                    Type d'Or
                  </label>
                  <p className="text-base font-medium text-gray-900">
                    {TYPE_OR_LABELS[vente.type_or] || vente.type_or}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Quantité
                  </label>
                  <p className="text-base font-medium text-gray-900">
                    {vente.quantite_grammes.toFixed(2)} grammes
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Pureté
                  </label>
                  <p className="text-base font-medium text-gray-900">
                    {vente.purete_karat} Karat
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    <DollarSign className="w-4 h-4 inline mr-2" />
                    Prix Unitaire
                  </label>
                  <p className="text-base font-medium text-gray-900">
                    {formatCurrency(vente.prix_unitaire_fcfa)}/g
                  </p>
                </div>
              </div>
            </Card>

            {vente.observations && (
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Observations
                </h3>
                <p className="text-gray-700 whitespace-pre-wrap">
                  {vente.observations}
                </p>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Statut</h3>
              <div className="text-center">
                <span
                  className={`inline-block px-4 py-2 text-sm font-medium rounded-full ${
                    STATUS_LABELS[vente.statut]?.color ||
                    'bg-gray-100 text-gray-800'
                  }`}
                >
                  {STATUS_LABELS[vente.statut]?.label || vente.statut}
                </span>
              </div>
            </Card>

            <Card className="p-6 bg-gradient-to-br from-emerald-50 to-green-50">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Montant Total
              </h3>
              <div className="text-center">
                <p className="text-3xl font-bold text-emerald-600">
                  {formatCurrency(vente.montant_total_fcfa)}
                </p>
                <p className="text-sm text-gray-600 mt-2">
                  {vente.quantite_grammes.toFixed(2)}g × {formatCurrency(vente.prix_unitaire_fcfa)}/g
                </p>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                <User className="w-5 h-5 inline mr-2" />
                Artisan
              </h3>
              <p className="text-gray-600 text-sm">
                ID: {vente.artisan_id}
              </p>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
