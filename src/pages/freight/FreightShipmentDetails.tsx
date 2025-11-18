import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Package, Calendar, MapPin, DollarSign, FileText, User } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loading } from '@/components/ui/Loading';
import { FreightStatusBadge } from '@/components/freight/FreightStatusBadge';
import { freightShipmentService, FreightShipment } from '@/services/freightShipmentService';
import { useNotification } from '@/contexts/NotificationContext';

export default function FreightShipmentDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showError } = useNotification();

  const [shipment, setShipment] = useState<FreightShipment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadShipment();
    }
  }, [id]);

  const loadShipment = async () => {
    try {
      setLoading(true);
      if (!id) return;

      const data = await freightShipmentService.getShipmentById(id);
      setShipment(data);
    } catch (error: any) {
      console.error('Erreur chargement:', error);
      showError('Erreur de chargement', error.message || 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loading />
        </div>
      </MainLayout>
    );
  }

  if (!shipment) {
    return (
      <MainLayout>
        <div className="max-w-7xl mx-auto p-6">
          <Card className="p-6">
            <p className="text-gray-600">Expédition non trouvée</p>
            <Button onClick={() => navigate('/freight')} className="mt-4">
              Retour au Dashboard
            </Button>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="secondary" onClick={() => navigate('/freight')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Expédition {shipment.reference_number}
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Détails de l'expédition vers la raffinerie
              </p>
            </div>
          </div>
          <FreightStatusBadge status={shipment.status} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Information */}
          <div className="lg:col-span-2 space-y-6">
            {/* General Info Card */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Package className="w-5 h-5" />
                Informations Générales
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Date d'Expédition</label>
                  <p className="text-gray-900 mt-1">
                    {new Date(shipment.shipment_date).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Nombre de Boîtes</label>
                  <p className="text-gray-900 mt-1">{shipment.number_of_boxes}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Type de Boîte</label>
                  <p className="text-gray-900 mt-1">{shipment.box_type}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Nombre de Productions</label>
                  <p className="text-gray-900 mt-1">{shipment.production_count}</p>
                </div>
              </div>

              {shipment.destination_refinery && (
                <div className="mt-4 pt-4 border-t">
                  <label className="text-sm font-medium text-gray-600 flex items-center gap-2">
                    <MapPin className="w-4 h-4" />
                    Raffinerie de Destination
                  </label>
                  <p className="text-gray-900 mt-1">
                    {shipment.destination_refinery.name} - {shipment.destination_refinery.location}, {shipment.destination_refinery.country}
                  </p>
                </div>
              )}

              {shipment.notes && (
                <div className="mt-4 pt-4 border-t">
                  <label className="text-sm font-medium text-gray-600">Notes</label>
                  <p className="text-gray-700 mt-1">{shipment.notes}</p>
                </div>
              )}
            </Card>

            {/* Weight Summary Card */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Résumé des Poids</h2>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-amber-50 p-4 rounded-lg">
                  <p className="text-sm text-amber-700 font-medium">Poids Brut</p>
                  <p className="text-2xl font-bold text-amber-900 mt-1">
                    {shipment.total_bullion_grams.toFixed(3)} g
                  </p>
                </div>
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <p className="text-sm text-yellow-700 font-medium">Or Pur (g)</p>
                  <p className="text-2xl font-bold text-yellow-900 mt-1">
                    {shipment.total_pure_gold_grams.toFixed(3)} g
                  </p>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg">
                  <p className="text-sm text-orange-700 font-medium">Or Pur (oz)</p>
                  <p className="text-2xl font-bold text-orange-900 mt-1">
                    {shipment.total_pure_gold_oz.toFixed(4)} oz
                  </p>
                </div>
                {shipment.total_pure_silver_grams > 0 && (
                  <div className="bg-gray-50 p-4 rounded-lg col-span-3">
                    <p className="text-sm text-gray-700 font-medium">Argent Pur</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">
                      {shipment.total_pure_silver_grams.toFixed(3)} g
                    </p>
                  </div>
                )}
              </div>
            </Card>

            {/* Financial Info Card */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Informations Financières
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Prix de l'Or (USD/oz)</label>
                  <p className="text-gray-900 mt-1 font-semibold">
                    ${shipment.gold_price_usd_per_oz.toFixed(2)}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Taux de Change</label>
                  <p className="text-gray-900 mt-1 font-semibold">
                    {shipment.exchange_rate.toFixed(2)} {shipment.local_currency}/USD
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Valeur Totale (USD)</label>
                  <p className="text-green-700 mt-1 font-bold text-lg">
                    ${shipment.total_value_usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">
                    Valeur Totale ({shipment.local_currency})
                  </label>
                  <p className="text-green-700 mt-1 font-bold text-lg">
                    {shipment.total_value_local.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {shipment.local_currency}
                  </p>
                </div>
              </div>
            </Card>

            {/* Productions List */}
            {shipment.productions && shipment.productions.length > 0 && (
              <Card className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Productions Incluses</h2>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 border">Bar Ref.</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 border">Date</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 border">Poids Brut (g)</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 border">Finesse (%)</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 border">Or Pur (g)</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 border">Or Pur (oz)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shipment.productions.map((prod) => (
                        <tr key={prod.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-sm font-medium text-gray-900 border">
                            {prod.bar_reference}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-600 border">
                            {new Date(prod.production_date).toLocaleDateString('fr-FR')}
                          </td>
                          <td className="px-3 py-2 text-sm text-right text-gray-900 border">
                            {prod.bullion_grams.toFixed(3)}
                          </td>
                          <td className="px-3 py-2 text-sm text-right text-gray-600 border">
                            {prod.estimated_fineness_pct.toFixed(2)}%
                          </td>
                          <td className="px-3 py-2 text-sm text-right text-gray-900 border">
                            {prod.pure_gold_grams.toFixed(3)}
                          </td>
                          <td className="px-3 py-2 text-sm text-right font-semibold text-amber-700 border">
                            {prod.pure_gold_oz.toFixed(6)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Timeline Card */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Chronologie
              </h2>
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Créée</p>
                    <p className="text-xs text-gray-600">
                      {new Date(shipment.created_at).toLocaleString('fr-FR')}
                    </p>
                  </div>
                </div>

                {shipment.approved_at && (
                  <div className="flex gap-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Approuvée</p>
                      <p className="text-xs text-gray-600">
                        {new Date(shipment.approved_at).toLocaleString('fr-FR')}
                      </p>
                    </div>
                  </div>
                )}

                {shipment.shipped_at && (
                  <div className="flex gap-3">
                    <div className="w-2 h-2 bg-purple-500 rounded-full mt-2"></div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Expédiée</p>
                      <p className="text-xs text-gray-600">
                        {new Date(shipment.shipped_at).toLocaleString('fr-FR')}
                      </p>
                    </div>
                  </div>
                )}

                {shipment.received_at && (
                  <div className="flex gap-3">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full mt-2"></div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Reçue</p>
                      <p className="text-xs text-gray-600">
                        {new Date(shipment.received_at).toLocaleString('fr-FR')}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Signatories Card */}
            {shipment.signatories && shipment.signatories.length > 0 && (
              <Card className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Signataires
                </h2>
                <div className="space-y-3">
                  {shipment.signatories
                    .sort((a, b) => a.display_order - b.display_order)
                    .map((sig) => (
                      <div key={sig.id} className="border-l-2 border-blue-500 pl-3">
                        <p className="text-sm font-medium text-gray-900">{sig.full_name}</p>
                        <p className="text-xs text-gray-600">{sig.position}</p>
                      </div>
                    ))}
                </div>
              </Card>
            )}

            {/* Documents Card */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Documents
              </h2>
              <div className="space-y-2">
                {shipment.bullion_summary_pdf_path && (
                  <a
                    href={shipment.bullion_summary_pdf_path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-sm text-blue-600 hover:text-blue-800"
                  >
                    📄 Résumé Bullion (PDF)
                  </a>
                )}
                {shipment.customs_invoice_pdf_path && (
                  <a
                    href={shipment.customs_invoice_pdf_path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-sm text-blue-600 hover:text-blue-800"
                  >
                    📄 Facture Douane (PDF)
                  </a>
                )}
                {!shipment.bullion_summary_pdf_path && !shipment.customs_invoice_pdf_path && (
                  <p className="text-sm text-gray-500">Aucun document disponible</p>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
