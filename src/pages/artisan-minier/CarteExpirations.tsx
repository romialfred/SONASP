import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Calendar, RefreshCw, Clock, User, CreditCard } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loading } from '@/components/ui/Loading';
import { MainLayout } from '@/components/layout/MainLayout';
import { carteProfessionnelleService } from '@/services/carteProfessionnelleService';
import { useCustomAlert } from '@/hooks/useCustomAlert';

export default function CarteExpirations() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [cartesExpirees, setCartesExpirees] = useState<any[]>([]);
  const [cartes7jours, setCartes7jours] = useState<any[]>([]);
  const [cartes30jours, setCartes30jours] = useState<any[]>([]);
  const [cartes60jours, setCartes60jours] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'expirees' | '7j' | '30j' | '60j'>('7j');
  const { showAlert } = useCustomAlert();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      const allCartes = await carteProfessionnelleService.getAllCartes({
        statut: undefined
      });

      const now = new Date();
      const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const in60Days = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

      const expirees = allCartes?.filter(carte => {
        const expDate = new Date(carte.date_expiration);
        return expDate < now && carte.statut !== 'expiree';
      }) || [];

      const expire7j = allCartes?.filter(carte => {
        const expDate = new Date(carte.date_expiration);
        return expDate >= now && expDate <= in7Days && carte.statut === 'en_exploitation';
      }) || [];

      const expire30j = allCartes?.filter(carte => {
        const expDate = new Date(carte.date_expiration);
        return expDate > in7Days && expDate <= in30Days && carte.statut === 'en_exploitation';
      }) || [];

      const expire60j = allCartes?.filter(carte => {
        const expDate = new Date(carte.date_expiration);
        return expDate > in30Days && expDate <= in60Days && carte.statut === 'en_exploitation';
      }) || [];

      setCartesExpirees(expirees);
      setCartes7jours(expire7j);
      setCartes30jours(expire30j);
      setCartes60jours(expire60j);

    } catch (error) {
      console.error('Error loading data:', error);
      showAlert('error', 'Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const getJoursRestants = (dateExpiration: string): number => {
    const now = new Date();
    const expiration = new Date(dateExpiration);
    const diff = expiration.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const renderCartesList = (cartes: any[], urgence: 'critique' | 'haute' | 'moyenne' | 'faible') => {
    if (cartes.length === 0) {
      return (
        <div className="text-center py-12">
          <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">Aucune carte dans cette catégorie</p>
        </div>
      );
    }

    const urgenceColors = {
      critique: 'bg-red-100 border-red-300',
      haute: 'bg-orange-100 border-orange-300',
      moyenne: 'bg-yellow-100 border-yellow-300',
      faible: 'bg-blue-100 border-blue-300'
    };

    return (
      <div className="divide-y divide-gray-200">
        {cartes.map((carte) => {
          const joursRestants = getJoursRestants(carte.date_expiration);
          return (
            <div
              key={carte.id}
              className={`p-5 hover:bg-gray-50 transition-colors border-l-4 ${urgenceColors[urgence]}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                  <div className={`p-3 rounded-xl ${
                    urgence === 'critique' ? 'bg-red-200' :
                    urgence === 'haute' ? 'bg-orange-200' :
                    urgence === 'moyenne' ? 'bg-yellow-200' : 'bg-blue-200'
                  }`}>
                    <User className={`h-7 w-7 ${
                      urgence === 'critique' ? 'text-red-700' :
                      urgence === 'haute' ? 'text-orange-700' :
                      urgence === 'moyenne' ? 'text-yellow-700' : 'text-blue-700'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 mb-2">
                      {carte.artisan?.type_personne === 'physique'
                        ? `${carte.artisan?.nom} ${carte.artisan?.prenoms || ''}`
                        : carte.artisan?.raison_sociale
                      }
                    </h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center gap-2 text-gray-600">
                        <CreditCard className="h-4 w-4" />
                        <span>N° {carte.numero_carte}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-600">
                        <Calendar className="h-4 w-4" />
                        <span>Expire le: {new Date(carte.date_expiration).toLocaleDateString('fr-FR')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-bold">
                          {carte.artisan?.type_artisan}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-lg text-xs font-bold ${
                          joursRestants < 0 ? 'bg-red-200 text-red-800' :
                          joursRestants <= 7 ? 'bg-orange-200 text-orange-800' :
                          joursRestants <= 30 ? 'bg-yellow-200 text-yellow-800' :
                          'bg-blue-200 text-blue-800'
                        }`}>
                          {joursRestants < 0
                            ? `Expirée depuis ${Math.abs(joursRestants)} jours`
                            : `${joursRestants} jours restants`
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="ml-4">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-emerald-600 text-emerald-600 hover:bg-emerald-50"
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Renouveler
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
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
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Gestion des Expirations
          </h1>
          <p className="text-gray-600 mt-1">
            Suivi des cartes professionnelles en cours d'expiration
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card
            className={`bg-white border-red-200/60 shadow-sm hover:shadow-lg transition-all duration-300 hover:scale-[1.02] cursor-pointer ${
              activeTab === 'expirees' ? 'border-red-400 ring-2 ring-red-200' : ''
            }`}
            onClick={() => setActiveTab('expirees')}
          >
            <div className="flex items-center justify-between p-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-3 bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-lg">
                    <AlertTriangle className="h-7 w-7 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Expirées</p>
                  </div>
                </div>
                <div>
                  <p className="text-4xl font-bold text-red-600">{cartesExpirees.length}</p>
                  <p className="text-xs text-gray-500 mt-2 font-medium">Renouvellement urgent</p>
                </div>
              </div>
            </div>
          </Card>

          <Card
            className={`bg-white border-orange-200/60 shadow-sm hover:shadow-lg transition-all duration-300 hover:scale-[1.02] cursor-pointer ${
              activeTab === '7j' ? 'border-orange-400 ring-2 ring-orange-200' : ''
            }`}
            onClick={() => setActiveTab('7j')}
          >
            <div className="flex items-center justify-between p-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-3 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg">
                    <Clock className="h-7 w-7 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide">7 prochains jours</p>
                  </div>
                </div>
                <div>
                  <p className="text-4xl font-bold text-orange-600">{cartes7jours.length}</p>
                  <p className="text-xs text-gray-500 mt-2 font-medium">Expiration imminente</p>
                </div>
              </div>
            </div>
          </Card>

          <Card
            className={`bg-white border-yellow-200/60 shadow-sm hover:shadow-lg transition-all duration-300 hover:scale-[1.02] cursor-pointer ${
              activeTab === '30j' ? 'border-yellow-400 ring-2 ring-yellow-200' : ''
            }`}
            onClick={() => setActiveTab('30j')}
          >
            <div className="flex items-center justify-between p-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-3 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl shadow-lg">
                    <Calendar className="h-7 w-7 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide">30 prochains jours</p>
                  </div>
                </div>
                <div>
                  <p className="text-4xl font-bold text-yellow-600">{cartes30jours.length}</p>
                  <p className="text-xs text-gray-500 mt-2 font-medium">À surveiller</p>
                </div>
              </div>
            </div>
          </Card>

          <Card
            className={`bg-white border-blue-200/60 shadow-sm hover:shadow-lg transition-all duration-300 hover:scale-[1.02] cursor-pointer ${
              activeTab === '60j' ? 'border-blue-400 ring-2 ring-blue-200' : ''
            }`}
            onClick={() => setActiveTab('60j')}
          >
            <div className="flex items-center justify-between p-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg">
                    <RefreshCw className="h-7 w-7 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide">60 prochains jours</p>
                  </div>
                </div>
                <div>
                  <p className="text-4xl font-bold text-blue-600">{cartes60jours.length}</p>
                  <p className="text-xs text-gray-500 mt-2 font-medium">Prévoir renouvellement</p>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <Card className="shadow-sm">
          <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
            <h2 className="text-xl font-bold text-gray-900">
              {activeTab === 'expirees' && `Cartes expirées (${cartesExpirees.length})`}
              {activeTab === '7j' && `Expirant dans 7 jours (${cartes7jours.length})`}
              {activeTab === '30j' && `Expirant dans 30 jours (${cartes30jours.length})`}
              {activeTab === '60j' && `Expirant dans 60 jours (${cartes60jours.length})`}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {activeTab === 'expirees' && 'Ces cartes ont dépassé leur date d\'expiration et nécessitent un renouvellement immédiat'}
              {activeTab === '7j' && 'Attention: Ces cartes arrivent à expiration dans les 7 prochains jours'}
              {activeTab === '30j' && 'Prévoyez le renouvellement de ces cartes dans les 30 prochains jours'}
              {activeTab === '60j' && 'Planifiez le renouvellement de ces cartes dans les 60 prochains jours'}
            </p>
          </div>
          {activeTab === 'expirees' && renderCartesList(cartesExpirees, 'critique')}
          {activeTab === '7j' && renderCartesList(cartes7jours, 'haute')}
          {activeTab === '30j' && renderCartesList(cartes30jours, 'moyenne')}
          {activeTab === '60j' && renderCartesList(cartes60jours, 'faible')}
        </Card>
      </div>
    </MainLayout>
  );
}
