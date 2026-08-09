import { useState } from 'react';
import { X, FileText } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { freightCustomsService, FreightCustomsOperation } from '@/services/freightCustomsService';
import {
  freightInvoiceGenerationService,
  BullionSummaryData,
  ExportInvoiceData
} from '@/services/freightInvoiceGenerationService';
import { useNotification } from '@/contexts/NotificationContext';

interface GenerateInvoiceModalProps {
  operation: FreightCustomsOperation;
  onClose: () => void;
  onSuccess: () => void;
}

export function GenerateInvoiceModal({ operation, onClose, onSuccess }: GenerateInvoiceModalProps) {
  const { showNotification } = useNotification();
  const [activeTab, setActiveTab] = useState('bullion');
  const [generating, setGenerating] = useState(false);

  const shipping = operation.shipping_preparation;
  const miningCompany = shipping?.mining_companies;

  // Form data for Bullion Summary
  const [bullionFormData, setbullionFormData] = useState({
    reportDate: new Date().toLocaleDateString('en-GB'),
    operatorName: '',
    financeName: ''
  });

  // Form data for Export Invoice
  const [invoiceFormData, setInvoiceFormData] = useState({
    // Sender (auto-filled)
    senderName: miningCompany?.name || '',
    senderAddress: miningCompany?.address || '',
    senderCity: '',
    senderCountry: 'Mali',
    senderNIF: miningCompany?.nif || '',

    // Recipient
    recipientName: 'Rand Refinery Ltd.',
    recipientAddress: 'Refinery Road, Industries West',
    recipientCity: 'Germiston, 1400 South Africa',
    recipientCountry: 'South Africa',
    recipientPhone: '+27(0) 11-418-9000',

    // Mine
    mineName: '',
    mineLocation: '',

    // Financial
    exchangeRateFCFAUSD: 561.0000,
    metalPriceCFAPerKg: 68713000,

    // Boxes
    numberOfBoxes: 2,
    boxType: 'Plastic Box'
  });

  const generateBullionSummary = async () => {
    if (!bullionFormData.operatorName || !bullionFormData.financeName) {
      showNotification('error', 'Veuillez remplir les noms pour les signatures');
      return;
    }

    if (!shipping?.items || shipping.items.length === 0) {
      showNotification('error', 'Aucune barre trouvée dans l\'expédition');
      return;
    }

    try {
      setGenerating(true);

      // Préparer les données
      const bars = shipping.items.map((item: any) => {
        const prod = item.daily_productions;
        const valueUSD = (prod.pure_gold_grams * invoiceFormData.metalPriceCFAPerKg / 1000) / invoiceFormData.exchangeRateFCFAUSD;

        return {
          barNo: prod.bar_reference || '',
          datePoured: new Date(prod.production_date).toLocaleDateString('en-GB'),
          dateShipped: new Date(shipping.shipment_date).toLocaleDateString('en-GB'),
          doreWeight: prod.bullion_grams || 0,
          smkGoldAssay: prod.estimated_fineness_pct || 0,
          smkSilverAssay: prod.estimated_silver_pct || 0,
          auContent: prod.pure_gold_grams || 0,
          agContent: prod.silver_content_grams || 0,
          auContentTroyOz: prod.estimated_oz || 0,
          agContentTroyOz: (prod.silver_content_grams || 0) / 31.1034768,
          valueUSD
        };
      });

      const summaryData: BullionSummaryData = {
        reportDate: bullionFormData.reportDate,
        shipmentNumber: shipping.reference_number,
        bars,
        signatures: [
          { position: 'Gold Room Operator', name: bullionFormData.operatorName },
          { position: 'SMK Finance', name: bullionFormData.financeName }
        ]
      };

      // Générer PDF
      const doc = freightInvoiceGenerationService.generateBullionSummary(summaryData);
      const blob = freightInvoiceGenerationService.getPDFBlob(doc);
      const file = new File([blob], `Bullion_Summary_${shipping.reference_number}.pdf`, { type: 'application/pdf' });

      // Upload
      await freightCustomsService.uploadDocument(
        operation.id,
        'bullion_summary',
        `Bullion Summary - ${shipping.reference_number}`,
        file,
        'Généré automatiquement'
      );

      showNotification('success', 'Bullion Summary généré et ajouté aux documents');
      onSuccess();
    } catch (error: any) {
      showNotification('error', 'Erreur lors de la génération: ' + error.message);
    } finally {
      setGenerating(false);
    }
  };

  const generateExportInvoice = async () => {
    if (!invoiceFormData.senderName || !invoiceFormData.recipientName) {
      showNotification('error', 'Veuillez remplir les informations expéditeur et destinataire');
      return;
    }

    if (!shipping) {
      showNotification('error', 'Données d\'expédition manquantes');
      return;
    }

    try {
      setGenerating(true);

      const netWeightKg = (shipping.total_weight_grams || 0) / 1000;
      const weightTroyOz = shipping.total_weight_oz || 0;
      const estimatedValueCFA = netWeightKg * invoiceFormData.metalPriceCFAPerKg;
      const totalValueUSD = estimatedValueCFA / invoiceFormData.exchangeRateFCFAUSD;

      // Générer les références des boîtes
      const firstBar = shipping.items?.[0]?.daily_productions?.bar_reference || '';
      const lastBar = shipping.items?.[shipping.items.length - 1]?.daily_productions?.bar_reference || '';
      const boxReferences = `${firstBar} to ${lastBar}`;

      const invoiceData: ExportInvoiceData = {
        shipmentDate: new Date(shipping.shipment_date).toLocaleDateString('en-GB').replace(/\//g, '/'),
        invoiceNumber: shipping.reference_number,

        senderName: invoiceFormData.senderName,
        senderAddress: invoiceFormData.senderAddress,
        senderCity: invoiceFormData.senderCity,
        senderCountry: invoiceFormData.senderCountry,
        senderNIF: invoiceFormData.senderNIF,

        recipientName: invoiceFormData.recipientName,
        recipientAddress: invoiceFormData.recipientAddress,
        recipientCity: invoiceFormData.recipientCity,
        recipientCountry: invoiceFormData.recipientCountry,
        recipientPhone: invoiceFormData.recipientPhone,

        countryOfOrigin: invoiceFormData.senderCountry,
        mineName: invoiceFormData.mineName || miningCompany?.name || '',

        awbNumber: operation.awb_number || shipping.reference_number.replace('SHIP', ''),
        lotNumber: shipping.reference_number.split('-')[1] || '2025',
        numberOfBoxes: invoiceFormData.numberOfBoxes,
        boxType: invoiceFormData.boxType,
        description: 'Dore: Gold, Silver, ingot packed in boxes',

        metal: 'Au',
        netWeightKg,
        weightTroyOz,
        metalPriceCFAPerKg: invoiceFormData.metalPriceCFAPerKg,
        estimatedValueCFA,

        boxReferences,

        exchangeRateFCFAUSD: invoiceFormData.exchangeRateFCFAUSD,

        totalPriceCFA: estimatedValueCFA,
        totalPriceUSD: totalValueUSD
      };

      // Sauvegarder les données de facture
      await freightCustomsService.saveInvoiceData(operation.id, {
        sender_name: invoiceFormData.senderName,
        sender_address: invoiceFormData.senderAddress,
        sender_city: invoiceFormData.senderCity,
        sender_country: invoiceFormData.senderCountry,
        sender_nif: invoiceFormData.senderNIF,

        recipient_name: invoiceFormData.recipientName,
        recipient_address: invoiceFormData.recipientAddress,
        recipient_city: invoiceFormData.recipientCity,
        recipient_country: invoiceFormData.recipientCountry,
        recipient_phone: invoiceFormData.recipientPhone,

        mine_name: invoiceFormData.mineName,
        country_of_origin: invoiceFormData.senderCountry,

        exchange_rate_fcfa_usd: invoiceFormData.exchangeRateFCFAUSD,
        number_of_boxes: invoiceFormData.numberOfBoxes,
        box_type: invoiceFormData.boxType,

        metal_price_cfa_per_kg: invoiceFormData.metalPriceCFAPerKg,
        total_value_cfa: estimatedValueCFA,
        total_value_usd: totalValueUSD
      });

      // Générer PDF
      const doc = freightInvoiceGenerationService.generateExportInvoice(invoiceData);
      const blob = freightInvoiceGenerationService.getPDFBlob(doc);
      const file = new File([blob], `Export_Invoice_${shipping.reference_number}.pdf`, { type: 'application/pdf' });

      // Upload
      await freightCustomsService.uploadDocument(
        operation.id,
        'export_invoice',
        `Invoice - ${shipping.reference_number}`,
        file,
        'Facture d\'exportation pour besoins de la douane'
      );

      showNotification('success', 'Facture d\'exportation générée et ajoutée aux documents');
      onSuccess();
    } catch (error: any) {
      showNotification('error', 'Erreur lors de la génération: ' + error.message);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Générer Facture d'Exportation</h2>
            <p className="text-sm text-gray-600 mt-1">
              Expédition: {shipping?.reference_number}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <div className="flex">
            <button
              onClick={() => setActiveTab('bullion')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'bullion'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Bullion Summary
            </button>
            <button
              onClick={() => setActiveTab('invoice')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'invoice'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Export Invoice
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'bullion' && (
            <div className="space-y-6">
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <p className="text-sm text-slate-800">
                  Ce document génère un résumé détaillé de toutes les barres incluses dans l'expédition avec les signatures requises.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date du Rapport
                  </label>
                  <Input
                    type="text"
                    value={bullionFormData.reportDate}
                    onChange={(e) => setbullionFormData({ ...bullionFormData, reportDate: e.target.value })}
                    placeholder="31-Oct-25"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre de Barres
                  </label>
                  <Input
                    type="text"
                    value={shipping?.items?.length || 0}
                    disabled
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Gold Room Operator <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    value={bullionFormData.operatorName}
                    onChange={(e) => setbullionFormData({ ...bullionFormData, operatorName: e.target.value })}
                    placeholder="SIDIKI SIDIBE"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    SMK Finance <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    value={bullionFormData.financeName}
                    onChange={(e) => setbullionFormData({ ...bullionFormData, financeName: e.target.value })}
                    placeholder="MOUHAMAD TERA"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button
                  onClick={generateBullionSummary}
                  disabled={generating}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  {generating ? 'Génération...' : 'Générer Bullion Summary'}
                </Button>
              </div>
            </div>
          )}

          {activeTab === 'invoice' && (
            <div className="space-y-6">
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <p className="text-sm text-slate-800">
                  Cette facture sera utilisée pour les besoins de la douane. Les informations de l'expédition sont pré-remplies.
                </p>
              </div>

              {/* Expéditeur */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Expéditeur (From)</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Nom</label>
                    <Input
                      type="text"
                      value={invoiceFormData.senderName}
                      onChange={(e) => setInvoiceFormData({ ...invoiceFormData, senderName: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">NIF</label>
                    <Input
                      type="text"
                      value={invoiceFormData.senderNIF}
                      onChange={(e) => setInvoiceFormData({ ...invoiceFormData, senderNIF: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Adresse</label>
                    <Input
                      type="text"
                      value={invoiceFormData.senderAddress}
                      onChange={(e) => setInvoiceFormData({ ...invoiceFormData, senderAddress: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Ville</label>
                    <Input
                      type="text"
                      value={invoiceFormData.senderCity}
                      onChange={(e) => setInvoiceFormData({ ...invoiceFormData, senderCity: e.target.value })}
                      placeholder="Bamako"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Pays</label>
                    <Input
                      type="text"
                      value={invoiceFormData.senderCountry}
                      onChange={(e) => setInvoiceFormData({ ...invoiceFormData, senderCountry: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Destinataire */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Destinataire (Shipped to)</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Nom</label>
                    <Input
                      type="text"
                      value={invoiceFormData.recipientName}
                      onChange={(e) => setInvoiceFormData({ ...invoiceFormData, recipientName: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Adresse</label>
                    <Input
                      type="text"
                      value={invoiceFormData.recipientAddress}
                      onChange={(e) => setInvoiceFormData({ ...invoiceFormData, recipientAddress: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Ville, Pays</label>
                    <Input
                      type="text"
                      value={invoiceFormData.recipientCity}
                      onChange={(e) => setInvoiceFormData({ ...invoiceFormData, recipientCity: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Téléphone</label>
                    <Input
                      type="text"
                      value={invoiceFormData.recipientPhone}
                      onChange={(e) => setInvoiceFormData({ ...invoiceFormData, recipientPhone: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Informations Mine */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Mine</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Nom de la Mine</label>
                    <Input
                      type="text"
                      value={invoiceFormData.mineName}
                      onChange={(e) => setInvoiceFormData({ ...invoiceFormData, mineName: e.target.value })}
                      placeholder="Yanfolila"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Localisation</label>
                    <Input
                      type="text"
                      value={invoiceFormData.mineLocation}
                      onChange={(e) => setInvoiceFormData({ ...invoiceFormData, mineLocation: e.target.value })}
                      placeholder="Region"
                    />
                  </div>
                </div>
              </div>

              {/* Informations Financières */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Informations Financières</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Taux Change FCFA/USD
                    </label>
                    <Input
                      type="number"
                      step="0.0001"
                      value={invoiceFormData.exchangeRateFCFAUSD}
                      onChange={(e) => setInvoiceFormData({ ...invoiceFormData, exchangeRateFCFAUSD: parseFloat(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Prix Métal CFA/kg
                    </label>
                    <Input
                      type="number"
                      step="1000"
                      value={invoiceFormData.metalPriceCFAPerKg}
                      onChange={(e) => setInvoiceFormData({ ...invoiceFormData, metalPriceCFAPerKg: parseFloat(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Nombre de Boîtes
                    </label>
                    <Input
                      type="number"
                      value={invoiceFormData.numberOfBoxes}
                      onChange={(e) => setInvoiceFormData({ ...invoiceFormData, numberOfBoxes: parseInt(e.target.value) })}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button
                  onClick={generateExportInvoice}
                  disabled={generating}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  {generating ? 'Génération...' : 'Générer Export Invoice'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
