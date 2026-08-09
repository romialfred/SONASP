import { useState, useEffect } from 'react';
import { CheckCircle, Clock, XCircle, CheckCircle2, User, CreditCard, Calendar, Check } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loading } from '@/components/ui/Loading';
import { MainLayout } from '@/components/layout/MainLayout';
import { carteProfessionnelleService } from '@/services/carteProfessionnelleService';
import { useCustomAlert } from '@/hooks/useCustomAlert';

export default function CarteValidation() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [cartesEnCours, setCartesEnCours] = useState<any[]>([]);
  const { showAlert } = useCustomAlert();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [dashboardStats, enCoursCartes] = await Promise.all([
        carteProfessionnelleService.getDashboardStats(),
        carteProfessionnelleService.getCartesEnCours()
      ]);
      setStats(dashboardStats);
      setCartesEnCours(enCoursCartes || []);
    } catch (error) {
      console.error('Error loading data:', error);
      showAlert('Erreur lors du chargement des données', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleValider = async (carteId: string) => {
    try {
      await carteProfessionnelleService.valider(carteId);
      showAlert('Carte validée avec succès', 'success');
      await loadData();
    } catch (error) {
      console.error('Error validating carte:', error);
      showAlert('Erreur lors de la validation', 'error');
    }
  };

  if (loading) {
    return <Loading />;
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Validation des Cartes Professionnelles
          </h1>
          <p className="text-gray-600 mt-1">
            Gérer les demandes de cartes en attente de validation
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* En attente */}
          <Card className="bg-white border-orange-200/60 shadow-sm hover:shadow-lg transition-all duration-300 hover:scale-[1.02] hover:border-orange-300">
            <div className="flex items-center justify-between p-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-3 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl shadow-lg">
                    <Clock className="h-7 w-7 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide">En attente</p>
                  </div>
                </div>
                <div>
                  <p className="text-4xl font-bold text-orange-600">{stats?.en_cours || 0}</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Validées */}
          <Card className="bg-white border-emerald-200/60 shadow-sm hover:shadow-lg transition-all duration-300 hover:scale-[1.02] hover:border-emerald-300">
            <div className="flex items-center justify-between p-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-3 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl shadow-lg">
                    <CheckCircle className="h-7 w-7 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Validées</p>
                  </div>
                </div>
                <div>
                  <p className="text-4xl font-bold text-emerald-600">{stats?.validees || 0}</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Suspendues */}
          <Card className="bg-white border-red-200/60 shadow-sm hover:shadow-lg transition-all duration-300 hover:scale-[1.02] hover:border-red-300">
            <div className="flex items-center justify-between p-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-3 bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-lg">
                    <XCircle className="h-7 w-7 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Suspendues</p>
                  </div>
                </div>
                <div>
                  <p className="text-4xl font-bold text-red-600">{stats?.suspendues || 0}</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Total */}
          <Card className="bg-white border-blue-200/60 shadow-sm hover:shadow-lg transition-all duration-300 hover:scale-[1.02] hover:border-blue-300">
            <div className="flex items-center justify-between p-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg">
                    <CheckCircle2 className="h-7 w-7 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Total</p>
                  </div>
                </div>
                <div>
                  <p className="text-4xl font-bold text-blue-600">{stats?.total || 0}</p>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {cartesEnCours.length === 0 ? (
          <Card>
            <div className="text-center py-16">
              <div className="inline-flex p-4 bg-gray-100 rounded-full mb-4">
                <CheckCircle className="h-12 w-12 text-gray-400" />
              </div>
              <p className="text-gray-600 text-lg font-medium mb-2">
                Aucune carte en attente de validation pour le moment.
              </p>
              <p className="text-sm text-gray-500">
                Les demandes de cartes professionnelles apparaîtront ici après l'enregistrement des artisans.
              </p>
            </div>
          </Card>
        ) : (
          <Card className="shadow-sm">
            <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-orange-50 to-white">
              <h2 className="text-xl font-bold text-gray-900">
                Cartes en attente de validation ({cartesEnCours.length})
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Vérifiez les informations et validez les cartes professionnelles
              </p>
            </div>
            <div className="divide-y divide-gray-200">
              {cartesEnCours.map((carte) => (
                <div key={carte.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="p-4 bg-orange-100 rounded-xl">
                        <User className="h-8 w-8 text-orange-600" />
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
                            <span>Délivrance: {new Date(carte.date_delivrance).toLocaleDateString('fr-FR')}</span>
                          </div>
                          <div className="flex items-center gap-2 text-gray-600">
                            <Calendar className="h-4 w-4" />
                            <span>Expiration: {new Date(carte.date_expiration).toLocaleDateString('fr-FR')}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-bold">
                              {carte.artisan?.type_artisan}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 ml-4">
                      <Button
                        onClick={() => handleValider(carte.id)}
                        size="sm"
                        className="bg-emerald-600 hover:bg-emerald-700"
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Valider
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
