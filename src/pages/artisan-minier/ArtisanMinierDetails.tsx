import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  Building2,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  Calendar,
  FileText,
  Eye,
  Download,
  RefreshCw,
  TrendingUp,
  Coins
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loading } from '@/components/ui/Loading';
import { Tabs } from '@/components/ui/Tabs';
import { artisanMinierService } from '@/services/artisanMinierService';
import { carteProfessionnelleService } from '@/services/carteProfessionnelleService';
import { carteProfessionnelleGeneratorService } from '@/services/carteProfessionnelleGeneratorService';
import { useCustomAlert } from '@/hooks/useCustomAlert';
import { CustomAlert } from '@/components/ui/CustomAlert';

export default function ArtisanMinierDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [artisan, setArtisan] = useState<any>(null);
  const [carte, setCarte] = useState<any>(null);
  const [carteRectoPreview, setCarteRectoPreview] = useState<string | null>(null);
  const [carteVersoPreview, setCarteVersoPreview] = useState<string | null>(null);
  const [generatingCarte, setGeneratingCarte] = useState(false);
  const [activeTab, setActiveTab] = useState('informations');
  const { alertState, showSuccess, showError, closeAlert } = useCustomAlert();

  useEffect(() => {
    if (id) {
      loadArtisan();
    }
  }, [id]);

  const loadArtisan = async () => {
    try {
      setLoading(true);
      const data = await artisanMinierService.getById(id!);
      setArtisan(data);

      // Charger la carte si elle existe
      const carteData = await carteProfessionnelleService.getByArtisanId(id!);
      if (carteData && carteData.length > 0) {
        setCarte(carteData[0]);
        await generateCartePreview(data, carteData[0]);
      }
    } catch (error) {
      console.error('Error loading artisan:', error);
      showError('Impossible de charger les données de l\'artisan');
    } finally {
      setLoading(false);
    }
  };

  const generateCartePreview = async (artisanData: any, carteData: any) => {
    try {
      const recto = await carteProfessionnelleGeneratorService.generateCarteRecto(artisanData, carteData);
      const verso = await carteProfessionnelleGeneratorService.generateCarteVerso(artisanData, carteData);
      setCarteRectoPreview(recto);
      setCarteVersoPreview(verso);
    } catch (error) {
      console.error('Error generating carte preview:', error);
    }
  };

  const handleGenerateCarte = async () => {
    if (!artisan) return;

    try {
      setGeneratingCarte(true);

      // Créer ou mettre à jour la carte
      let carteData = carte;

      if (!carteData) {
        // Générer un nouveau numéro de carte
        const numeroSequence = await artisanMinierService.getNextCarteSequence(artisan.pays);
        const annee = new Date().getFullYear();
        const codePays = artisan.pays === 'Burkina Faso' ? 'BF' : 'ML';
        const numeroFormate = numeroSequence.toString().padStart(4, '0');
        const numeroCarte = `SONASP/AM/${annee}/${codePays}/${numeroFormate}`;

        const newCarteData = {
          artisan_id: artisan.id,
          numero_carte: numeroCarte,
          date_delivrance: new Date().toISOString().split('T')[0],
          date_expiration: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          statut: 'actif',
          numero_securite: Math.random().toString().substring(2, 12),
          qr_code_data: JSON.stringify({
            numero_carte: numeroCarte,
            nom: artisan.nom,
            prenoms: artisan.prenoms,
            type_artisan: artisan.type_artisan
          })
        };

        carteData = await carteProfessionnelleService.create(newCarteData);

        // Mettre à jour l'artisan avec le numéro de carte
        await artisanMinierService.update(artisan.id, {
          numero_carte: numeroCarte
        });
      }

      // Générer le PDF
      const pdfBlob = await carteProfessionnelleGeneratorService.generateCartePDF(artisan, carteData);

      // Télécharger le PDF
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `carte_${carteData.numero_carte.replace(/\//g, '_')}.pdf`;
      link.click();
      URL.revokeObjectURL(url);

      setCarte(carteData);
      await generateCartePreview(artisan, carteData);

      showSuccess('Carte professionnelle générée avec succès !');
    } catch (error: any) {
      console.error('Error generating carte:', error);
      showError(error.message || 'Erreur lors de la génération de la carte');
    } finally {
      setGeneratingCarte(false);
    }
  };

  const tabs = [
    { id: 'informations', label: 'Informations', icon: User },
    { id: 'carte', label: 'Carte Professionnelle', icon: CreditCard },
    { id: 'transactions', label: 'Transactions', icon: TrendingUp }
  ];

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
        <Card className="p-8 text-center">
          <p className="text-gray-600">Artisan non trouvé</p>
          <Button onClick={() => navigate('/artisans-miniers')} className="mt-4">
            Retour à la liste
          </Button>
        </Card>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <CustomAlert {...alertState} onClose={closeAlert} />

      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/artisans-miniers')}
              className="text-xs"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Retour
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {artisan.type_personne === 'physique'
                  ? `${artisan.nom} ${artisan.prenoms || ''}`
                  : artisan.raison_sociale
                }
              </h1>
              <p className="text-sm text-gray-600 mt-0.5">
                {artisan.numero_carte || 'Carte non générée'}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleGenerateCarte}
              disabled={generatingCarte}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-xs"
            >
              {generatingCarte ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Génération...
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  {carte ? 'Regénérer la carte' : 'Générer la carte'}
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Card>
          <div className="border-b border-gray-200">
            <Tabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
          </div>

          <div className="p-6">
            {/* Tab: Informations */}
            {activeTab === 'informations' && (
              <div className="space-y-6">
                {/* Metrics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="bg-yellow-50 border-yellow-200">
                    <div className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-yellow-100 rounded-lg">
                          <Coins className="h-6 w-6 text-yellow-600" />
                        </div>
                        <div>
                          <p className="text-xs text-yellow-700 font-medium">Or Vendu</p>
                          <p className="text-lg font-bold text-yellow-900">
                            {artisan.quantite_or_vendu_grammes?.toFixed(2) || '0.00'} g
                          </p>
                        </div>
                      </div>
                    </div>
                  </Card>
                  <Card className="bg-emerald-50 border-emerald-200">
                    <div className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-emerald-100 rounded-lg">
                          <TrendingUp className="h-6 w-6 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-xs text-emerald-700 font-medium">Chiffre d'Affaires</p>
                          <p className="text-lg font-bold text-emerald-900">
                            {artisan.chiffre_affaires_fcfa?.toLocaleString('fr-FR') || '0'} FCFA
                          </p>
                        </div>
                      </div>
                    </div>
                  </Card>
                  <Card className="bg-blue-50 border-blue-200">
                    <div className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-blue-100 rounded-lg">
                          <FileText className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-xs text-blue-700 font-medium">Transactions</p>
                          <p className="text-lg font-bold text-blue-900">
                            {artisan.nombre_transactions || 0}
                          </p>
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>

                {/* Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-gray-900">Informations Générales</h3>

                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <User className="h-4 w-4 text-gray-400 mt-0.5" />
                        <div>
                          <p className="text-xs text-gray-500">Type de personne</p>
                          <p className="text-sm font-medium text-gray-900 capitalize">{artisan.type_personne}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <Building2 className="h-4 w-4 text-gray-400 mt-0.5" />
                        <div>
                          <p className="text-xs text-gray-500">Type d'artisan</p>
                          <p className="text-sm font-medium text-gray-900 capitalize">{artisan.type_artisan}</p>
                        </div>
                      </div>

                      {artisan.type_personne === 'physique' && (
                        <>
                          {artisan.date_naissance && (
                            <div className="flex items-start gap-3">
                              <Calendar className="h-4 w-4 text-gray-400 mt-0.5" />
                              <div>
                                <p className="text-xs text-gray-500">Date de naissance</p>
                                <p className="text-sm font-medium text-gray-900">
                                  {new Date(artisan.date_naissance).toLocaleDateString('fr-FR')}
                                </p>
                              </div>
                            </div>
                          )}
                          {artisan.sexe && (
                            <div className="flex items-start gap-3">
                              <User className="h-4 w-4 text-gray-400 mt-0.5" />
                              <div>
                                <p className="text-xs text-gray-500">Sexe</p>
                                <p className="text-sm font-medium text-gray-900">
                                  {artisan.sexe === 'M' ? 'Masculin' : 'Féminin'}
                                </p>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-gray-900">Contacts & Localisation</h3>

                    <div className="space-y-3">
                      {artisan.telephone && (
                        <div className="flex items-start gap-3">
                          <Phone className="h-4 w-4 text-gray-400 mt-0.5" />
                          <div>
                            <p className="text-xs text-gray-500">Téléphone</p>
                            <p className="text-sm font-medium text-gray-900">{artisan.telephone}</p>
                          </div>
                        </div>
                      )}

                      {artisan.email && (
                        <div className="flex items-start gap-3">
                          <Mail className="h-4 w-4 text-gray-400 mt-0.5" />
                          <div>
                            <p className="text-xs text-gray-500">Email</p>
                            <p className="text-sm font-medium text-gray-900">{artisan.email}</p>
                          </div>
                        </div>
                      )}

                      {(artisan.region || artisan.commune) && (
                        <div className="flex items-start gap-3">
                          <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                          <div>
                            <p className="text-xs text-gray-500">Localisation</p>
                            <p className="text-sm font-medium text-gray-900">
                              {[artisan.commune, artisan.region, artisan.pays].filter(Boolean).join(', ')}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Carte */}
            {activeTab === 'carte' && (
              <div className="space-y-6">
                {carte && carteRectoPreview && carteVersoPreview ? (
                  <div className="space-y-6">
                    <div className="text-center">
                      <p className="text-sm text-gray-600 mb-4">
                        Aperçu de la carte professionnelle
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 mb-3 text-center">Recto</h4>
                        <div className="border border-gray-200 rounded-lg overflow-hidden shadow-lg">
                          <img src={carteRectoPreview} alt="Carte Recto" className="w-full" />
                        </div>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 mb-3 text-center">Verso</h4>
                        <div className="border border-gray-200 rounded-lg overflow-hidden shadow-lg">
                          <img src={carteVersoPreview} alt="Carte Verso" className="w-full" />
                        </div>
                      </div>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center gap-3">
                        <CreditCard className="h-5 w-5 text-blue-600" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-blue-900">Numéro de carte</p>
                          <p className="text-xs text-blue-700">{carte.numero_carte}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-blue-900">Statut</p>
                          <p className="text-xs text-blue-700 capitalize">{carte.statut}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="inline-flex p-4 bg-gray-100 rounded-full mb-4">
                      <CreditCard className="h-12 w-12 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-2">
                      Carte non générée
                    </h3>
                    <p className="text-sm text-gray-600 mb-6">
                      Cliquez sur le bouton "Générer la carte" pour créer la carte professionnelle de cet artisan
                    </p>
                    <Button
                      onClick={handleGenerateCarte}
                      disabled={generatingCarte}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      {generatingCarte ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Génération...
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4 mr-2" />
                          Générer la carte
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Tab: Transactions */}
            {activeTab === 'transactions' && (
              <div className="text-center py-12">
                <div className="inline-flex p-4 bg-gray-100 rounded-full mb-4">
                  <TrendingUp className="h-12 w-12 text-gray-400" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  Aucune transaction
                </h3>
                <p className="text-sm text-gray-600">
                  Les transactions d'achat et de vente s'afficheront ici
                </p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}
