import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle, Clock, XCircle, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Loading } from '@/components/ui/Loading';

export default function CarteValidation() {
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
          Validation des Cartes Professionnelles
        </h1>
        <p className="text-gray-600 mt-1">
          Gérer les demandes de cartes en attente de validation
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-gradient-to-br from-orange-50 to-white border-orange-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">En attente</p>
              <p className="text-3xl font-bold text-orange-600 mt-2">0</p>
            </div>
            <div className="p-3 bg-orange-100 rounded-xl">
              <Clock className="h-6 w-6 text-orange-600" />
            </div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-emerald-50 to-white border-emerald-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Validées</p>
              <p className="text-3xl font-bold text-emerald-600 mt-2">0</p>
            </div>
            <div className="p-3 bg-emerald-100 rounded-xl">
              <CheckCircle className="h-6 w-6 text-emerald-600" />
            </div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-white border-red-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Rejetées</p>
              <p className="text-3xl font-bold text-red-600 mt-2">0</p>
            </div>
            <div className="p-3 bg-red-100 rounded-xl">
              <XCircle className="h-6 w-6 text-red-600" />
            </div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-white border-blue-200">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Total</p>
              <p className="text-3xl font-bold text-blue-600 mt-2">0</p>
            </div>
            <div className="p-3 bg-blue-100 rounded-xl">
              <CheckCircle className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="text-center py-12">
          <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">
            Aucune carte en attente de validation pour le moment.
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Les demandes de cartes professionnelles apparaîtront ici après l'enregistrement des artisans.
          </p>
        </div>
      </Card>
    </div>
  );
}
