import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText, Calendar, AlertCircle, TrendingUp, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { MainLayout } from '@/components/layout/MainLayout';
import { exportLicenseService, ExportLicense } from '@/services/exportLicenseService';

export function ExportLicensesPage() {
  const navigate = useNavigate();
  const [licenses, setLicenses] = useState<ExportLicense[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    loadLicenses();
  }, []);

  const loadLicenses = async () => {
    try {
      setLoading(true);
      const data = await exportLicenseService.getAllLicenses();
      setLicenses(data);
    } catch (error) {
      console.error('Error loading licenses:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (license: ExportLicense) => {
    const percentage = (license.used_quantity_grams / license.authorized_quantity_grams) * 100;

    if (license.status === 'exhausted') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold bg-gradient-to-r from-red-500 to-red-600 text-white rounded-full shadow-sm">
          <XCircle className="w-3 h-3" />
          Épuisée
        </span>
      );
    }
    if (new Date(license.end_date) < new Date()) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold bg-gradient-to-r from-gray-400 to-gray-500 text-white rounded-full shadow-sm">
          <Clock className="w-3 h-3" />
          Expirée
        </span>
      );
    }
    if (percentage >= 90) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-full shadow-sm animate-pulse">
          <AlertCircle className="w-3 h-3" />
          Presque épuisée
        </span>
      );
    }
    if (license.status === 'active') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-full shadow-sm">
          <CheckCircle className="w-3 h-3" />
          Active
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-full shadow-sm">
        {license.status}
      </span>
    );
  };

  const filteredLicenses = licenses.filter(license => {
    if (filter === 'active') return license.status === 'active' && new Date(license.end_date) >= new Date();
    if (filter === 'expired') return new Date(license.end_date) < new Date();
    if (filter === 'exhausted') return license.status === 'exhausted';
    return true;
  });

  // Calculate summary stats
  const activeLicenses = licenses.filter(l => l.status === 'active' && new Date(l.end_date) >= new Date());
  const totalAuthorized = activeLicenses.reduce((sum, l) => sum + l.authorized_quantity_grams, 0);
  const totalUsed = activeLicenses.reduce((sum, l) => sum + l.used_quantity_grams, 0);
  const totalRemaining = activeLicenses.reduce((sum, l) => sum + l.remaining_quantity_grams, 0);

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Licences d'Exportation</h1>
            <p className="text-xs text-gray-600 mt-1">Gestion et suivi des licences d'exportation d'or</p>
          </div>
          <Button
            onClick={() => navigate('/production/licenses/new')}
            className="gap-2 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
          >
            <Plus className="w-4 h-4" />
            Nouvelle Licence
          </Button>
        </div>

        {/* Summary Cards */}
        {activeLicenses.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-3 bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-300 hover:shadow-lg transition-all duration-300">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-blue-600 rounded-lg shadow-md">
                  <FileText className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-xs font-medium text-blue-700">Licences Actives</p>
                  <p className="text-lg font-semibold text-blue-900">{activeLicenses.length}</p>
                </div>
              </div>
            </Card>

            <Card className="p-3 bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-300 hover:shadow-lg transition-all duration-300">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-emerald-600 rounded-lg shadow-md">
                  <TrendingUp className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-xs font-medium text-emerald-700">Total Autorisé</p>
                  <p className="text-lg font-semibold text-emerald-900">{(totalAuthorized / 1000).toFixed(1)} kg</p>
                </div>
              </div>
            </Card>

            <Card className="p-3 bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-300 hover:shadow-lg transition-all duration-300">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-600 rounded-lg shadow-md">
                  <CheckCircle className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-xs font-medium text-amber-700">Utilisé</p>
                  <p className="text-lg font-semibold text-amber-900">{(totalUsed / 1000).toFixed(1)} kg</p>
                </div>
              </div>
            </Card>

            <Card className="p-3 bg-gradient-to-br from-green-50 to-green-100 border border-green-300 hover:shadow-lg transition-all duration-300">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-green-600 rounded-lg shadow-md">
                  <AlertCircle className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-xs font-medium text-green-700">Disponible</p>
                  <p className="text-lg font-semibold text-green-900">{(totalRemaining / 1000).toFixed(1)} kg</p>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card className="p-3">
          <div className="flex flex-wrap gap-2">
            <Button
              variant={filter === 'all' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
              className={`transition-all duration-300 text-sm ${
                filter === 'all'
                  ? 'bg-gradient-to-r from-blue-600 to-blue-700 shadow-md'
                  : 'hover:bg-gray-100 hover:shadow-sm'
              }`}
            >
              <span className="font-medium">Toutes</span>
              <span className="ml-2 px-1.5 py-0.5 bg-white/20 rounded-full text-xs">{licenses.length}</span>
            </Button>
            <Button
              variant={filter === 'active' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setFilter('active')}
              className={`transition-all duration-300 text-sm ${
                filter === 'active'
                  ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 shadow-md'
                  : 'hover:bg-emerald-50 hover:shadow-sm'
              }`}
            >
              <span className="font-medium">Actives</span>
              <span className="ml-2 px-1.5 py-0.5 bg-white/20 rounded-full text-xs">
                {licenses.filter(l => l.status === 'active' && new Date(l.end_date) >= new Date()).length}
              </span>
            </Button>
            <Button
              variant={filter === 'expired' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setFilter('expired')}
              className={`transition-all duration-300 text-sm ${
                filter === 'expired'
                  ? 'bg-gradient-to-r from-gray-600 to-gray-700 shadow-md'
                  : 'hover:bg-gray-50 hover:shadow-sm'
              }`}
            >
              <span className="font-medium">Expirées</span>
              <span className="ml-2 px-1.5 py-0.5 bg-white/20 rounded-full text-xs">
                {licenses.filter(l => new Date(l.end_date) < new Date()).length}
              </span>
            </Button>
            <Button
              variant={filter === 'exhausted' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setFilter('exhausted')}
              className={`transition-all duration-300 text-sm ${
                filter === 'exhausted'
                  ? 'bg-gradient-to-r from-red-600 to-red-700 shadow-md'
                  : 'hover:bg-red-50 hover:shadow-sm'
              }`}
            >
              <span className="font-medium">Épuisées</span>
              <span className="ml-2 px-1.5 py-0.5 bg-white/20 rounded-full text-xs">
                {licenses.filter(l => l.status === 'exhausted').length}
              </span>
            </Button>
          </div>
        </Card>

        {/* Licenses List */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-gray-600 text-sm">Chargement des licences...</p>
            </div>
          </div>
        ) : filteredLicenses.length === 0 ? (
          <Card className="p-12 text-center bg-gradient-to-br from-gray-50 to-white">
            <div className="max-w-md mx-auto">
              <div className="mb-6 relative">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-200 to-blue-200 rounded-full blur-3xl opacity-30"></div>
                <FileText className="w-20 h-20 mx-auto text-gray-300 relative" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Aucune licence trouvée</h3>
              <p className="text-sm text-gray-600 mb-6">Commencez par créer votre première licence d'exportation</p>
              <Button
                onClick={() => navigate('/production/licenses/new')}
                className="gap-2 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 shadow-lg"
              >
                <Plus className="w-4 h-4" />
                Nouvelle Licence
              </Button>
            </div>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredLicenses.map((license) => {
              const percentage = (license.used_quantity_grams / license.authorized_quantity_grams) * 100;
              const isExpiring = new Date(license.end_date).getTime() - new Date().getTime() < 30 * 24 * 60 * 60 * 1000;

              return (
                <Card
                  key={license.id}
                  className="group relative p-4 hover:shadow-xl transition-all duration-300 cursor-pointer bg-gradient-to-br from-white to-gray-50 border border-gray-300 hover:border-emerald-300 transform hover:scale-[1.01]"
                  onClick={() => navigate(`/production/licenses/${license.id}`)}
                >
                  {/* Background gradient effect on hover */}
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-50/0 via-blue-50/0 to-purple-50/0 group-hover:from-emerald-50/30 group-hover:via-blue-50/20 group-hover:to-purple-50/10 rounded-lg transition-all duration-500"></div>

                  <div className="relative">
                    <div className="flex items-start justify-between mb-2.5">
                      <div className="flex-1">
                        <div className="flex items-center gap-2.5 mb-1.5">
                          <h3 className="text-base font-semibold text-gray-900 group-hover:text-emerald-700 transition-colors duration-300">
                            {license.license_number}
                          </h3>
                          {getStatusBadge(license)}
                          {isExpiring && license.status === 'active' && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full animate-pulse">
                              <Clock className="w-3 h-3" />
                              Expire bientôt
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-gray-700 text-sm">
                          <span className="font-medium">{license.mining_company?.name}</span>
                          <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 text-xs font-mono rounded">
                            {license.mining_company?.code}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                      <div className="space-y-0.5">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Institution</p>
                        <p className="text-sm text-gray-900">{license.issuing_institution}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Période</p>
                        <p className="text-sm text-gray-900">
                          {new Date(license.start_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} - {new Date(license.end_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Autorisée</p>
                        <p className="text-sm font-semibold text-blue-700">{(license.authorized_quantity_grams / 1000).toFixed(2)} kg</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Disponible</p>
                        <p className="text-sm font-semibold text-emerald-700">{(license.remaining_quantity_grams / 1000).toFixed(2)} kg</p>
                      </div>
                    </div>

                    {/* Enhanced Progress bar */}
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <TrendingUp className="w-3 h-3 text-gray-600" />
                          <span className="font-medium text-gray-700">Utilisation</span>
                        </div>
                        <span className={`font-semibold text-sm ${
                          percentage >= 90 ? 'text-red-600' :
                          percentage >= 70 ? 'text-orange-600' :
                          'text-emerald-600'
                        }`}>
                          {Math.round(percentage)}%
                        </span>
                      </div>
                      <div className="relative w-full bg-gray-200 rounded-full h-2 overflow-hidden shadow-inner">
                        <div
                          className={`h-full rounded-full transition-all duration-700 relative ${
                            percentage >= 90 ? 'bg-gradient-to-r from-red-500 to-red-600' :
                            percentage >= 70 ? 'bg-gradient-to-r from-orange-500 to-orange-600' :
                            'bg-gradient-to-r from-emerald-500 to-emerald-600'
                          }`}
                          style={{
                            width: `${Math.min(percentage, 100)}%`,
                          }}
                        >
                          <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                        </div>
                      </div>
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>{(license.used_quantity_grams / 1000).toFixed(2)} kg utilisés</span>
                        <span>{(license.remaining_quantity_grams / 1000).toFixed(2)} kg restants</span>
                      </div>
                    </div>
                  </div>

                  {/* Hover indicator */}
                  <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="p-1.5 bg-emerald-600 rounded-full shadow-lg">
                      <Calendar className="w-3.5 h-3.5 text-white" />
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
