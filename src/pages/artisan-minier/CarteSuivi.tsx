import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { TrendingUp, Activity, BarChart3, Users } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Loading } from '@/components/ui/Loading';

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
        <Card className="bg-gradient-to-br from-purple-50 to-white border-purple-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Cartes actives</p>
              <p className="text-3xl font-bold text-purple-600 mt-2">0</p>
              <p className="text-xs text-gray-500 mt-1">En exploitation</p>
            </div>
            <div className="p-3 bg-purple-100 rounded-xl">
              <Activity className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Activités totales</p>
              <p className="text-3xl font-bold text-blue-600 mt-2">0</p>
              <p className="text-xs text-gray-500 mt-1">Transactions enregistrées</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-xl">
              <BarChart3 className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Performance</p>
              <p className="text-3xl font-bold text-emerald-600 mt-2">-</p>
              <p className="text-xs text-gray-500 mt-1">Moyenne mensuelle</p>
            </div>
            <div className="p-3 bg-emerald-100 rounded-xl">
              <TrendingUp className="h-6 w-6 text-emerald-600" />
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="text-center py-12">
          <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">
            Les données de suivi seront disponibles après l'enregistrement des artisans et de leurs activités.
          </p>
        </div>
      </Card>
    </div>
  );
}
