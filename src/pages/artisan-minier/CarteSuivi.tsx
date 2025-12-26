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
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            Suivi des Cartes Professionnelles
          </h1>
          <p className="text-gray-600 mt-2 text-base">
            Statistiques et activités des artisans miniers
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Cartes actives */}
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
                <p className="text-5xl font-bold text-purple-600 mb-2">0</p>
                <p className="text-sm text-gray-600 font-medium">En exploitation</p>
              </div>
            </div>
          </Card>

          {/* Activités totales */}
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
                <p className="text-5xl font-bold text-blue-600 mb-2">0</p>
                <p className="text-sm text-gray-600 font-medium">Transactions enregistrées</p>
              </div>
            </div>
          </Card>

          {/* Performance */}
          <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-200 shadow-sm hover:shadow-lg transition-all duration-300">
            <div className="p-7">
              <div className="flex items-center justify-between mb-4">
                <div className="p-4 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl shadow-md">
                  <TrendingUp className="h-8 w-8 text-white" />
                </div>
              </div>
              <div>
                <p className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-3">
                  Performance
                </p>
                <p className="text-5xl font-bold text-emerald-600 mb-2">-</p>
                <p className="text-sm text-gray-600 font-medium">Moyenne mensuelle</p>
              </div>
            </div>
          </Card>
        </div>

        <Card className="shadow-sm">
          <div className="text-center py-20 px-6">
            <div className="inline-flex p-6 bg-gradient-to-br from-gray-100 to-gray-50 rounded-2xl mb-6 shadow-sm">
              <BarChart3 className="h-16 w-16 text-gray-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">
              Données en attente
            </h3>
            <p className="text-gray-600 text-base font-medium max-w-2xl mx-auto">
              Les données de suivi seront disponibles après l'enregistrement des artisans et de leurs activités.
            </p>
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}
