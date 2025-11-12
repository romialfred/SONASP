import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText, Calendar, AlertCircle } from 'lucide-react';
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
      return <span className="px-2 py-1 text-xs font-semibold bg-red-100 text-red-800 rounded">Épuisée</span>;
    }
    if (new Date(license.end_date) < new Date()) {
      return <span className="px-2 py-1 text-xs font-semibold bg-gray-100 text-gray-800 rounded">Expirée</span>;
    }
    if (percentage >= 90) {
      return <span className="px-2 py-1 text-xs font-semibold bg-orange-100 text-orange-800 rounded">Presque épuisée</span>;
    }
    if (license.status === 'active') {
      return <span className="px-2 py-1 text-xs font-semibold bg-green-100 text-green-800 rounded">Active</span>;
    }
    return <span className="px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-800 rounded">{license.status}</span>;
  };

  const filteredLicenses = licenses.filter(license => {
    if (filter === 'active') return license.status === 'active' && new Date(license.end_date) >= new Date();
    if (filter === 'expired') return new Date(license.end_date) < new Date();
    if (filter === 'exhausted') return license.status === 'exhausted';
    return true;
  });

  return (
    <MainLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Licences d'Exportation</h1>
            <p className="text-sm text-gray-600">Gestion des licences d'exportation d'or</p>
          </div>
          <Button onClick={() => navigate('/production/licenses/new')} className="gap-2">
            <Plus className="w-4 h-4" />
            Nouvelle Licence
          </Button>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-6">
          <Button
            variant={filter === 'all' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            Toutes ({licenses.length})
          </Button>
          <Button
            variant={filter === 'active' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setFilter('active')}
          >
            Actives ({licenses.filter(l => l.status === 'active' && new Date(l.end_date) >= new Date()).length})
          </Button>
          <Button
            variant={filter === 'expired' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setFilter('expired')}
          >
            Expirées ({licenses.filter(l => new Date(l.end_date) < new Date()).length})
          </Button>
          <Button
            variant={filter === 'exhausted' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setFilter('exhausted')}
          >
            Épuisées ({licenses.filter(l => l.status === 'exhausted').length})
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-12">Chargement...</div>
        ) : filteredLicenses.length === 0 ? (
          <Card className="p-12 text-center">
            <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Aucune licence</h3>
            <p className="text-gray-600 mb-4">Commencez par créer une nouvelle licence d'exportation</p>
            <Button onClick={() => navigate('/production/licenses/new')} className="gap-2">
              <Plus className="w-4 h-4" />
              Nouvelle Licence
            </Button>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredLicenses.map((license) => (
              <Card
                key={license.id}
                className="p-6 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => navigate(`/production/licenses/${license.id}`)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-bold text-gray-900">{license.license_number}</h3>
                      {getStatusBadge(license)}
                    </div>
                    <p className="text-sm text-gray-600 mb-3">
                      {license.mining_company?.name} ({license.mining_company?.code})
                    </p>
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Institution:</span>
                        <p className="font-medium">{license.issuing_institution}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Période:</span>
                        <p className="font-medium">
                          {new Date(license.start_date).toLocaleDateString('fr-FR')} - {new Date(license.end_date).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500">Autorisée:</span>
                        <p className="font-medium">{license.authorized_quantity_grams.toLocaleString()} g</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Restante:</span>
                        <p className="font-medium text-green-600">{license.remaining_quantity_grams.toLocaleString()} g</p>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                        <span>Utilisation</span>
                        <span>{Math.round((license.used_quantity_grams / license.authorized_quantity_grams) * 100)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            (license.used_quantity_grams / license.authorized_quantity_grams) * 100 >= 90
                              ? 'bg-red-500'
                              : (license.used_quantity_grams / license.authorized_quantity_grams) * 100 >= 70
                              ? 'bg-orange-500'
                              : 'bg-green-500'
                          }`}
                          style={{
                            width: `${Math.min((license.used_quantity_grams / license.authorized_quantity_grams) * 100, 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
