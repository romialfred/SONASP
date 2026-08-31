import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DossierComplet } from '@/components/dossier/DossierComplet';
import { ArrowLeft, Package, Calendar, DollarSign, FileText, User, Send, Eye, Download, CheckCircle2, Plane, Loader2 } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loading } from '@/components/ui/Loading';
import { FreightStatusBadge } from '@/components/freight/FreightStatusBadge';
import { PDFViewer } from '@/components/ui/PDFViewer';
import { CustomConfirm } from '@/components/ui/CustomConfirm';
import { CustomAlert } from '@/components/ui/CustomAlert';
import { freightShipmentService, FreightShipment } from '@/services/freightShipmentService';
import {
  FREIGHT_LEGACY_DOCUMENTS_ENABLED,
  freightDocumentService,
} from '@/services/freightDocumentService';
import { BullionSummaryData, ExportInvoiceData } from '@/services/freightInvoiceGenerationService';
import { useNotification } from '@/contexts/NotificationContext';
import { useCustomAlert } from '@/hooks/useCustomAlert';
import { formatWeightGrams, formatWeightOunces, formatCurrency } from '@/utils/numberUtils';
import { formatSignatoryName } from '@/utils/nameUtils';
import { PAYS_NATIONAL } from '@/constants/site';

export default function FreightShipmentDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showError, showSuccess } = useNotification();
  const {
    showConfirm,
    alertState,
    confirmState,
    closeAlert,
    closeConfirm,
    handleConfirmAction
  } = useCustomAlert();

  const [shipment, setShipment] = useState<FreightShipment | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [generatingDocs, setGeneratingDocs] = useState(false);
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
    if (!id || !shipment) {
      showError('Erreur', 'Aucune expédition sélectionnée');
      return;
    }

    try {
      const confirmed = await showConfirm(
        'Confirmer l\'expédition à la raffinerie',
        `Êtes-vous sûr de vouloir marquer cette expédition comme "Expédiée à la Raffinerie" ?\n\n` +
        `Référence: ${shipment.reference_number}\n` +
        `Destination: ${shipment.destination_refinery?.name || 'Non spécifiée'}\n` +
        `Poids total: ${formatWeightOunces(shipment.total_pure_gold_oz)} oz\n\n` +
        `Cette action ne peut pas être annulée.`
      );

      if (!confirmed) return;

      setActionLoading(true);
      await freightShipmentService.updateStatus(id, 'shipped_to_refinery');

      showSuccess(
        'Expédition confirmée',
        'L\'expédition a été marquée comme expédiée à la raffinerie. Elle apparaîtra maintenant dans le module Refining.'
      );

      await loadShipment();
    } catch (error: any) {
      console.error('Erreur lors de l\'envoi à la raffinerie:', error);
      showError('Erreur', error.message || 'Impossible de mettre à jour le statut');
    } finally {
      setActionLoading(false);
    }
  };

  const handleGenerateDocuments = async () => {
    if (!shipment || !id) {
      showError('Erreur', 'Données d\'expédition manquantes');
      return;
    }

    try {
      setGeneratingDocs(true);

      const sourceCompanies = shipment.source_mining_companies || [];
      if (sourceCompanies.length !== 1) {
        showError(
          'Origine à confirmer',
          sourceCompanies.length === 0
            ? 'La société minière d’origine ne peut pas être déterminée. Aucun document ne sera généré avec une identité supposée.'
            : 'Cette expédition regroupe plusieurs sociétés minières. Générez des documents distincts par société d’origine.',
        );
        return;
      }
      const sourceCompany = sourceCompanies[0];
      showSuccess('Génération en cours', 'Création des documents PDF...');

      const bullionData: BullionSummaryData = {
        issuerName: sourceCompany.name,
        reportDate: new Date().toLocaleDateString('en-US', {
          month: '2-digit',
          day: '2-digit',
          year: 'numeric'
        }),
        shipmentNumber: shipment.reference_number,
        bars: (shipment.productions || []).map(prod => ({
          barNo: prod.bar_reference ?? 'N/A',
          datePoured: new Date(prod.production_date ?? shipment.shipment_date).toLocaleDateString('en-US', {
            month: '2-digit',
            day: '2-digit',
            year: 'numeric'
          }),
          dateShipped: new Date(shipment.shipment_date).toLocaleDateString('en-US', {
            month: '2-digit',
            day: '2-digit',
            year: 'numeric'
          }),
          doreWeight: prod.bullion_grams ?? 0,
          smkGoldAssay: prod.estimated_fineness_pct ?? 0,
          smkSilverAssay: prod.estimated_silver_pct || 0,
          auContent: prod.pure_gold_grams ?? 0,
          agContent: prod.silver_content_grams || 0,
          auContentTroyOz: prod.pure_gold_oz ?? 0,
          agContentTroyOz: (prod.silver_content_grams || 0) / 31.1034768,
          valueUSD: (prod.pure_gold_oz ?? 0) * shipment.gold_price_usd_per_oz
        })),
        signatures: (shipment.signatories || [])
          .sort((a, b) => a.display_order - b.display_order)
          .map(sig => ({
            position: sig.position,
            name: sig.full_name
          }))
      };

      const invoiceData: ExportInvoiceData = {
        shipmentDate: new Date(shipment.shipment_date).toLocaleDateString('en-US', {
          month: '2-digit',
          day: '2-digit',
          year: 'numeric'
        }),
        invoiceNumber: shipment.reference_number,
        senderName: sourceCompany.name,
        senderAddress: sourceCompany.address || '',
        senderCity: sourceCompany.city || sourceCompany.localite || '',
        senderCountry: sourceCompany.country || PAYS_NATIONAL,
        senderNIF: sourceCompany.tax_id || '',
        recipientName: shipment.destination_refinery?.name || 'Raffinerie',
        recipientAddress: shipment.destination_refinery?.address || '-',
        recipientCity: shipment.destination_refinery?.city || '-',
        recipientCountry: shipment.destination_refinery?.country || '-',
        recipientPhone: shipment.destination_refinery?.phone || '-',
        countryOfOrigin: sourceCompany.country || PAYS_NATIONAL,
        mineName: sourceCompany.name,
        awbNumber: '',
        lotNumber: shipment.expedition_number || shipment.reference_number,
        numberOfBoxes: shipment.number_of_boxes,
        boxType: shipment.box_type ?? '',
        description: 'Gold Doré Bars',
        metal: 'Gold (Au)',
        netWeightKg: (shipment.total_bullion_grams ?? 0) / 1000,
        weightTroyOz: shipment.total_pure_gold_oz ?? 0,
        metalPriceCFAPerKg: (shipment.gold_price_usd_per_oz * 32.1507 * shipment.exchange_rate),
        estimatedValueCFA: shipment.total_value_local ?? 0,
        boxReferences: (shipment.productions || [])
          .map(p => p.bar_reference)
          .join(', '),
        exchangeRateFCFAUSD: shipment.exchange_rate,
        totalPriceCFA: shipment.total_value_local ?? 0,
        totalPriceUSD: shipment.total_value_usd ?? 0
      };

      await freightDocumentService.generateAllDocuments(
        id,
        bullionData,
        invoiceData
      );

      await loadShipment();

      showSuccess(
        'Documents générés',
        `Bullion Summary et Invoice générés avec succès !`
      );
    } catch (error: any) {
      console.error('Erreur génération documents:', error);
      showError('Erreur de génération', error.message || 'Impossible de générer les documents');
    } finally {
      setGeneratingDocs(false);
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
      <div className="p-6">
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
                className="bg-emerald-600 hover:bg-emerald-700"
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
              <h2 className="text-lg font-semibold text-gray-900 mb-5 flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-600" />
                Informations Générales
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <label className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Date d'Expédition</label>
                  <p className="text-gray-900 font-semibold mt-1.5 text-base">
                    {new Date(shipment.shipment_date).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Nombre de Boîtes</label>
                  <p className="text-gray-900 font-semibold mt-1.5 text-base">{shipment.number_of_boxes}</p>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <label className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Type de Boîte</label>
                  <p className="text-gray-900 font-semibold mt-1.5 text-base">{shipment.box_type}</p>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                  <label className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Nombre de Productions</label>
                  <p className="text-gray-900 font-semibold mt-1.5 text-base">{shipment.production_count}</p>
                </div>
              </div>

              {shipment.destination_refinery && (
                <div className="mt-4 pt-4 border-t">
                  <label className="text-sm font-medium text-gray-600 flex items-center gap-2">
                    <Plane className="w-4 h-4" />
                    Raffinerie de Destination
                  </label>
                  <p className="text-gray-900 mt-1 font-medium">
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

            {/* Productions Table with Grand Total */}
            {shipment.productions && shipment.productions.length > 0 && (
              <Card className="p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Package className="w-5 h-5 text-blue-600" />
                  Productions Incluses
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 border border-gray-300">
                          Bar Ref.
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 border border-gray-300">
                          Date
                        </th>
                        <th className="px-3 py-3 text-right text-xs font-semibold text-gray-700 border border-gray-300">
                          Poids Brut (g)
                        </th>
                        <th className="px-3 py-3 text-right text-xs font-semibold text-gray-700 border border-gray-300">
                          Finesse (%)
                        </th>
                        <th className="px-3 py-3 text-right text-xs font-semibold text-gray-700 border border-gray-300">
                          Or Pur (g)
                        </th>
                        <th className="px-3 py-3 text-right text-xs font-semibold text-gray-700 border border-gray-300">
                          Or Pur (oz)
                        </th>
                        {(shipment.total_pure_silver_grams ?? 0) > 0 && (
                          <th className="px-3 py-3 text-right text-xs font-semibold text-gray-700 border border-gray-300">
                            Argent Pur (g)
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {shipment.productions.map((prod, index) => (
                        <tr key={prod.id} className={`hover:bg-blue-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                          <td className="px-3 py-2 text-sm font-medium text-blue-900 border border-gray-300">
                            {prod.bar_reference}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-600 border border-gray-300">
                            {prod.production_date
                              ? new Date(prod.production_date).toLocaleDateString('fr-FR')
                              : '—'}
                          </td>
                          <td className="px-3 py-2 text-sm text-right text-gray-900 border border-gray-300">
                            {formatWeightGrams(prod.bullion_grams)}
                          </td>
                          <td className="px-3 py-2 text-sm text-right text-gray-600 border border-gray-300">
                            {(prod.estimated_fineness_pct ?? 0).toFixed(2)}%
                          </td>
                          <td className="px-3 py-2 text-sm text-right text-gray-900 border border-gray-300">
                            {formatWeightGrams(prod.pure_gold_grams)}
                          </td>
                          <td className="px-3 py-2 text-sm text-right font-medium text-amber-700 border border-gray-300">
                            {formatWeightOunces(prod.pure_gold_oz)}
                          </td>
                          {(shipment.total_pure_silver_grams ?? 0) > 0 && (
                            <td className="px-3 py-2 text-sm text-right text-gray-600 border border-gray-300">
                              {formatWeightGrams(prod.silver_content_grams || 0)}
                            </td>
                          )}
                        </tr>
                      ))}
                      {/* Grand Total Row */}
                      <tr className="bg-amber-50 border-t-2 border-amber-300 font-bold">
                        <td colSpan={2} className="px-3 py-3 text-sm text-gray-900 border border-gray-400">
                          GRAND TOTAL
                        </td>
                        <td className="px-3 py-3 text-sm text-right text-amber-900 border border-gray-400">
                          {formatWeightGrams(shipment.total_bullion_grams)}
                        </td>
                        <td className="px-3 py-3 text-sm text-right text-gray-600 border border-gray-400">
                          -
                        </td>
                        <td className="px-3 py-3 text-sm text-right text-amber-900 border border-gray-400">
                          {formatWeightGrams(shipment.total_pure_gold_grams)}
                        </td>
                        <td className="px-3 py-3 text-sm text-right text-amber-900 border border-gray-400 text-base">
                          {formatWeightOunces(shipment.total_pure_gold_oz)}
                        </td>
                        {(shipment.total_pure_silver_grams ?? 0) > 0 && (
                          <td className="px-3 py-3 text-sm text-right text-gray-900 border border-gray-400">
                            {formatWeightGrams(shipment.total_pure_silver_grams ?? 0)}
                          </td>
                        )}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {/* Financial Information Table */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-600" />
                Informations Financières
              </h2>

              {/* Price & Exchange Rate Summary */}
              <div className="grid grid-cols-2 gap-4 mb-4 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                <div>
                  <label className="text-sm font-medium text-emerald-700">Prix de l'Or (USD/oz)</label>
                  <p className="text-gray-900 mt-1 font-bold text-lg">
                    ${shipment.gold_price_usd_per_oz.toFixed(2)}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-emerald-700">Taux de Change</label>
                  <p className="text-gray-900 mt-1 font-bold text-lg">
                    {shipment.exchange_rate.toFixed(2)} {shipment.local_currency}/USD
                  </p>
                </div>
              </div>

              {/* Financial Details Table */}
              {shipment.productions && shipment.productions.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 border border-gray-300">
                          Bar Ref.
                        </th>
                        <th className="px-3 py-3 text-right text-xs font-semibold text-gray-700 border border-gray-300">
                          Or Pur (oz)
                        </th>
                        <th className="px-3 py-3 text-right text-xs font-semibold text-gray-700 border border-gray-300">
                          Prix USD/oz
                        </th>
                        <th className="px-3 py-3 text-right text-xs font-semibold text-gray-700 border border-gray-300">
                          Valeur (USD)
                        </th>
                        <th className="px-3 py-3 text-right text-xs font-semibold text-gray-700 border border-gray-300">
                          Valeur ({shipment.local_currency})
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {shipment.productions.map((prod, index) => {
                        const valueUsd = (prod.pure_gold_oz ?? 0) * shipment.gold_price_usd_per_oz;
                        const valueLocal = valueUsd * shipment.exchange_rate;
                        return (
                          <tr key={prod.id} className={`hover:bg-green-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                            <td className="px-3 py-2 text-sm font-medium text-blue-900 border border-gray-300">
                              {prod.bar_reference}
                            </td>
                            <td className="px-3 py-2 text-sm text-right text-amber-700 font-medium border border-gray-300">
                              {formatWeightOunces(prod.pure_gold_oz)}
                            </td>
                            <td className="px-3 py-2 text-sm text-right text-gray-600 border border-gray-300">
                              ${formatCurrency(shipment.gold_price_usd_per_oz, false)}
                            </td>
                            <td className="px-3 py-2 text-sm text-right text-green-700 font-semibold border border-gray-300">
                              ${formatCurrency(valueUsd, false)}
                            </td>
                            <td className="px-3 py-2 text-sm text-right text-green-700 font-semibold border border-gray-300">
                              {formatCurrency(valueLocal, false)}
                            </td>
                          </tr>
                        );
                      })}
                      {/* Total Row */}
                      <tr className="bg-emerald-50 border-t-2 border-emerald-300 font-bold">
                        <td className="px-3 py-3 text-sm text-gray-900 border border-gray-400">
                          TOTAL
                        </td>
                        <td className="px-3 py-3 text-sm text-right text-amber-900 border border-gray-400 text-base">
                          {formatWeightOunces(shipment.total_pure_gold_oz)}
                        </td>
                        <td className="px-3 py-3 text-sm text-right text-gray-700 border border-gray-400">
                          ${formatCurrency(shipment.gold_price_usd_per_oz, false)}
                        </td>
                        <td className="px-3 py-3 text-sm text-right text-green-900 border border-gray-400 text-base">
                          ${formatCurrency(shipment.total_value_usd, false)}
                        </td>
                        <td className="px-3 py-3 text-sm text-right text-green-900 border border-gray-400 text-base">
                          {formatCurrency(shipment.total_value_local, false)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Timeline Card */}
            <Card className="overflow-hidden">
              <div className="bg-gradient-to-r from-blue-500/70 to-blue-400/60 px-4 py-3">
                <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Chronologie
                </h2>
              </div>
              <div className="p-4">
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Créée</p>
                      <p className="text-xs text-gray-600">
                        {shipment.created_at ? new Date(shipment.created_at).toLocaleString('fr-FR') : '—'}
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
                      <div className="w-2 h-2 bg-teal-500 rounded-full mt-2"></div>
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
              </div>
            </Card>

            {/* Signatories Card */}
            {shipment.signatories && shipment.signatories.length > 0 && (
              <Card className="overflow-hidden">
                <div className="bg-gradient-to-r from-teal-500/70 to-teal-400/60 px-4 py-3">
                  <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Signataires
                  </h2>
                </div>
                <div className="p-4">
                  <div className="space-y-3">
                    {shipment.signatories
                      .sort((a, b) => a.display_order - b.display_order)
                      .map((sig) => (
                        <div key={sig.id} className="border-l-2 border-teal-400 pl-3">
                          <p className="text-sm font-medium text-gray-900">{formatSignatoryName(sig.full_name)}</p>
                          <p className="text-xs text-gray-600">{sig.position}</p>
                        </div>
                      ))}
                  </div>
                </div>
              </Card>
            )}

            {/* Documents Card */}
            <Card className="overflow-hidden">
              <div className="bg-gradient-to-r from-amber-500/70 to-amber-400/60 px-4 py-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Documents Générés
                  </h2>

                  {(!shipment.bullion_summary_pdf_path || !shipment.customs_invoice_pdf_path) && (
                    <Button
                      onClick={handleGenerateDocuments}
                      disabled={generatingDocs || !FREIGHT_LEGACY_DOCUMENTS_ENABLED}
                      title={!FREIGHT_LEGACY_DOCUMENTS_ENABLED
                        ? 'Stockage documentaire legacy désactivé en attente du gateway privé.'
                        : undefined}
                      className="bg-white hover:bg-gray-100 text-amber-800 disabled:bg-gray-200 disabled:text-gray-500 text-xs px-2 py-1 shadow-sm"
                    >
                      {!FREIGHT_LEGACY_DOCUMENTS_ENABLED ? (
                        'Génération indisponible'
                      ) : generatingDocs ? (
                        <>
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          Génération...
                        </>
                      ) : (
                        <>
                          <FileText className="w-3 h-3 mr-1" />
                          Générer
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
              <div className="p-4">
                <div className="space-y-3">
                {/* Packing List */}
                {shipment.packing_list_pdf_path && (
                  <div className="border border-gray-200 rounded-lg p-3 hover:border-blue-300 hover:bg-blue-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <FileText className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">Packing List</p>
                          <p className="text-xs text-gray-500">PDF Document</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setViewingPdf(shipment.packing_list_pdf_path!)}
                          className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
                          title="Visualiser"
                        >
                          <Eye className="w-4 h-4 text-blue-600" />
                        </button>
                        <a
                          href={shipment.packing_list_pdf_path}
                          download
                          className="p-2 hover:bg-emerald-100 rounded-lg transition-colors"
                          title="Télécharger"
                        >
                          <Download className="w-4 h-4 text-emerald-600" />
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                {/* Consignment Note */}
                {shipment.consignment_note_pdf_path && (
                  <div className="border border-gray-200 rounded-lg p-3 hover:border-blue-300 hover:bg-blue-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                          <FileText className="w-5 h-5 text-slate-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">Consignment Note</p>
                          <p className="text-xs text-gray-500">PDF Document</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setViewingPdf(shipment.consignment_note_pdf_path!)}
                          className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
                          title="Visualiser"
                        >
                          <Eye className="w-4 h-4 text-blue-600" />
                        </button>
                        <a
                          href={shipment.consignment_note_pdf_path}
                          download
                          className="p-2 hover:bg-emerald-100 rounded-lg transition-colors"
                          title="Télécharger"
                        >
                          <Download className="w-4 h-4 text-emerald-600" />
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                {/* Bullion Summary */}
                {shipment.bullion_summary_pdf_path && (
                  <div className="border border-gray-200 rounded-lg p-3 hover:border-blue-300 hover:bg-blue-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                          <FileText className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">Bullion Summary</p>
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
                          className="p-2 hover:bg-emerald-100 rounded-lg transition-colors"
                          title="Télécharger"
                        >
                          <Download className="w-4 h-4 text-emerald-600" />
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                {/* Invoice */}
                {shipment.customs_invoice_pdf_path && (
                  <div className="border border-gray-200 rounded-lg p-3 hover:border-blue-300 hover:bg-blue-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                          <FileText className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">Invoice</p>
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
                          className="p-2 hover:bg-emerald-100 rounded-lg transition-colors"
                          title="Télécharger"
                        >
                          <Download className="w-4 h-4 text-emerald-600" />
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                {!shipment.packing_list_pdf_path && !shipment.consignment_note_pdf_path && !shipment.bullion_summary_pdf_path && !shipment.customs_invoice_pdf_path && (
                  <div className="text-center py-6">
                    <FileText className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Aucun document généré</p>
                  </div>
                )}
                </div>
              </div>
            </Card>

            {/* Status Info Card */}
            {shipment.status === 'shipped_to_refinery' && (
              <Card className="p-4 bg-emerald-50 border-emerald-200">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
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

        {/* Custom Alert */}
        <CustomAlert
          isOpen={alertState.isOpen}
          message={alertState.message}
          type={alertState.type}
          title={alertState.title}
          onClose={closeAlert}
        />

        {/* Custom Confirm */}
        <CustomConfirm
          isOpen={confirmState.isOpen}
          title={confirmState.title}
          message={confirmState.message}
          type={confirmState.type}
          confirmText={confirmState.confirmText}
          cancelText={confirmState.cancelText}
          onConfirm={handleConfirmAction}
          onCancel={closeConfirm}
        />
        {shipment?.shipping_preparation_id && (
          <DossierComplet type="expedition" id={shipment.shipping_preparation_id} />
        )}
      </div>
    </MainLayout>
  );
}
