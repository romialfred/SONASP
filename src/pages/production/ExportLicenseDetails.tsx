import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Edit, FileText, Calendar, DollarSign, Package, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { MainLayout } from '@/components/layout/MainLayout';
import { exportLicenseService, ExportLicense } from '@/services/exportLicenseService';
import { supabase } from '@/lib/supabase';

interface ShipmentInfo {
  id: string;
  expedition_lot_number: string;
  total_net_weight_grams: number;
  status: string;
  prepared_at: string;
}

export function ExportLicenseDetails() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [license, setLicense] = useState<ExportLicense | null>(null);
  const [shipments, setShipments] = useState<ShipmentInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadLicenseData(id);
    }
  }, [id]);

  const loadLicenseData = async (licenseId: string) => {
    try {
      setLoading(true);
      const licenseData = await exportLicenseService.getLicenseById(licenseId);
      setLicense(licenseData);

      // Load shipments using this license
      const { data: shipmentsData } = await supabase
        .from('shipping_preparations')
        .select('id, expedition_lot_number, total_net_weight_grams, status, prepared_at')
        .eq('license_id', licenseId)
        .order('prepared_at', { ascending: false });

      setShipments(shipmentsData || []);
    } catch (error) {
      console.error('Error loading license data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-600">Chargement...</div>
        </div>
      </MainLayout>
    );
  }

  if (!license) {
    return (
      <MainLayout>
        <div className="p-6">
          <Card className="p-12 text-center">
            <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-300" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Licence non trouvée</h3>
            <Button onClick={() => navigate('/production/licenses')}>
              Retour à la liste
            </Button>
          </Card>
        </div>
      </MainLayout>
    );
  }

  const usagePercentage = (license.used_quantity_grams / license.authorized_quantity_grams) * 100;
  const daysRemaining = Math.ceil((new Date(license.end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

  const getStatusBadge = () => {
    if (license.status === 'exhausted') {
      return <span className="px-3 py-1 text-sm font-semibold bg-red-100 text-red-800 rounded-full">Épuisée</span>;
    }
    if (new Date(license.end_date) < new Date()) {
      return <span className="px-3 py-1 text-sm font-semibold bg-gray-100 text-gray-800 rounded-full">Expirée</span>;
    }
    if (usagePercentage >= 90) {
      return <span className="px-3 py-1 text-sm font-semibold bg-orange-100 text-orange-800 rounded-full">Presque épuisée</span>;
    }
    if (license.status === 'active') {
      return <span className="px-3 py-1 text-sm font-semibold bg-green-100 text-green-800 rounded-full">Active</span>;
    }
    return <span className="px-3 py-1 text-sm font-semibold bg-blue-100 text-blue-800 rounded-full">{license.status}</span>;
  };

  return (
    <MainLayout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              onClick={() => navigate('/production/licenses')}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Retour
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{license.license_number}</h1>
              <p className="text-sm text-gray-600">Détails de la licence d'exportation</p>
            </div>
          </div>
          <Button
            onClick={() => navigate(`/production/licenses/edit/${id}`)}
            className="gap-2"
          >
            <Edit className="w-4 h-4" />
            Modifier
          </Button>
        </div>

        {/* Status Badge */}
        <div className="mb-6">
          {getStatusBadge()}
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* Left Column - Main Info */}
          <div className="col-span-2 space-y-6">
            {/* Basic Information */}
            <Card className="p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Informations Générales</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">Compagnie Minière</label>
                  <p className="text-base font-semibold text-gray-900">
                    {license.mining_company?.name} ({license.mining_company?.code})
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Institution Émettrice</label>
                  <p className="text-base font-semibold text-gray-900">{license.issuing_institution}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Date de Demande</label>
                  <p className="text-base font-semibold text-gray-900">
                    {new Date(license.request_date).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Période de Validité</label>
                  <p className="text-base font-semibold text-gray-900">
                    {new Date(license.start_date).toLocaleDateString('fr-FR')} - {new Date(license.end_date).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                {license.average_sale_price && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">Prix Moyen de Vente</label>
                    <p className="text-base font-semibold text-gray-900">
                      ${license.average_sale_price.toFixed(2)}/g
                    </p>
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-gray-500">Jours Restants</label>
                  <p className={`text-base font-semibold ${daysRemaining <= 30 ? 'text-orange-600' : 'text-gray-900'}`}>
                    {daysRemaining > 0 ? `${daysRemaining} jours` : 'Expirée'}
                  </p>
                </div>
              </div>
              {license.comments && (
                <div className="mt-4">
                  <label className="text-sm font-medium text-gray-500">Commentaires</label>
                  <p className="text-base text-gray-700 mt-1">{license.comments}</p>
                </div>
              )}
            </Card>

            {/* Quantity Tracking */}
            <Card className="p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Suivi des Quantités</h2>

              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-600 font-medium">Autorisée</p>
                  <p className="text-2xl font-bold text-blue-900">{license.authorized_quantity_grams.toLocaleString()}g</p>
                </div>
                <div className="text-center p-4 bg-orange-50 rounded-lg">
                  <p className="text-sm text-orange-600 font-medium">Utilisée</p>
                  <p className="text-2xl font-bold text-orange-900">{license.used_quantity_grams.toLocaleString()}g</p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-green-600 font-medium">Restante</p>
                  <p className="text-2xl font-bold text-green-900">{license.remaining_quantity_grams.toLocaleString()}g</p>
                </div>
              </div>

              {/* Progress Bar */}
              <div>
                <div className="flex items-center justify-between text-sm text-gray-600 mb-2">
                  <span>Utilisation</span>
                  <span className="font-semibold">{Math.round(usagePercentage)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-4">
                  <div
                    className={`h-4 rounded-full transition-all ${
                      usagePercentage >= 90
                        ? 'bg-red-500'
                        : usagePercentage >= 70
                        ? 'bg-orange-500'
                        : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                  />
                </div>
              </div>
            </Card>

            {/* Shipments */}
            <Card className="p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">
                Expéditions ({shipments.length})
              </h2>
              {shipments.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Aucune expédition pour cette licence</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {shipments.map((shipment) => (
                    <div
                      key={shipment.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                      onClick={() => navigate(`/shipping/preparation/${shipment.id}`)}
                    >
                      <div>
                        <p className="font-semibold text-gray-900">{shipment.expedition_lot_number}</p>
                        <p className="text-sm text-gray-600">
                          {new Date(shipment.prepared_at).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">
                          {shipment.total_net_weight_grams.toLocaleString()}g
                        </p>
                        <span className={`text-xs px-2 py-1 rounded ${
                          shipment.status === 'shipped'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {shipment.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Right Column - Alerts & Stats */}
          <div className="space-y-6">
            {/* Alerts */}
            {(usagePercentage >= 90 || daysRemaining <= 30) && (
              <Card className="p-4 bg-orange-50 border-orange-200">
                <h3 className="text-sm font-bold text-orange-900 mb-2 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  Alertes
                </h3>
                <ul className="space-y-2 text-sm text-orange-800">
                  {usagePercentage >= 90 && (
                    <li>• Licence presque épuisée ({Math.round(usagePercentage)}%)</li>
                  )}
                  {daysRemaining <= 30 && daysRemaining > 0 && (
                    <li>• Expire dans {daysRemaining} jours</li>
                  )}
                  {daysRemaining <= 0 && (
                    <li>• Licence expirée</li>
                  )}
                </ul>
              </Card>
            )}

            {/* Quick Stats */}
            <Card className="p-4">
              <h3 className="text-sm font-bold text-gray-900 mb-3">Statistiques Rapides</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Expéditions</span>
                  <span className="font-semibold">{shipments.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Poids Moyen</span>
                  <span className="font-semibold">
                    {shipments.length > 0
                      ? Math.round(license.used_quantity_grams / shipments.length).toLocaleString()
                      : 0}g
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Créée le</span>
                  <span className="font-semibold">
                    {new Date(license.created_at).toLocaleDateString('fr-FR')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Mise à jour</span>
                  <span className="font-semibold">
                    {new Date(license.updated_at).toLocaleDateString('fr-FR')}
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
