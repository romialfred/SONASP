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
  Phone,
  MapPin,
  CreditCard,
  AlertCircle,
  Scale,
  Receipt,
  Sparkles,
  BadgeCheck,
  Building2,
  Mail,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loading } from '@/components/ui/Loading';
import { Tabs } from '@/components/ui/Tabs';
import { artisanGoldSalesService, ArtisanGoldSale } from '@/services/artisanGoldSalesService';
import { artisanMinierService, type ArtisanMinier } from '@/services/artisanMinierService';
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
  const [artisan, setArtisan] = useState<ArtisanMinier | null>(null);
  const [activeTab, setActiveTab] = useState('informations');
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
        if (data.artisan_id) {
          loadArtisan(data.artisan_id);
        }
      } else {
        showError('Vente introuvable');
      }
    } catch (error) {
      showError('Impossible de charger les détails de la vente');
    } finally {
      setLoading(false);
    }
  };

  const loadArtisan = async (artisanId: string) => {
    try {
      const data = await artisanMinierService.getById(artisanId);
      if (data) {
        setArtisan(data);
      }
    } catch (error) {
      console.error('Error loading artisan:', error);
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

  const canEdit = vente && !['validee', 'payee'].includes(vente.statut);

  const getArtisanDisplayName = () => {
    if (!artisan) return 'Chargement...';
    if (artisan.raison_sociale) {
      return artisan.raison_sociale;
    }
    return `${artisan.nom || ''} ${artisan.prenoms || ''}`.trim() || 'Sans nom';
  };

  const tabs = [
    { id: 'informations', label: 'Informations' },
    { id: 'artisan', label: 'Artisan' },
    { id: 'documents', label: 'Documents & Facture' },
  ];

  return (
    <MainLayout>
      <CustomAlert {...alertState} onClose={closeAlert} />

      <div className="space-y-6 p-6">
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
              <p className="text-gray-600 mt-1">
                {vente.numero_recu || `VENTE/OR/2025/12/${id?.slice(0, 4)}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {!canEdit && (
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 px-3 py-2 rounded-lg">
                <AlertCircle className="w-4 h-4 text-blue-600" />
                <span className="text-sm text-blue-700 font-medium">
                  Vente validée - Modification impossible
                </span>
              </div>
            )}
            <Button
              onClick={() => navigate(`/artisan-minier/ventes-or/${id}/modifier`)}
              disabled={!canEdit}
              title={!canEdit ? 'Impossible de modifier une vente validée ou payée' : ''}
            >
              <Edit2 className="w-5 h-5 mr-2" />
              Modifier
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <Tabs
                tabs={tabs}
                activeTab={activeTab}
                onChange={setActiveTab}
              />

              <div className="p-6">
                {activeTab === 'informations' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <Receipt className="w-5 h-5 text-emerald-600" />
                        Informations de la Vente
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                          <label className="block text-xs font-medium text-gray-500 mb-1">
                            <Calendar className="w-3.5 h-3.5 inline mr-1" />
                            Date de Vente
                          </label>
                          <p className="text-base font-semibold text-gray-900">
                            {formatDate(vente.date_vente)}
                          </p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                          <label className="block text-xs font-medium text-gray-500 mb-1">
                            <FileText className="w-3.5 h-3.5 inline mr-1" />
                            Numéro de Reçu
                          </label>
                          <p className="text-base font-semibold text-gray-900">
                            {vente.numero_recu || '-'}
                          </p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                          <label className="block text-xs font-medium text-gray-500 mb-1">
                            <Coins className="w-3.5 h-3.5 inline mr-1" />
                            Type d'Or
                          </label>
                          <p className="text-base font-semibold text-gray-900">
                            {TYPE_OR_LABELS[vente.type_or] || vente.type_or}
                          </p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                          <label className="block text-xs font-medium text-gray-500 mb-1">
                            <Scale className="w-3.5 h-3.5 inline mr-1" />
                            Quantité
                          </label>
                          <p className="text-base font-semibold text-gray-900">
                            {vente.quantite_grammes.toFixed(2)} grammes
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {(vente.quantite_grammes / 31.1034768).toFixed(3)} oz
                          </p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                          <label className="block text-xs font-medium text-gray-500 mb-1">
                            <Sparkles className="w-3.5 h-3.5 inline mr-1" />
                            Pureté
                          </label>
                          <p className="text-base font-semibold text-gray-900">
                            {vente.purete_karat} Karat
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {((vente.purete_karat / 24) * 100).toFixed(2)}%
                          </p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                          <label className="block text-xs font-medium text-gray-500 mb-1">
                            <DollarSign className="w-3.5 h-3.5 inline mr-1" />
                            Prix par Gramme
                          </label>
                          <p className="text-base font-semibold text-gray-900">
                            {formatCurrency(vente.prix_kg_fcfa / 1000)}/g
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="border-t pt-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <Receipt className="w-5 h-5 text-blue-600" />
                        Détails Financiers
                      </h3>
                      <div className="space-y-3 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-700">Montant Brut</span>
                          <span className="text-base font-bold text-gray-900">
                            {formatCurrency(vente.montant_brut_fcfa)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-700">
                            TVA ({vente.tva_taux}%)
                          </span>
                          <span className="text-base font-semibold text-gray-700">
                            {formatCurrency(vente.tva_montant_fcfa)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-700">
                            Taxe Dev. Comm. ({vente.taxe_dev_comm_taux}%)
                          </span>
                          <span className="text-base font-semibold text-gray-700">
                            {formatCurrency(vente.taxe_dev_comm_montant_fcfa)}
                          </span>
                        </div>
                        <div className="border-t border-blue-300 pt-3 flex justify-between items-center">
                          <span className="text-base font-bold text-gray-900">Montant Total TTC</span>
                          <span className="text-xl font-bold text-emerald-600">
                            {formatCurrency(vente.montant_total_fcfa)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {vente.observations && (
                      <div className="border-t pt-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">
                          Observations
                        </h3>
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                          <p className="text-gray-700 whitespace-pre-wrap">
                            {vente.observations}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'artisan' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <User className="w-5 h-5 text-blue-600" />
                        Informations du Vendeur
                      </h3>
                      {artisan ? (
                        <div className="space-y-4">
                          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 border-2 border-blue-200">
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <h4 className="text-xl font-bold text-gray-900">
                                  {getArtisanDisplayName()}
                                </h4>
                                {artisan.raison_sociale && (
                                  <p className="text-sm text-gray-600 mt-1">
                                    {artisan.nom} {artisan.prenoms}
                                  </p>
                                )}
                              </div>
                              {artisan.actif && (
                                <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1">
                                  <BadgeCheck className="w-3.5 h-3.5" />
                                  Actif
                                </span>
                              )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                              <div className="bg-white rounded-lg p-3 border border-blue-200">
                                <label className="block text-xs font-medium text-gray-500 mb-1">
                                  <CreditCard className="w-3.5 h-3.5 inline mr-1" />
                                  Numéro de Carte
                                </label>
                                <p className="text-sm font-semibold text-gray-900">
                                  {artisan.numero_carte}
                                </p>
                              </div>

                              {artisan.telephone && (
                                <div className="bg-white rounded-lg p-3 border border-blue-200">
                                  <label className="block text-xs font-medium text-gray-500 mb-1">
                                    <Phone className="w-3.5 h-3.5 inline mr-1" />
                                    Téléphone
                                  </label>
                                  <p className="text-sm font-semibold text-gray-900">
                                    {artisan.telephone}
                                  </p>
                                </div>
                              )}

                              {artisan.email && (
                                <div className="bg-white rounded-lg p-3 border border-blue-200">
                                  <label className="block text-xs font-medium text-gray-500 mb-1">
                                    <Mail className="w-3.5 h-3.5 inline mr-1" />
                                    Email
                                  </label>
                                  <p className="text-sm font-semibold text-gray-900">
                                    {artisan.email}
                                  </p>
                                </div>
                              )}

                              {artisan.adresse && (
                                <div className="bg-white rounded-lg p-3 border border-blue-200">
                                  <label className="block text-xs font-medium text-gray-500 mb-1">
                                    <MapPin className="w-3.5 h-3.5 inline mr-1" />
                                    Adresse
                                  </label>
                                  <p className="text-sm font-semibold text-gray-900">
                                    {artisan.adresse}
                                  </p>
                                </div>
                              )}

                              {artisan.ville && (
                                <div className="bg-white rounded-lg p-3 border border-blue-200">
                                  <label className="block text-xs font-medium text-gray-500 mb-1">
                                    <Building2 className="w-3.5 h-3.5 inline mr-1" />
                                    Ville
                                  </label>
                                  <p className="text-sm font-semibold text-gray-900">
                                    {artisan.ville}
                                  </p>
                                </div>
                              )}

                              {artisan.pays && (
                                <div className="bg-white rounded-lg p-3 border border-blue-200">
                                  <label className="block text-xs font-medium text-gray-500 mb-1">
                                    Pays
                                  </label>
                                  <p className="text-sm font-semibold text-gray-900">
                                    {artisan.pays}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-center py-8">
                          <Loading />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'documents' && (
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                        <FileText className="w-5 h-5 text-purple-600" />
                        Documents et Factures
                      </h3>
                      <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-8">
                        <div className="text-center">
                          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                          <p className="text-gray-600 mb-2">Aucun document joint</p>
                          <p className="text-sm text-gray-500">
                            Les factures et documents seront disponibles ici
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>

          <div className="space-y-4">
            <Card className="p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Statut</h3>
              <div className="text-center">
                <span
                  className={`inline-block px-4 py-2 text-sm font-bold rounded-full ${
                    STATUS_LABELS[vente.statut]?.color ||
                    'bg-gray-100 text-gray-800'
                  }`}
                >
                  {STATUS_LABELS[vente.statut]?.label || vente.statut}
                </span>
              </div>
            </Card>

            <Card className="p-4 bg-gradient-to-br from-emerald-50 to-green-100 border-2 border-emerald-200">
              <h3 className="text-sm font-semibold text-emerald-900 mb-3 flex items-center gap-1.5">
                <DollarSign className="w-4 h-4" />
                Montant Total
              </h3>
              <div className="text-center">
                <p className="text-3xl font-bold text-emerald-700">
                  {formatCurrency(vente.montant_total_fcfa)}
                </p>
                <div className="mt-3 pt-3 border-t border-emerald-200">
                  <p className="text-xs text-gray-600">
                    {vente.quantite_grammes.toFixed(2)} g × {formatCurrency(vente.prix_kg_fcfa / 1000)}/g
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-4 bg-blue-50 border border-blue-200">
              <h3 className="text-sm font-semibold text-blue-900 mb-3">
                Résumé Rapide
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Montant Brut:</span>
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(vente.montant_brut_fcfa)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">TVA:</span>
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(vente.tva_montant_fcfa)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Taxe Dev:</span>
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(vente.taxe_dev_comm_montant_fcfa)}
                  </span>
                </div>
                <div className="border-t border-blue-300 pt-2 flex justify-between">
                  <span className="font-bold text-gray-900">Total:</span>
                  <span className="font-bold text-emerald-600">
                    {formatCurrency(vente.montant_total_fcfa)}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
