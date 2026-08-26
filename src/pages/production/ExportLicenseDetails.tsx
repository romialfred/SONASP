import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Edit, FileText, Package, AlertCircle, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { MainLayout } from '@/components/layout/MainLayout';
import { exportLicenseService, ExportLicense } from '@/services/exportLicenseService';
import { supabase } from '@/lib/supabase';
import { formatDateStandard } from '@/utils/dateUtils';
import { formatStatusFr } from '@/utils/statusFormatter';
import { useMineWorkspace } from '@/hooks/useMineWorkspace';
import { errorMessage } from '@/lib/errorMessage';

interface ShipmentInfo {
  id: string;
  expedition_lot_number: string | null;
  total_net_weight_grams: number | null;
  status: string;
  prepared_at: string;
}

export function ExportLicenseDetails() {
  const { isMine, companyId: mineCompanyId } = useMineWorkspace();
  const navigate = useNavigate();
  const { id } = useParams();
  const [license, setLicense] = useState<ExportLicense | null>(null);
  const [shipments, setShipments] = useState<ShipmentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadLicenseData(id);
    }
  }, [id, isMine, mineCompanyId]);

  const loadLicenseData = async (licenseId: string) => {
    try {
      setLoading(true);
      setLoadError(null);
      const licenseData = await exportLicenseService.getLicenseById(
        licenseId,
        isMine ? mineCompanyId : undefined,
      );
      setLicense(licenseData);

      if (!licenseData) {
        setShipments([]);
        return;
      }

      // Load shipments using this license
      let shipmentQuery = supabase
        .from('shipping_preparations')
        .select('id, expedition_lot_number, total_net_weight_grams, status, prepared_at')
        .eq('license_id', licenseId);
      if (isMine && mineCompanyId) {
        shipmentQuery = shipmentQuery.eq('mining_company_id', mineCompanyId);
      }
      const { data: shipmentsData, error: shipmentsError } = await shipmentQuery
        .order('prepared_at', { ascending: false });
      if (shipmentsError) throw shipmentsError;

      setShipments(shipmentsData || []);
    } catch (error) {
      setLoadError(errorMessage(error, 'Impossible de charger cette licence.'));
      setLicense(null);
      setShipments([]);
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
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {loadError ? 'Chargement impossible' : 'Licence non trouvée'}
            </h3>
            {loadError && <p className="mb-4 text-sm text-red-700" role="alert">{loadError}</p>}
            <Button onClick={() => navigate('/production/licenses')}>
              Retour à la liste
            </Button>
          </Card>
        </div>
      </MainLayout>
    );
  }

  const usagePercentage = license.authorized_quantity_grams > 0
    ? (license.used_quantity_grams / license.authorized_quantity_grams) * 100
    : 0;
  const daysRemaining = Math.ceil((new Date(license.end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

  const getStatusBadge = () => {
    if (license.status === 'exhausted') {
      return <span className="px-2.5 py-1 text-xs font-semibold bg-red-100 text-red-800 rounded-full">Épuisée</span>;
    }
    if (new Date(license.end_date) < new Date()) {
      return <span className="px-2.5 py-1 text-xs font-semibold bg-gray-100 text-gray-800 rounded-full">Expirée</span>;
    }
    if (usagePercentage >= 90) {
      return <span className="px-2.5 py-1 text-xs font-semibold bg-orange-100 text-orange-800 rounded-full">Presque épuisée</span>;
    }
    if (license.status === 'active') {
      return <span className="px-2.5 py-1 text-xs font-semibold bg-green-100 text-green-800 rounded-full">Active</span>;
    }
    return <span className="px-2.5 py-1 text-xs font-semibold bg-blue-100 text-blue-800 rounded-full">{formatStatusFr(license.status)}</span>;
  };

  return (
    <MainLayout>
      <div className="px-6 py-4 max-w-7xl mx-auto">
        {/* Header - Compact */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Button
              onClick={() => navigate('/production/licenses')}
              variant="outline"
              size="sm"
              className="gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Retour
            </Button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{license.license_number}</h1>
              <p className="text-xs text-gray-500">Détails de la licence d'exportation</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {getStatusBadge()}
            {!isMine && (
              <Button
                onClick={() => navigate(`/production/licenses/edit/${id}`)}
                size="sm"
                className="gap-1.5"
              >
                <Edit className="w-3.5 h-3.5" />
                Modifier
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {/* Left Column - Main Info */}
          <div className="col-span-2 space-y-4">
            {/* Basic Information - Compact */}
            <Card className="p-4">
              <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-600" />
                Informations Générales
              </h2>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <div>
                  <label className="text-xs font-medium text-gray-500">Compagnie Minière</label>
                  <p className="text-sm font-semibold text-gray-900 mt-0.5">
                    {license.mining_company?.name} ({license.mining_company?.code})
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Institution Émettrice</label>
                  <p className="text-sm font-semibold text-gray-900 mt-0.5">{license.issuing_institution}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Date de Demande</label>
                  <p className="text-sm font-semibold text-gray-900 mt-0.5">
                    {formatDateStandard(license.request_date)}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">Période de Validité</label>
                  <p className="text-sm font-semibold text-gray-900 mt-0.5">
                    {formatDateStandard(license.start_date)} - {formatDateStandard(license.end_date)}
                  </p>
                </div>
                {license.average_sale_price && (
                  <div>
                    <label className="text-xs font-medium text-gray-500">Prix Moyen de Vente</label>
                    <p className="text-sm font-semibold text-gray-900 mt-0.5">
                      ${license.average_sale_price.toFixed(2)}/g
                    </p>
                  </div>
                )}
                <div>
                  <label className="text-xs font-medium text-gray-500">Jours Restants</label>
                  <p className={`text-sm font-semibold mt-0.5 ${daysRemaining <= 30 ? 'text-orange-600' : 'text-gray-900'}`}>
                    {daysRemaining > 0 ? `${daysRemaining} jours` : 'Expirée'}
                  </p>
                </div>
              </div>
              {license.comments && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <label className="text-xs font-medium text-gray-500">Commentaires</label>
                  <p className="text-sm text-gray-700 mt-0.5">{license.comments}</p>
                </div>
              )}
            </Card>

            {/* Quantity Tracking - Compact */}
            <Card className="p-4">
              <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-gray-600" />
                Suivi des Quantités
              </h2>

              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <p className="text-xs text-blue-600 font-medium mb-1">Autorisée</p>
                  <p className="text-lg font-bold text-blue-900">{license.authorized_quantity_grams.toLocaleString()}g</p>
                </div>
                <div className="text-center p-3 bg-orange-50 rounded-lg">
                  <p className="text-xs text-orange-600 font-medium mb-1">Utilisée</p>
                  <p className="text-lg font-bold text-orange-900">{license.used_quantity_grams.toLocaleString()}g</p>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <p className="text-xs text-green-600 font-medium mb-1">Restante</p>
                  <p className="text-lg font-bold text-green-900">{license.remaining_quantity_grams.toLocaleString()}g</p>
                </div>
              </div>

              {/* Progress Bar - Compact */}
              <div>
                <div className="flex items-center justify-between text-xs text-gray-600 mb-1.5">
                  <span>Utilisation</span>
                  <span className="font-semibold">{Math.round(usagePercentage)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5">
                  <div
                    className={`h-2.5 rounded-full transition-all ${
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

            {/* Shipments - Compact */}
            <Card className="p-4">
              <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
                <Package className="w-4 h-4 text-gray-600" />
                Expéditions ({shipments.length})
              </h2>
              {shipments.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-xs">Aucune expédition pour cette licence</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {shipments.map((shipment) => (
                    <div
                      key={shipment.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                      onClick={() => navigate(`/shipping/preparation/${shipment.id}`)}
                    >
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{shipment.expedition_lot_number}</p>
                        <p className="text-xs text-gray-600">
                          {formatDateStandard(shipment.prepared_at)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-900">
                          {shipment.total_net_weight_grams === null ? '—' : `${shipment.total_net_weight_grams.toLocaleString()}g`}
                        </p>
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          shipment.status === 'validated_for_refinery'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {formatStatusFr(shipment.status)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Right Column - Alerts & Stats - Compact */}
          <div className="space-y-4">
            {/* Alerts */}
            {(usagePercentage >= 90 || daysRemaining <= 30) && (
              <Card className="p-3 bg-orange-50 border-orange-200">
                <h3 className="text-xs font-bold text-orange-900 mb-2 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Alertes
                </h3>
                <ul className="space-y-1.5 text-xs text-orange-800">
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

            {/* Quick Stats - Compact */}
            <Card className="p-3">
              <h3 className="text-xs font-bold text-gray-900 mb-2.5">Statistiques Rapides</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Total Expéditions</span>
                  <span className="font-semibold text-gray-900">{shipments.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Poids Moyen</span>
                  <span className="font-semibold text-gray-900">
                    {shipments.length > 0
                      ? Math.round(license.used_quantity_grams / shipments.length).toLocaleString()
                      : 0}g
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                  <span className="text-gray-600">Créée le</span>
                  <span className="font-semibold text-gray-900">
                    {formatDateStandard(license.created_at)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Mise à jour</span>
                  <span className="font-semibold text-gray-900">
                    {formatDateStandard(license.updated_at)}
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
