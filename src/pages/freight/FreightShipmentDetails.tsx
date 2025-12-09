import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Package, Calendar, MapPin, DollarSign, FileText, User, Send, Eye, Download, CheckCircle2 } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loading } from '@/components/ui/Loading';
import { FreightStatusBadge } from '@/components/freight/FreightStatusBadge';
import { PDFViewer } from '@/components/ui/PDFViewer';
import { freightShipmentService, FreightShipment } from '@/services/freightShipmentService';
import { useNotification } from '@/contexts/NotificationContext';
import { useCustomAlert } from '@/hooks/useCustomAlert';

export default function FreightShipmentDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotification();
  const { showAlert, showConfirm } = useCustomAlert();

  const [shipment, setShipment] = useState<FreightShipment | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [viewingPdf, setViewingPdf] = useState<string | null>(null);

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

  const handleSendToRefinery = async () => {
    if (!id || !shipment) return;

    const confirmed = await showConfirm(
      'Confirmer l\'expédition à la raffinerie',
      `Êtes-vous sûr de vouloir marquer cette expédition comme "Expédiée à la Raffinerie" ?\n\n` +
      `Référence: ${shipment.reference_number}\n` +
      `Destination: ${shipment.destination_refinery?.name || 'Non spécifiée'}\n` +
      `Poids total: ${shipment.total_pure_gold_oz.toFixed(4)} oz\n\n` +
      `Cette action ne peut pas être annulée.`
    );

    if (!confirmed) return;

    try {
      setActionLoading(true);
      await freightShipmentService.updateStatus(id, 'shipped_to_refinery');

      showSuccess(
        'Expédition confirmée',
        'L\'expédition a été marquée comme expédiée à la raffinerie. Elle apparaîtra maintenant dans le module Refining.'
      );

      await loadShipment();
    } catch (error: any) {
      console.error('Erreur:', error);
      showError('Erreur', error.message || 'Impossible de mettre à jour le statut');
    } finally {
      setActionLoading(false);
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
                Détails complets de l'expédition vers la raffinerie
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <FreightStatusBadge status={shipment.status} />
            {shipment.status === 'pending' && (
              <Button
                onClick={handleSendToRefinery}
                disabled={actionLoading}
                className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg"
              >
                {actionLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Traitement...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Bon pour la Raffinerie
                  </>
                )}
              </Button>
            )}
          </div>
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
                Documents Générés
              </h2>
              <div className="space-y-3">
                {shipment.bullion_summary_pdf_path && (
                  <div className="border border-gray-200 rounded-lg p-3 hover:border-blue-300 hover:bg-blue-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                          <FileText className="w-5 h-5 text-red-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">Résumé Bullion</p>
                          <p className="text-xs text-gray-500">PDF Document</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setViewingPdf(shipment.bullion_summary_pdf_path!)}
                          className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
                          title="Visualiser"
                        >
                          <Eye className="w-4 h-4 text-blue-600" />
                        </button>
                        <a
                          href={shipment.bullion_summary_pdf_path}
                          download
                          className="p-2 hover:bg-green-100 rounded-lg transition-colors"
                          title="Télécharger"
                        >
                          <Download className="w-4 h-4 text-green-600" />
                        </a>
                      </div>
                    </div>
                  </div>
                )}
                {shipment.customs_invoice_pdf_path && (
                  <div className="border border-gray-200 rounded-lg p-3 hover:border-blue-300 hover:bg-blue-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                          <FileText className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">Facture Douane</p>
                          <p className="text-xs text-gray-500">PDF Document</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setViewingPdf(shipment.customs_invoice_pdf_path!)}
                          className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
                          title="Visualiser"
                        >
                          <Eye className="w-4 h-4 text-blue-600" />
                        </button>
                        <a
                          href={shipment.customs_invoice_pdf_path}
                          download
                          className="p-2 hover:bg-green-100 rounded-lg transition-colors"
                          title="Télécharger"
                        >
                          <Download className="w-4 h-4 text-green-600" />
                        </a>
                      </div>
                    </div>
                  </div>
                )}
                {!shipment.bullion_summary_pdf_path && !shipment.customs_invoice_pdf_path && (
                  <div className="text-center py-4">
                    <FileText className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Aucun document généré</p>
                  </div>
                )}
              </div>
            </Card>

            {/* Status Info Card */}
            {shipment.status === 'shipped_to_refinery' && (
              <Card className="p-6 bg-emerald-50 border-emerald-200">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-semibold text-emerald-900">Expédié à la Raffinerie</h3>
                    <p className="text-xs text-emerald-700 mt-1">
                      Cette expédition a été envoyée à la raffinerie et est en attente d'approbation dans le module Refining.
                    </p>
                    {shipment.shipped_at && (
                      <p className="text-xs text-emerald-600 mt-2">
                        Expédié le {new Date(shipment.shipped_at).toLocaleString('fr-FR')}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>

        {/* PDF Viewer Modal */}
        {viewingPdf && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col">
              <div className="flex items-center justify-between p-4 border-b">
                <h3 className="text-lg font-semibold text-gray-900">Visualisation du Document</h3>
                <Button variant="secondary" onClick={() => setViewingPdf(null)}>
                  Fermer
                </Button>
              </div>
              <div className="flex-1 overflow-hidden">
                <PDFViewer url={viewingPdf} />
              </div>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
