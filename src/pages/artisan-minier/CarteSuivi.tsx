import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { TrendingUp, Activity, BarChart3, Users } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Loading } from '@/components/ui/Loading';
import { MainLayout } from '@/components/layout/MainLayout';

export default function CarteSuivi() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simuler le chargement
    setTimeout(() => setLoading(false), 500);
  }, []);

  if (loading) {
    return <Loading />;
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Suivi des Cartes Professionnelles
          </h1>
          <p className="text-gray-600 mt-1">
            Statistiques et activités des artisans miniers
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Cartes actives */}
          <Card className="bg-white border-purple-200/60 shadow-sm hover:shadow-lg transition-all duration-300 hover:scale-[1.02] hover:border-purple-300">
            <div className="flex items-center justify-between p-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-3 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg">
                    <Activity className="h-7 w-7 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Cartes actives</p>
                  </div>
                </div>
                <div>
                  <p className="text-4xl font-bold text-purple-600">0</p>
                  <p className="text-xs text-gray-500 mt-2 font-medium">En exploitation</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Activités totales */}
          <Card className="bg-white border-blue-200/60 shadow-sm hover:shadow-lg transition-all duration-300 hover:scale-[1.02] hover:border-blue-300">
            <div className="flex items-center justify-between p-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-3 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg">
                    <BarChart3 className="h-7 w-7 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Activités totales</p>
                  </div>
                </div>
                <div>
                  <p className="text-4xl font-bold text-blue-600">0</p>
                  <p className="text-xs text-gray-500 mt-2 font-medium">Transactions enregistrées</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Performance */}
          <Card className="bg-white border-emerald-200/60 shadow-sm hover:shadow-lg transition-all duration-300 hover:scale-[1.02] hover:border-emerald-300">
            <div className="flex items-center justify-between p-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-3 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl shadow-lg">
                    <TrendingUp className="h-7 w-7 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Performance</p>
                  </div>
                </div>
                <div>
                  <p className="text-4xl font-bold text-emerald-600">-</p>
                  <p className="text-xs text-gray-500 mt-2 font-medium">Moyenne mensuelle</p>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <Card>
          <div className="text-center py-16">
            <div className="inline-flex p-4 bg-gray-100 rounded-full mb-4">
              <BarChart3 className="h-12 w-12 text-gray-400" />
            </div>
            <p className="text-gray-600 text-lg font-medium">
              Les données de suivi seront disponibles après l'enregistrement des artisans et de leurs activités.
            </p>
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}
