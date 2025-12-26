import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Calendar, RefreshCw, Clock } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Loading } from '@/components/ui/Loading';

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
        <Card className="bg-gradient-to-br from-red-50 to-white border-red-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Expirées</p>
              <p className="text-3xl font-bold text-red-600 mt-2">0</p>
              <p className="text-xs text-gray-500 mt-1">Renouvellement urgent</p>
            </div>
            <div className="p-3 bg-red-100 rounded-xl">
              <AlertTriangle className="h-6 w-6 text-red-600" />
            </div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-white border-orange-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">7 prochains jours</p>
              <p className="text-3xl font-bold text-orange-600 mt-2">0</p>
              <p className="text-xs text-gray-500 mt-1">Expiration imminente</p>
            </div>
            <div className="p-3 bg-orange-100 rounded-xl">
              <Clock className="h-6 w-6 text-orange-600" />
            </div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-50 to-white border-yellow-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">30 prochains jours</p>
              <p className="text-3xl font-bold text-yellow-600 mt-2">0</p>
              <p className="text-xs text-gray-500 mt-1">À surveiller</p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-xl">
              <Calendar className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">60 prochains jours</p>
              <p className="text-3xl font-bold text-blue-600 mt-2">0</p>
              <p className="text-xs text-gray-500 mt-1">Prévoir renouvellement</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-xl">
              <RefreshCw className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="text-center py-12">
          <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">
            Aucune carte en cours d'expiration.
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Les cartes professionnelles proches de leur date d'expiration apparaîtront ici.
          </p>
        </div>
      </Card>
    </div>
  );
}
