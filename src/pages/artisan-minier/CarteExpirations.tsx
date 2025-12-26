import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Calendar, RefreshCw, Clock } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Loading } from '@/components/ui/Loading';
import { MainLayout } from '@/components/layout/MainLayout';

export default function CarteExpirations() {
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
            Gestion des Expirations
          </h1>
          <p className="text-gray-600 mt-1">
            Suivi des cartes professionnelles en cours d'expiration
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Expirées */}
          <Card className="bg-white border-red-200/60 shadow-sm hover:shadow-lg transition-all duration-300 hover:scale-[1.02] hover:border-red-300">
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
                  <p className="text-4xl font-bold text-red-600">0</p>
                  <p className="text-xs text-gray-500 mt-2 font-medium">Renouvellement urgent</p>
                </div>
              </div>
            </div>
          </Card>

          {/* 7 prochains jours */}
          <Card className="bg-white border-orange-200/60 shadow-sm hover:shadow-lg transition-all duration-300 hover:scale-[1.02] hover:border-orange-300">
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
                  <p className="text-4xl font-bold text-orange-600">0</p>
                  <p className="text-xs text-gray-500 mt-2 font-medium">Expiration imminente</p>
                </div>
              </div>
            </div>
          </Card>

          {/* 30 prochains jours */}
          <Card className="bg-white border-yellow-200/60 shadow-sm hover:shadow-lg transition-all duration-300 hover:scale-[1.02] hover:border-yellow-300">
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
                  <p className="text-4xl font-bold text-yellow-600">0</p>
                  <p className="text-xs text-gray-500 mt-2 font-medium">À surveiller</p>
                </div>
              </div>
            </div>
          </Card>

          {/* 60 prochains jours */}
          <Card className="bg-white border-blue-200/60 shadow-sm hover:shadow-lg transition-all duration-300 hover:scale-[1.02] hover:border-blue-300">
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
                  <p className="text-4xl font-bold text-blue-600">0</p>
                  <p className="text-xs text-gray-500 mt-2 font-medium">Prévoir renouvellement</p>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <Card>
          <div className="text-center py-16">
            <div className="inline-flex p-4 bg-gray-100 rounded-full mb-4">
              <Calendar className="h-12 w-12 text-gray-400" />
            </div>
            <p className="text-gray-600 text-lg font-medium mb-2">
              Aucune carte en cours d'expiration.
            </p>
            <p className="text-sm text-gray-500">
              Les cartes professionnelles proches de leur date d'expiration apparaîtront ici.
            </p>
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}
