import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, CheckCircle, Eye, TrendingUp, AlertCircle, Building2 } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loading } from '@/components/ui/Loading';
import { freightShipmentService, FreightShipment } from '@/services/freightShipmentService';
import { useNotification } from '@/contexts/NotificationContext';
import { useCustomAlert } from '@/hooks/useCustomAlert';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';

export default function FreightShipmentsRefining() {
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotification();
  const { showConfirm } = useCustomAlert();
  const [loading, setLoading] = useState(true);
  const [shipments, setShipments] = useState<FreightShipment[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    loadShipments();
  }, []);

  useAutoRefresh({
    enabled: true,
    onRefresh: loadShipments,
  });

  const loadShipments = async () => {
    try {
      setLoading(true);
      const allShipments = await freightShipmentService.listShipments();

      const refineryShipments = allShipments.filter(
        s => s.status === 'shipped_to_refinery' || s.status === 'received_at_refinery'
      );

      setShipments(refineryShipments);
    } catch (error: any) {
      console.error('Erreur chargement:', error);
      showError('Erreur', error.message || 'Impossible de charger les expéditions');
    } finally {
      setLoading(false);
    }
  };

  const handleReceiveShipment = async (shipmentId: string, shipmentRef: string) => {
    const confirmed = await showConfirm(
      'Confirmer la réception',
      `Confirmez-vous la réception de l'expédition ${shipmentRef} à la raffinerie ?\n\n` +
      `Cette action marquera l'expédition comme reçue et validera la réception des métaux.`
    );

    if (!confirmed) return;

    try {
      setActionLoading(shipmentId);
      await freightShipmentService.updateStatus(shipmentId, 'received_at_refinery');

      showSuccess(
        'Réception confirmée',
        'L\'expédition a été marquée comme reçue à la raffinerie.'
      );

      await loadShipments();
    } catch (error: any) {
      console.error('Erreur:', error);
      showError('Erreur', error.message || 'Impossible de confirmer la réception');
    } finally {
      setActionLoading(null);
    }
  };

  const waitingCount = shipments.filter(s => s.status === 'shipped_to_refinery').length;
  const receivedCount = shipments.filter(s => s.status === 'received_at_refinery').length;
  const totalValue = shipments.reduce((sum, s) => sum + s.total_value_usd, 0);
  const totalOz = shipments.reduce((sum, s) => sum + s.total_pure_gold_oz, 0);

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Expéditions Raffinerie</h1>
          <p className="text-gray-600 mt-1">
            Gestion des expéditions en attente et reçues à la raffinerie
          </p>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">En Attente</p>
                <p className="text-2xl font-bold text-gray-900">{waitingCount}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Reçues</p>
                <p className="text-2xl font-bold text-gray-900">{receivedCount}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
                <Package className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total Or Pur</p>
                <p className="text-2xl font-bold text-gray-900">{totalOz.toFixed(2)} oz</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Valeur Totale</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${totalValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loading size="lg" />
          </div>
        ) : shipments.length === 0 ? (
          <Card className="p-12">
            <div className="text-center">
              <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Aucune expédition
              </h3>
              <p className="text-gray-600">
                Les expéditions marquées "Bon pour la Raffinerie" apparaîtront ici
              </p>
            </div>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Waiting for Approval */}
            {waitingCount > 0 && (
              <Card className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <AlertCircle className="w-5 h-5 text-yellow-600" />
                  <h2 className="text-lg font-semibold text-gray-900">
                    En Attente d'Approbation ({waitingCount})
                  </h2>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b-2 border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                          Référence
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                          Date Expédition
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                          Raffinerie
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">
                          Or Pur (oz)
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">
                          Valeur USD
                        </th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                          Productions
                        </th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {shipments
                        .filter(s => s.status === 'shipped_to_refinery')
                        .map(shipment => (
                          <tr key={shipment.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900">
                                  {shipment.reference_number}
                                </span>
                                <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full">
                                  Waiting for Approval
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {new Date(shipment.shipment_date).toLocaleDateString('fr-FR')}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700">
                              <div className="flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-gray-400" />
                                {shipment.destination_refinery?.name || 'Non spécifiée'}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="font-semibold text-amber-700">
                                {shipment.total_pure_gold_oz.toFixed(4)} oz
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-green-700">
                              ${shipment.total_value_usd.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                            </td>
                            <td className="px-4 py-3 text-center text-sm text-gray-600">
                              {shipment.production_count}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-center gap-2">
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => navigate(`/freight/shipments/${shipment.id}`)}
                                >
                                  <Eye className="w-4 h-4 mr-1" />
                                  Détails
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handleReceiveShipment(shipment.id, shipment.reference_number)}
                                  disabled={actionLoading === shipment.id}
                                  className="bg-green-600 hover:bg-green-700 text-white"
                                >
                                  {actionLoading === shipment.id ? (
                                    <>
                                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-1"></div>
                                      Traitement...
                                    </>
                                  ) : (
                                    <>
                                      <CheckCircle className="w-4 h-4 mr-1" />
                                      Approuver
                                    </>
                                  )}
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {/* Received Shipments */}
            {receivedCount > 0 && (
              <Card className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <h2 className="text-lg font-semibold text-gray-900">
                    Expéditions Reçues ({receivedCount})
                  </h2>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b-2 border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                          Référence
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                          Date Réception
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">
                          Or Pur (oz)
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">
                          Valeur USD
                        </th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {shipments
                        .filter(s => s.status === 'received_at_refinery')
                        .map(shipment => (
                          <tr key={shipment.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900">
                                  {shipment.reference_number}
                                </span>
                                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                                  Reçue
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {shipment.received_at
                                ? new Date(shipment.received_at).toLocaleString('fr-FR')
                                : '-'}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-amber-700">
                              {shipment.total_pure_gold_oz.toFixed(4)} oz
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-green-700">
                              ${shipment.total_value_usd.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => navigate(`/freight/shipments/${shipment.id}`)}
                              >
                                <Eye className="w-4 h-4 mr-1" />
                                Détails
                              </Button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
