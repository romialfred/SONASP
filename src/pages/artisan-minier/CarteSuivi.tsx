import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { TrendingUp, Activity, BarChart3, Users, DollarSign, Package } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Loading } from '@/components/ui/Loading';
import { MainLayout } from '@/components/layout/MainLayout';
import { carteProfessionnelleService } from '@/services/carteProfessionnelleService';
import { supabase } from '@/lib/supabase';

export default function CarteSuivi() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [topArtisans, setTopArtisans] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      const dashboardStats = await carteProfessionnelleService.getDashboardStats();

      const { data: activitiesData } = await supabase
        .from('snp_artisan_activities')
        .select(`
          *,
          artisan:snp_artisans_miniers(nom, prenoms, raison_sociale, type_personne, type_artisan),
          carte:snp_cartes_professionnelles(numero_carte)
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      const { data: statsData } = await supabase
        .from('snp_carte_statistics')
        .select(`
          *,
          artisan:snp_artisans_miniers(nom, prenoms, raison_sociale, type_personne),
          carte:snp_cartes_professionnelles(numero_carte, statut)
        `)
        .order('montant_total_ventes', { ascending: false })
        .limit(5);

      const topArtisansMap = new Map();
      statsData?.forEach(stat => {
        const key = stat.artisan_id;
        if (!topArtisansMap.has(key)) {
          topArtisansMap.set(key, {
            artisan: stat.artisan,
            carte: stat.carte,
            total_ventes: 0,
            total_montant: 0,
            total_grammes: 0
          });
        }
        const current = topArtisansMap.get(key);
        current.total_ventes += stat.nombre_ventes || 0;
        current.total_montant += parseFloat(stat.montant_total_ventes as any) || 0;
        current.total_grammes += parseFloat(stat.quantite_totale_grammes as any) || 0;
      });

      setStats(dashboardStats);
      setActivities(activitiesData || []);
      setTopArtisans(Array.from(topArtisansMap.values()).slice(0, 5));

    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
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
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            Suivi des Cartes Professionnelles
          </h1>
          <p className="text-gray-600 mt-2 text-base">
            Statistiques et activités des artisans miniers
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-200 shadow-sm hover:shadow-lg transition-all duration-300">
            <div className="p-7">
              <div className="flex items-center justify-between mb-4">
                <div className="p-4 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-md">
                  <Activity className="h-8 w-8 text-white" />
                </div>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">
                  Cartes actives
                </p>
                <p className="text-5xl font-bold text-purple-600 mb-2">
                  {stats?.en_exploitation || 0}
                </p>
                <p className="text-sm text-gray-600 font-medium">En exploitation</p>
              </div>
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-200 shadow-sm hover:shadow-lg transition-all duration-300">
            <div className="p-7">
              <div className="flex items-center justify-between mb-4">
                <div className="p-4 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-md">
                  <BarChart3 className="h-8 w-8 text-white" />
                </div>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">
                  Activités totales
                </p>
                <p className="text-5xl font-bold text-blue-600 mb-2">
                  {activities.length}
                </p>
                <p className="text-sm text-gray-600 font-medium">Transactions récentes</p>
              </div>
            </div>
          </Card>

          <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-200 shadow-sm hover:shadow-lg transition-all duration-300">
            <div className="p-7">
              <div className="flex items-center justify-between mb-4">
                <div className="p-4 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl shadow-md">
                  <TrendingUp className="h-8 w-8 text-white" />
                </div>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">
                  Artisans actifs
                </p>
                <p className="text-5xl font-bold text-emerald-600 mb-2">
                  {topArtisans.length}
                </p>
                <p className="text-sm text-gray-600 font-medium">Avec transactions</p>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="shadow-sm">
            <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-white">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-600 rounded-lg">
                  <Activity className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">
                    Activités récentes
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    10 dernières transactions
                  </p>
                </div>
              </div>
            </div>
            <div className="divide-y divide-gray-200">
              {activities.length === 0 ? (
                <div className="p-12 text-center">
                  <Activity className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600">Aucune activité enregistrée</p>
                </div>
              ) : (
                activities.map((activity) => (
                  <div key={activity.id} className="p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <div className={`p-2 rounded-lg ${
                          activity.type_activite === 'vente' ? 'bg-green-100' :
                          activity.type_activite === 'collecte' ? 'bg-blue-100' :
                          'bg-purple-100'
                        }`}>
                          {activity.type_activite === 'vente' ? (
                            <DollarSign className={`h-5 w-5 ${
                              activity.type_activite === 'vente' ? 'text-green-600' :
                              activity.type_activite === 'collecte' ? 'text-blue-600' :
                              'text-purple-600'
                            }`} />
                          ) : (
                            <Package className={`h-5 w-5 ${
                              activity.type_activite === 'vente' ? 'text-green-600' :
                              activity.type_activite === 'collecte' ? 'text-blue-600' :
                              'text-purple-600'
                            }`} />
                          )}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">
                            {activity.artisan?.type_personne === 'physique'
                              ? `${activity.artisan?.nom} ${activity.artisan?.prenoms || ''}`
                              : activity.artisan?.raison_sociale
                            }
                          </h4>
                          <p className="text-sm text-gray-600 mt-1">{activity.description}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                            {activity.montant && (
                              <span>{new Intl.NumberFormat('fr-FR').format(activity.montant)} FCFA</span>
                            )}
                            {activity.quantite_grammes && (
                              <span>{activity.quantite_grammes.toFixed(2)} g</span>
                            )}
                            <span>{new Date(activity.created_at).toLocaleDateString('fr-FR')}</span>
                          </div>
                        </div>
                      </div>
                      <span className={`px-2 py-1 text-xs font-bold rounded ${
                        activity.type_activite === 'vente' ? 'bg-green-100 text-green-700' :
                        activity.type_activite === 'collecte' ? 'bg-blue-100 text-blue-700' :
                        'bg-purple-100 text-purple-700'
                      }`}>
                        {activity.type_activite}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="shadow-sm">
            <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-emerald-50 to-white">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-600 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">
                    Top 5 Artisans
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Par volume de ventes
                  </p>
                </div>
              </div>
            </div>
            <div className="divide-y divide-gray-200">
              {topArtisans.length === 0 ? (
                <div className="p-12 text-center">
                  <Users className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600">Aucune statistique disponible</p>
                </div>
              ) : (
                topArtisans.map((item, index) => (
                  <div key={index} className="p-5 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start gap-4">
                      <div className={`flex items-center justify-center w-10 h-10 rounded-full font-bold text-white ${
                        index === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-600' :
                        index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-500' :
                        index === 2 ? 'bg-gradient-to-br from-orange-400 to-orange-600' :
                        'bg-gradient-to-br from-blue-400 to-blue-600'
                      }`}>
                        #{index + 1}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-bold text-gray-900">
                          {item.artisan?.type_personne === 'physique'
                            ? `${item.artisan?.nom} ${item.artisan?.prenoms || ''}`
                            : item.artisan?.raison_sociale
                          }
                        </h4>
                        <div className="mt-2 space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Ventes:</span>
                            <span className="font-semibold text-gray-900">{item.total_ventes}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Montant:</span>
                            <span className="font-semibold text-emerald-600">
                              {new Intl.NumberFormat('fr-FR').format(item.total_montant)} FCFA
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-gray-600">Quantité:</span>
                            <span className="font-semibold text-blue-600">
                              {item.total_grammes.toFixed(2)} g
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
