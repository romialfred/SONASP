import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle, Clock, XCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Loading } from '@/components/ui/Loading';
import { MainLayout } from '@/components/layout/MainLayout';

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
                  <p className="text-4xl font-bold text-orange-600">0</p>
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
                  <p className="text-4xl font-bold text-emerald-600">0</p>
                </div>
              </div>
            </div>
          </Card>

          {/* Rejetées */}
          <Card className="bg-white border-red-200/60 shadow-sm hover:shadow-lg transition-all duration-300 hover:scale-[1.02] hover:border-red-300">
            <div className="flex items-center justify-between p-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-3 bg-gradient-to-br from-red-500 to-red-600 rounded-xl shadow-lg">
                    <XCircle className="h-7 w-7 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Rejetées</p>
                  </div>
                </div>
                <div>
                  <p className="text-4xl font-bold text-red-600">0</p>
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
                  <p className="text-4xl font-bold text-blue-600">0</p>
                </div>
              </div>
            </div>
          </Card>
        </div>

        <Card>
          <div className="text-center py-16">
            <div className="inline-flex p-4 bg-gray-100 rounded-full mb-4">
              <AlertTriangle className="h-12 w-12 text-gray-400" />
            </div>
            <p className="text-gray-600 text-lg font-medium mb-2">
              Aucune carte en attente de validation pour le moment.
            </p>
            <p className="text-sm text-gray-500">
              Les demandes de cartes professionnelles apparaîtront ici après l'enregistrement des artisans.
            </p>
          </div>
        </Card>
      </div>
    </MainLayout>
  );
}
