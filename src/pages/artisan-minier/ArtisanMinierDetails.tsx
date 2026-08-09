import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  Calendar,
  FileText,
  Eye,
  Download,
  TrendingUp,
  Coins,
  AlertTriangle,
  Plus,
  Edit2,
  Search,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loading } from '@/components/ui/Loading';
import { Input } from '@/components/ui/Input';
import { artisanMinierService } from '@/services/artisanMinierService';
import { carteProfessionnelleService } from '@/services/carteProfessionnelleService';
import { carteProfessionnelleGeneratorService } from '@/services/carteProfessionnelleGeneratorService';
import { artisanGoldSalesService, ArtisanGoldSale } from '@/services/artisanGoldSalesService';
import { artisanInfractionsService, ArtisanInfraction } from '@/services/artisanInfractionsService';
import { useCustomAlert } from '@/hooks/useCustomAlert';
import { CustomAlert } from '@/components/ui/CustomAlert';

const STATUT_LABELS: Record<string, { label: string; color: string }> = {
  en_attente: { label: 'En Attente', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  validee: { label: 'Validée', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  payee: { label: 'Payée', color: 'bg-green-100 text-green-800 border-green-200' },
  annulee: { label: 'Annulée', color: 'bg-red-100 text-red-800 border-red-200' },
};

const TRAITEMENT_LABELS: Record<string, { label: string; color: string }> = {
  en_cours: { label: 'En Cours', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  cloture: { label: 'Clôturé', color: 'bg-gray-100 text-gray-800 border-gray-200' },
};

const CONCLUSION_LABELS: Record<string, { label: string; color: string }> = {
  reconnu: { label: 'Reconnu', color: 'bg-red-100 text-red-800 border-red-200' },
  soupçonne: { label: 'Soupçonné', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  complice: { label: 'Complice', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  innocente: { label: 'Innocenté', color: 'bg-green-100 text-green-800 border-green-200' },
};

export default function ArtisanMinierDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [artisan, setArtisan] = useState<any>(null);
  const [carte, setCarte] = useState<any>(null);
  const [carteRectoPreview, setCarteRectoPreview] = useState<string | null>(null);
  const [carteVersoPreview, setCarteVersoPreview] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('informations');
  const [transactions, setTransactions] = useState<ArtisanGoldSale[]>([]);
  const [infractions, setInfractions] = useState<ArtisanInfraction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<ArtisanGoldSale[]>([]);
  const [filteredInfractions, setFilteredInfractions] = useState<ArtisanInfraction[]>([]);
  const [transactionSearch, setTransactionSearch] = useState('');
  const [transactionDateRange, setTransactionDateRange] = useState({ start: '', end: '' });
  const [infractionSearch, setInfractionSearch] = useState('');
  const { alertState, showError, closeAlert } = useCustomAlert();

  useEffect(() => {
    if (id) {
      loadArtisan();
      loadTransactions();
      loadInfractions();
    }
  }, [id]);

  useEffect(() => {
    filterTransactions();
  }, [transactionSearch, transactionDateRange, transactions]);

  useEffect(() => {
    filterInfractions();
  }, [infractionSearch, infractions]);

  const loadArtisan = async () => {
    try {
      setLoading(true);
      const data = await artisanMinierService.getById(id!);
      setArtisan(data);

      const carteData = await carteProfessionnelleService.getByArtisanId(id!);
      if (carteData && carteData.length > 0) {
        const currentCarte = carteData[0];
        setCarte(currentCarte);

        console.log('Carte chargée:', currentCarte);

        if (currentCarte.carte_recto_url) {
          console.log('Utilisation du recto depuis la BD:', currentCarte.carte_recto_url?.substring(0, 50));
          setCarteRectoPreview(currentCarte.carte_recto_url);
        }
        if (currentCarte.carte_verso_url) {
          console.log('Utilisation du verso depuis la BD:', currentCarte.carte_verso_url?.substring(0, 50));
          setCarteVersoPreview(currentCarte.carte_verso_url);
        }

        if (!currentCarte.carte_recto_url || !currentCarte.carte_verso_url) {
          console.log('Génération des images de carte manquantes...');
          await generateCartePreview(data, currentCarte);
        }
      }
    } catch (error) {
      console.error('Error loading artisan:', error);
      showError('Impossible de charger les données de l\'artisan');
    } finally {
      setLoading(false);
    }
  };

  const loadTransactions = async () => {
    try {
      const data = await artisanGoldSalesService.getAll();
      const artisanTransactions = data.filter(t => t.artisan_id === id);
      setTransactions(artisanTransactions);
      setFilteredTransactions(artisanTransactions);
    } catch (error) {
      console.error('Error loading transactions:', error);
    }
  };

  const loadInfractions = async () => {
    try {
      const data = await artisanInfractionsService.getByArtisanId(id!);
      setInfractions(data);
      setFilteredInfractions(data);
    } catch (error) {
      console.error('Error loading infractions:', error);
    }
  };

  const filterTransactions = () => {
    let filtered = [...transactions];

    if (transactionSearch) {
      filtered = filtered.filter(
        (t) =>
          t.numero_recu?.toLowerCase().includes(transactionSearch.toLowerCase()) ||
          t.type_or?.toLowerCase().includes(transactionSearch.toLowerCase())
      );
    }

    if (transactionDateRange.start) {
      filtered = filtered.filter((t) => t.date_vente >= transactionDateRange.start);
    }

    if (transactionDateRange.end) {
      filtered = filtered.filter((t) => t.date_vente <= transactionDateRange.end);
    }

    setFilteredTransactions(filtered);
  };

  const filterInfractions = () => {
    let filtered = [...infractions];

    if (infractionSearch) {
      filtered = filtered.filter(
        (i) =>
          i.type_infraction?.toLowerCase().includes(infractionSearch.toLowerCase()) ||
          i.description?.toLowerCase().includes(infractionSearch.toLowerCase())
      );
    }

    setFilteredInfractions(filtered);
  };

  const generateCartePreview = async (artisanData: any, carteData: any) => {
    try {
      console.log('Génération de la carte pour:', artisanData, carteData);

      if (!carteData.date_delivrance || !carteData.date_expiration) {
        console.warn('Dates manquantes sur la carte, création de dates par défaut');
        const today = new Date();
        const nextYear = new Date();
        nextYear.setFullYear(nextYear.getFullYear() + 1);

        carteData = {
          ...carteData,
          date_delivrance: carteData.date_delivrance || carteData.created_at || today.toISOString(),
          date_expiration: carteData.date_expiration || nextYear.toISOString()
        };
      }

      if (!carteData.qr_code_data) {
        carteData = {
          ...carteData,
          qr_code_data: JSON.stringify({
            numero_carte: carteData.numero_carte,
            artisan_id: carteData.artisan_id,
            type: artisanData.type_artisan
          })
        };
      }

      try {
        const { supabase } = await import('@/lib/supabase');
        const { pdfUrl, rectoUrl, versoUrl } = await carteProfessionnelleGeneratorService.generateAndUploadCartePDF(
          artisanData,
          carteData,
          supabase
        );

        console.log('PDF généré et sauvegardé avec succès:', { pdfUrl, rectoUrl, versoUrl });

        setCarteRectoPreview(rectoUrl);
        setCarteVersoPreview(versoUrl);

        if (carteData.id) {
          await carteProfessionnelleService.updateCartePdfUrl(carteData.id, pdfUrl, rectoUrl, versoUrl);
          console.log('URLs de carte sauvegardées dans la base de données');
        }

        return { pdfUrl, rectoUrl, versoUrl };
      } catch (uploadError: any) {
        console.warn('Impossible d\'uploader la carte vers le stockage:', uploadError);

        if (uploadError?.message?.includes('Bucket not found') || uploadError?.statusCode === 404) {
          console.warn('Le bucket cartes-professionnelles n\'existe pas encore. Affichage des images locales.');
        }

        const rectoDataUrl = await carteProfessionnelleGeneratorService.generateCarteRecto(artisanData, carteData);
        const versoDataUrl = await carteProfessionnelleGeneratorService.generateCarteVerso(artisanData, carteData);

        setCarteRectoPreview(rectoDataUrl);
        setCarteVersoPreview(versoDataUrl);

        console.log('Cartes affichées en mode local (data URLs)');
        return { pdfUrl: '', rectoUrl: rectoDataUrl, versoUrl: versoDataUrl };
      }
    } catch (error) {
      console.error('Erreur lors de la génération de la carte:', error);
      showError('Impossible de générer la carte professionnelle');
      throw error;
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

  const getTotalTransactions = () => {
    return {
      total: filteredTransactions.length,
      montant: filteredTransactions.reduce((sum, t) => sum + t.montant_total_fcfa, 0),
      quantite: filteredTransactions.reduce((sum, t) => sum + t.quantite_grammes, 0),
    };
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

  if (!artisan) {
    return (
      <MainLayout>
        <Card className="p-8">
          <div className="text-center">
            <User className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Artisan introuvable</h3>
            <Button onClick={() => navigate('/artisan-minier/liste')}>Retour à la liste</Button>
          </div>
        </Card>
      </MainLayout>
    );
  }

  const stats = getTotalTransactions();

  return (
    <MainLayout>
      <CustomAlert {...alertState} onClose={closeAlert} />

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={() => navigate('/artisan-minier/liste')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                {artisan.prenom} {artisan.nom}
              </h1>
              <p className="text-gray-600 mt-1">
                {carte?.numero_carte || 'Aucune carte professionnelle'}
              </p>
            </div>
          </div>
          <Button onClick={() => navigate(`/artisan-minier/${id}/edit`)}>
            <Edit2 className="w-5 h-5 mr-2" />
            Modifier
          </Button>
        </div>

        {/* Tabs Navigation */}
        <Card className="p-0 overflow-hidden">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('informations')}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                activeTab === 'informations'
                  ? 'bg-emerald-50 text-emerald-700 border-b-2 border-emerald-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <User className="w-5 h-5 inline mr-2" />
              Informations
            </button>
            <button
              onClick={() => setActiveTab('carte')}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                activeTab === 'carte'
                  ? 'bg-emerald-50 text-emerald-700 border-b-2 border-emerald-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <CreditCard className="w-5 h-5 inline mr-2" />
              Carte Professionnelle
            </button>
            <button
              onClick={() => setActiveTab('transactions')}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                activeTab === 'transactions'
                  ? 'bg-emerald-50 text-emerald-700 border-b-2 border-emerald-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Coins className="w-5 h-5 inline mr-2" />
              Transactions ({transactions.length})
            </button>
            <button
              onClick={() => setActiveTab('infractions')}
              className={`flex-1 px-6 py-4 text-sm font-medium transition-colors ${
                activeTab === 'infractions'
                  ? 'bg-emerald-50 text-emerald-700 border-b-2 border-emerald-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <AlertTriangle className="w-5 h-5 inline mr-2" />
              Infractions ({infractions.length})
            </button>
          </div>
        </Card>

        {/* Tab Content */}
        {activeTab === 'informations' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Informations Personnelles</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    <User className="w-4 h-4 inline mr-2" />
                    Nom Complet
                  </label>
                  <p className="text-base font-medium text-gray-900">
                    {artisan.prenom} {artisan.nom}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    <Calendar className="w-4 h-4 inline mr-2" />
                    Date de Naissance
                  </label>
                  <p className="text-base font-medium text-gray-900">
                    {artisan.date_naissance ? formatDate(artisan.date_naissance) : '-'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    <Phone className="w-4 h-4 inline mr-2" />
                    Téléphone
                  </label>
                  <p className="text-base font-medium text-gray-900">{artisan.telephone || '-'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    <Mail className="w-4 h-4 inline mr-2" />
                    Email
                  </label>
                  <p className="text-base font-medium text-gray-900">{artisan.email || '-'}</p>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Localisation</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    <MapPin className="w-4 h-4 inline mr-2" />
                    Pays
                  </label>
                  <p className="text-base font-medium text-gray-900">{artisan.pays}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Région</label>
                  <p className="text-base font-medium text-gray-900">{artisan.region || '-'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Province</label>
                  <p className="text-base font-medium text-gray-900">{artisan.province || '-'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Commune</label>
                  <p className="text-base font-medium text-gray-900">{artisan.commune || '-'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">Village</label>
                  <p className="text-base font-medium text-gray-900">{artisan.village || '-'}</p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'carte' && (
          <Card className="p-6">
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">Carte Professionnelle</h3>
                {carte && carte.carte_pdf_url && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(carte.carte_pdf_url, '_blank')}
                    >
                      <Eye className="w-4 h-4 mr-2" />
                      Voir PDF
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => {
                        const link = document.createElement('a');
                        link.href = carte.carte_pdf_url;
                        link.download = `carte_${carte.numero_carte.replace(/\//g, '_')}.pdf`;
                        link.click();
                      }}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Télécharger PDF
                    </Button>
                  </div>
                )}
              </div>
              {carte ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Recto</h4>
                      {carteRectoPreview ? (
                        <img
                          src={carteRectoPreview}
                          alt="Recto"
                          className="w-full rounded-lg shadow-lg border border-gray-200"
                          onError={() => {
                            console.error('Erreur de chargement du recto:', carteRectoPreview);
                          }}
                        />
                      ) : (
                        <div className="w-full h-64 bg-gray-100 rounded-lg shadow-lg border border-gray-200 flex items-center justify-center">
                          <div className="text-center">
                            <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                            <p className="text-sm text-gray-500">Génération en cours...</p>
                          </div>
                        </div>
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Verso</h4>
                      {carteVersoPreview ? (
                        <img
                          src={carteVersoPreview}
                          alt="Verso"
                          className="w-full rounded-lg shadow-lg border border-gray-200"
                          onError={() => {
                            console.error('Erreur de chargement du verso:', carteVersoPreview);
                          }}
                        />
                      ) : (
                        <div className="w-full h-64 bg-gray-100 rounded-lg shadow-lg border border-gray-200 flex items-center justify-center">
                          <div className="text-center">
                            <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                            <p className="text-sm text-gray-500">Génération en cours...</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <FileText className="w-5 h-5 text-blue-600 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-blue-900 mb-2">Informations de la Carte</h4>
                        <div className="grid grid-cols-2 gap-3 text-xs text-blue-700">
                          <div>
                            <span className="font-medium">Numéro:</span>
                            <p className="font-semibold mt-0.5">{carte.numero_carte}</p>
                          </div>
                          <div>
                            <span className="font-medium">Statut:</span>
                            <p className="mt-0.5">
                              <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded-full">
                                {carte.statut || 'Active'}
                              </span>
                            </p>
                          </div>
                          <div>
                            <span className="font-medium">Date d'émission:</span>
                            <p className="font-semibold mt-0.5">
                              {carte.date_delivrance ? new Date(carte.date_delivrance).toLocaleDateString('fr-FR') : (carte.created_at ? new Date(carte.created_at).toLocaleDateString('fr-FR') : '-')}
                            </p>
                          </div>
                          <div>
                            <span className="font-medium">Date d'expiration:</span>
                            <p className="font-semibold mt-0.5">
                              {carte.date_expiration ? new Date(carte.date_expiration).toLocaleDateString('fr-FR') : '-'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <CreditCard className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-4">Aucune carte professionnelle générée</p>
                  <Button>
                    <Plus className="w-5 h-5 mr-2" />
                    Générer la Carte
                  </Button>
                </div>
              )}
            </div>
          </Card>
        )}

        {activeTab === 'transactions' && (
          <div className="space-y-6">
            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-700">Total Transactions</p>
                    <p className="text-2xl font-bold text-blue-900">{stats.total}</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-blue-600" />
                </div>
              </Card>
              <Card className="p-4 bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-emerald-700">Montant Total</p>
                    <p className="text-2xl font-bold text-emerald-900">
                      {formatCurrency(stats.montant)}
                    </p>
                  </div>
                  <Coins className="w-8 h-8 text-emerald-600" />
                </div>
              </Card>
              <Card className="p-4 bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-yellow-700">Quantité Totale</p>
                    <p className="text-2xl font-bold text-yellow-900">
                      {stats.quantite.toFixed(2)} g
                    </p>
                  </div>
                  <Coins className="w-8 h-8 text-yellow-600" />
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
                      placeholder="Rechercher par numéro de reçu ou type..."
                      value={transactionSearch}
                      onChange={(e) => setTransactionSearch(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Input
                    type="date"
                    value={transactionDateRange.start}
                    onChange={(e) =>
                      setTransactionDateRange({ ...transactionDateRange, start: e.target.value })
                    }
                    placeholder="Date début"
                  />
                  <Input
                    type="date"
                    value={transactionDateRange.end}
                    onChange={(e) =>
                      setTransactionDateRange({ ...transactionDateRange, end: e.target.value })
                    }
                    placeholder="Date fin"
                  />
                </div>
              </div>
            </Card>

            {/* Transactions Table */}
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-emerald-600 to-emerald-700">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                        Numéro Reçu
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                        Type d'Or
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-white uppercase tracking-wider">
                        Quantité (g)
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-white uppercase tracking-wider">
                        Montant (FCFA)
                      </th>
                      <th className="px-6 py-4 text-center text-xs font-semibold text-white uppercase tracking-wider">
                        Statut
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-white uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                          Aucune transaction trouvée
                        </td>
                      </tr>
                    ) : (
                      filteredTransactions.map((transaction) => (
                        <tr key={transaction.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatDate(transaction.date_vente)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {transaction.numero_recu || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {transaction.type_or}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                            {transaction.quantite_grammes.toFixed(2)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-gray-900">
                            {formatCurrency(transaction.montant_total_fcfa)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span
                              className={`inline-flex px-3 py-1 text-xs font-medium rounded-full border ${
                                STATUT_LABELS[transaction.statut]?.color ||
                                'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {STATUT_LABELS[transaction.statut]?.label || transaction.statut}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                navigate(`/artisan-minier/ventes-or/${transaction.id}`)
                              }
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'infractions' && (
          <div className="space-y-6">
            {/* Header with Add Button */}
            <div className="flex items-center justify-between">
              <div className="flex gap-4">
                <Card className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
                  <p className="text-sm font-medium text-orange-700">En Cours</p>
                  <p className="text-2xl font-bold text-orange-900">
                    {infractions.filter((i) => i.statut_traitement === 'en_cours').length}
                  </p>
                </Card>
                <Card className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200">
                  <p className="text-sm font-medium text-gray-700">Clôturées</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {infractions.filter((i) => i.statut_traitement === 'cloture').length}
                  </p>
                </Card>
              </div>
              <Button
                onClick={() =>
                  navigate(`/artisan-minier/${id}/infractions/nouvelle`)
                }
              >
                <Plus className="w-5 h-5 mr-2" />
                Nouvelle Infraction
              </Button>
            </div>

            {/* Search */}
            <Card className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  placeholder="Rechercher une infraction..."
                  value={infractionSearch}
                  onChange={(e) => setInfractionSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </Card>

            {/* Infractions Table */}
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-red-600 to-red-700">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                        Type d'Infraction
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                        Description
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-white uppercase tracking-wider">
                        Lieu
                      </th>
                      <th className="px-6 py-4 text-center text-xs font-semibold text-white uppercase tracking-wider">
                        Traitement
                      </th>
                      <th className="px-6 py-4 text-center text-xs font-semibold text-white uppercase tracking-wider">
                        Conclusion
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-white uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredInfractions.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                          <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                          <p>Aucune infraction enregistrée</p>
                        </td>
                      </tr>
                    ) : (
                      filteredInfractions.map((infraction) => (
                        <tr key={infraction.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {formatDate(infraction.date_infraction)}
                          </td>
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">
                            {infraction.type_infraction}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                            {infraction.description}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {infraction.lieu || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span
                              className={`inline-flex px-3 py-1 text-xs font-medium rounded-full border ${
                                TRAITEMENT_LABELS[infraction.statut_traitement]?.color
                              }`}
                            >
                              {TRAITEMENT_LABELS[infraction.statut_traitement]?.label}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            {infraction.conclusion ? (
                              <span
                                className={`inline-flex px-3 py-1 text-xs font-medium rounded-full border ${
                                  CONCLUSION_LABELS[infraction.conclusion]?.color
                                }`}
                              >
                                {CONCLUSION_LABELS[infraction.conclusion]?.label}
                              </span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                navigate(`/artisan-minier/${id}/infractions/${infraction.id}`)
                              }
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
