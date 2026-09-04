import { useRef, useState } from 'react';
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
import { PAYS_NATIONAL } from '@/constants/site';
import { useAuth } from '@/contexts/AuthContext';
import {
  FREIGHT_CAPABILITIES,
  hasFreightCapability,
} from '@/lib/freightCustomsAccess';

interface GenerateInvoiceModalProps {
  operation: FreightCustomsOperation;
  onClose: () => void;
  onSuccess: () => void;
}

export function GenerateInvoiceModal({ operation, onClose, onSuccess }: GenerateInvoiceModalProps) {
  const { showError, showSuccess } = useNotification();
  const { user } = useAuth();
  const canPrepare = hasFreightCapability(user, FREIGHT_CAPABILITIES.PREPARE);
  const canManageInvoice = hasFreightCapability(user, FREIGHT_CAPABILITIES.INVOICE_MANAGE);
  const [activeTab, setActiveTab] = useState('bullion');
  const [generating, setGenerating] = useState(false);
  const generationLock = useRef(false);

  const shipping = operation.shipping_preparation;
  /**
   * Référence de l'expédition. La table porte `expedition_lot_number` ; le champ
   * `reference_number` employé jusqu'ici n'existe pas et valait `undefined`, ce
   * qui faisait échouer la génération de la facture d'exportation sur un
   * `.replace()`. À défaut de numéro de lot, on retombe sur la référence de
   * l'opération de fret, qui existe toujours.
   */
  const referenceExpedition: string = shipping?.expedition_lot_number || operation.reference_number;
  /**
   * Date d'expédition. `shipment_date` n'existe pas non plus : la table porte
   * `shipped_at`, et `prepared_at` tant que le colis n'est pas parti. Sans
   * garde, `new Date(undefined)` produisait « Invalid Date » sur la facture.
   */
  const dateExpedition: Date | null = (() => {
    const brut = shipping?.shipped_at || shipping?.prepared_at;
    if (!brut) return null;
    const d = new Date(brut);
    return Number.isNaN(d.getTime()) ? null : d;
  })();
  const miningCompany = shipping?.mining_companies;
  const savedInvoice = operation.invoice_data;

  // Form data for Bullion Summary
  const [bullionFormData, setbullionFormData] = useState({
    reportDate: new Date().toLocaleDateString('en-GB'),
    operatorName: '',
    financeName: ''
  });

  // Form data for Export Invoice
  const [invoiceFormData, setInvoiceFormData] = useState({
    // Sender (auto-filled)
    senderName: savedInvoice?.sender_name || miningCompany?.name || '',
    senderAddress: savedInvoice?.sender_address || miningCompany?.address || '',
    senderCity: savedInvoice?.sender_city || miningCompany?.city || miningCompany?.localite || '',
    senderCountry: savedInvoice?.sender_country || miningCompany?.country || PAYS_NATIONAL,
    senderNIF: savedInvoice?.sender_nif || miningCompany?.tax_id || '',

    // Recipient
    recipientName: savedInvoice?.recipient_name || shipping?.shipped_to_company || '',
    recipientAddress: savedInvoice?.recipient_address || '',
    recipientCity: savedInvoice?.recipient_city || '',
    recipientCountry: savedInvoice?.recipient_country || '',
    recipientPhone: savedInvoice?.recipient_phone || '',

    // Mine
    mineName: savedInvoice?.mine_name || miningCompany?.name || '',
    mineLocation: miningCompany?.localite || miningCompany?.city || '',

    // Financial
    exchangeRateFCFAUSD: savedInvoice?.exchange_rate_fcfa_usd || 0,
    metalPriceCFAPerKg: savedInvoice?.metal_price_cfa_per_kg || 0,

    // Boxes
    numberOfBoxes: savedInvoice?.number_of_boxes || 0,
    boxType: savedInvoice?.box_type || 'Caisse sécurisée'
  });

  const generateBullionSummary = async () => {
    if (generationLock.current) return;
    if (!canPrepare) {
      showError('Accès refusé', 'Une session AAL2 vérifiée et l’accès à la préparation des expéditions sont requis.');
      return;
    }
    if (!bullionFormData.operatorName || !bullionFormData.financeName) {
      showError('Données requises', 'Renseignez les noms des signataires.');
      return;
    }

    if (!shipping?.items || shipping.items.length === 0) {
      showError('Données indisponibles', 'Aucun lingot n’est rattaché à cette expédition.');
      return;
    }

    if (!Number.isFinite(invoiceFormData.metalPriceCFAPerKg) || invoiceFormData.metalPriceCFAPerKg <= 0
      || !Number.isFinite(invoiceFormData.exchangeRateFCFAUSD) || invoiceFormData.exchangeRateFCFAUSD <= 0) {
      showError('Données tarifaires requises', 'Renseignez un prix du métal et un taux de change positifs dans l’onglet de facturation avant de générer les documents valorisés.');
      return;
    }
    if (shipping.items.some((item: any) => !item.daily_productions
      || !Number.isFinite(item.daily_productions.pure_gold_grams) || item.daily_productions.pure_gold_grams <= 0)) {
      showError('Données d’analyse incomplètes', 'Chaque lot doit disposer d’un poids d’or fin valide avant la génération du document.');
      return;
    }

    if (!miningCompany?.name) {
      showError(
        'Données requises',
        'La société minière d’origine doit être renseignée avant de générer ce document.',
      );
      return;
    }

    try {
      generationLock.current = true;
      setGenerating(true);

      // Préparer les données
      const bars = shipping.items.map((item: any) => {
        const prod = item.daily_productions;
        const valueUSD = (prod.pure_gold_grams * invoiceFormData.metalPriceCFAPerKg / 1000) / invoiceFormData.exchangeRateFCFAUSD;

        return {
          barNo: prod.bar_reference || '',
          datePoured: new Date(prod.production_date).toLocaleDateString('en-GB'),
          dateShipped: dateExpedition ? dateExpedition.toLocaleDateString('en-GB') : '',
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
        issuerName: miningCompany.name,
        reportDate: bullionFormData.reportDate,
        shipmentNumber: referenceExpedition,
        bars,
        signatures: [
          { position: 'Responsable de la salle d’or', name: bullionFormData.operatorName },
          { position: 'SMK Finance', name: bullionFormData.financeName }
        ]
      };

      // Générer PDF
      const doc = freightInvoiceGenerationService.generateBullionSummary(summaryData);
      const blob = freightInvoiceGenerationService.getPDFBlob(doc);
      const file = new File([blob], `Bullion_Summary_${referenceExpedition}.pdf`, { type: 'application/pdf' });

      // Upload
      await freightCustomsService.uploadDocument(
        operation.id,
        'bullion_summary',
        `Récapitulatif des lingots — ${referenceExpedition}`,
        file,
        'Généré automatiquement'
      );

      showSuccess('Document généré', 'Le récapitulatif des lingots a été généré et joint au dossier.');
      onSuccess();
    } catch (error) {
      console.error('Échec de la génération du récapitulatif des lingots :', error);
      showError('Échec de la génération', 'Le récapitulatif des lingots n’a pas pu être généré ou enregistré. Vérifiez les données, puis réessayez.');
    } finally {
      setGenerating(false);
      generationLock.current = false;
    }
  };

  const generateExportInvoice = async () => {
    if (generationLock.current) return;
    if (!canManageInvoice || !canPrepare) {
      showError('Accès refusé', 'Une session AAL2 vérifiée ainsi que les droits de gestion des factures et de préparation des expéditions sont requis.');
      return;
    }
    if (!invoiceFormData.senderName || !invoiceFormData.recipientName) {
      showError('Données requises', 'Renseignez les informations de l’expéditeur et du destinataire.');
      return;
    }

    if (
      invoiceFormData.exchangeRateFCFAUSD <= 0 ||
      invoiceFormData.metalPriceCFAPerKg <= 0 ||
      invoiceFormData.numberOfBoxes <= 0
    ) {
      showError(
        'Valeurs incorrectes',
        'Renseignez un taux de change, un prix du métal et un nombre de colis strictement positifs.',
      );
      return;
    }

    if (!shipping) {
      showError('Données indisponibles', 'Les données de l’expédition sont manquantes.');
      return;
    }

    try {
      generationLock.current = true;
      setGenerating(true);

      const netWeightKg = (shipping.total_weight_grams || 0) / 1000;
      const weightTroyOz = shipping.total_weight_oz || 0;
      const estimatedValueCFA = netWeightKg * invoiceFormData.metalPriceCFAPerKg;
      const totalValueUSD = estimatedValueCFA / invoiceFormData.exchangeRateFCFAUSD;

      // Générer les références des boîtes
      const firstBar = shipping.items?.[0]?.daily_productions?.bar_reference || '';
      const lastBar = shipping.items?.[shipping.items.length - 1]?.daily_productions?.bar_reference || '';
      const boxReferences = `${firstBar} à ${lastBar}`;

      const invoiceData: ExportInvoiceData = {
        shipmentDate: dateExpedition ? dateExpedition.toLocaleDateString('en-GB') : '',
        invoiceNumber: referenceExpedition,

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

        awbNumber: operation.awb_number || '',
        lotNumber: referenceExpedition,
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
        recipient_name: invoiceFormData.recipientName,
        recipient_address: invoiceFormData.recipientAddress,
        recipient_city: invoiceFormData.recipientCity,
        recipient_country: invoiceFormData.recipientCountry,
        recipient_phone: invoiceFormData.recipientPhone,
        exchange_rate_fcfa_usd: invoiceFormData.exchangeRateFCFAUSD,
        number_of_boxes: invoiceFormData.numberOfBoxes,
        box_type: invoiceFormData.boxType,
        description: 'Dore: Gold, Silver, ingot packed in boxes',
        metal_price_cfa_per_kg: invoiceFormData.metalPriceCFAPerKg,
        total_value_cfa: estimatedValueCFA,
        total_value_usd: totalValueUSD
      });

      // Générer PDF
      const doc = freightInvoiceGenerationService.generateExportInvoice(invoiceData);
      const blob = freightInvoiceGenerationService.getPDFBlob(doc);
      const file = new File([blob], `Export_Invoice_${referenceExpedition}.pdf`, { type: 'application/pdf' });

      // Upload
      await freightCustomsService.uploadDocument(
        operation.id,
        'export_invoice',
        `Facture — ${referenceExpedition}`,
        file,
        'Facture d’exportation destinée au dédouanement'
      );

      showSuccess('Document généré', 'La facture d’exportation a été générée et jointe au dossier.');
      onSuccess();
    } catch (error) {
      console.error('Échec de la génération de la facture d’exportation :', error);
      showError('Échec de la génération', 'La facture d’exportation n’a pas pu être générée ou enregistrée. Vérifiez les données, puis réessayez.');
    } finally {
      setGenerating(false);
      generationLock.current = false;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Générer les documents d’exportation</h2>
            <p className="text-sm text-gray-600 mt-1">
              Expédition : {referenceExpedition}
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
              Récapitulatif des lingots
            </button>
            <button
              onClick={() => setActiveTab('invoice')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'invoice'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Facture d’exportation
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'bullion' && (
            <div className="space-y-6">
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <p className="text-sm text-slate-800">
                  Ce document répertorie tous les lingots inclus dans l’expédition ainsi que les signataires requis.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date du rapport
                  </label>
                  <Input
                    type="text"
                    value={bullionFormData.reportDate}
                    onChange={(e) => setbullionFormData({ ...bullionFormData, reportDate: e.target.value })}
                    placeholder="31-Aug-26"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nombre de lingots
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
                    Responsable de la salle d’or <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    value={bullionFormData.operatorName}
                    onChange={(e) => setbullionFormData({ ...bullionFormData, operatorName: e.target.value })}
                    placeholder="Nom du responsable habilité"
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
                    placeholder="Nom du signataire financier"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <Button
                  onClick={generateBullionSummary}
                  disabled={generating || !canPrepare}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  {generating ? 'Génération…' : 'Générer le récapitulatif'}
                </Button>
              </div>
            </div>
          )}

          {activeTab === 'invoice' && (
            <div className="space-y-6">
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <p className="text-sm text-slate-800">
                  Cette facture est destinée aux services douaniers. Les données d’expédition enregistrées sont préremplies.
                </p>
              </div>

              {/* Expéditeur */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Expéditeur</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Dénomination</label>
                    <Input
                      type="text"
                      value={invoiceFormData.senderName}
                      disabled
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">NIF</label>
                    <Input
                      type="text"
                      value={invoiceFormData.senderNIF}
                      disabled
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Adresse</label>
                    <Input
                      type="text"
                      value={invoiceFormData.senderAddress}
                      disabled
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Ville</label>
                    <Input
                      type="text"
                      value={invoiceFormData.senderCity}
                      disabled
                      placeholder="Ouagadougou"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Pays</label>
                    <Input
                      type="text"
                      value={invoiceFormData.senderCountry}
                      disabled
                    />
                  </div>
                </div>
              </div>

              {/* Destinataire */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Destinataire de l’expédition</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">Dénomination</label>
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
                    <label className="block text-xs font-medium text-gray-700 mb-1">Ville</label>
                    <Input
                      type="text"
                      value={invoiceFormData.recipientCity}
                      onChange={(e) => setInvoiceFormData({ ...invoiceFormData, recipientCity: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Pays</label>
                    <Input
                      type="text"
                      value={invoiceFormData.recipientCountry}
                      onChange={(e) => setInvoiceFormData({ ...invoiceFormData, recipientCountry: e.target.value })}
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
                    <label className="block text-xs font-medium text-gray-700 mb-1">Nom de la mine</label>
                    <Input
                      type="text"
                      value={invoiceFormData.mineName}
                      disabled
                      placeholder="Dénomination officielle de la mine"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Localisation</label>
                    <Input
                      type="text"
                      value={invoiceFormData.mineLocation}
                      disabled
                      placeholder="Région"
                    />
                  </div>
                </div>
              </div>

              {/* Informations Financières */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Informations financières</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Taux de change (XOF/USD)
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
                      Prix du métal (XOF/kg)
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
                      Nombre de colis
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
                  disabled={generating || !canManageInvoice || !canPrepare}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  {generating ? 'Génération…' : 'Générer la facture d’exportation'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
