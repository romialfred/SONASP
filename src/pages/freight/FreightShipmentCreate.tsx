import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Package, Plus, X, AlertCircle, CheckCircle, Check } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { TextArea } from '@/components/ui/TextArea';
import { Loading } from '@/components/ui/Loading';
import { freightShipmentService, type AvailableProduction } from '@/services/freightShipmentService';
import { useNotification } from '@/contexts/NotificationContext';
import { supabase } from '@/lib/supabase';

interface Signatory {
  position: string;
  full_name: string;
  display_order: number;
}

export default function FreightShipmentCreate() {
  const navigate = useNavigate();
  const { showNotification } = useNotification();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [availableProductions, setAvailableProductions] = useState<AvailableProduction[]>([]);
  const [refineries, setRefineries] = useState<any[]>([]);

  // Form state
  const [selectedProductionIds, setSelectedProductionIds] = useState<Set<string>>(new Set());
  const [shipmentDate, setShipmentDate] = useState(new Date().toISOString().split('T')[0]);
  const [destinationRefineryId, setDestinationRefineryId] = useState('');
  const [numberOfBoxes, setNumberOfBoxes] = useState(1);
  const [boxType, setBoxType] = useState('Plastic Box');
  const [goldPriceUsdPerOz, setGoldPriceUsdPerOz] = useState('');
  const [exchangeRate, setExchangeRate] = useState('');
  const [localCurrency, setLocalCurrency] = useState('XOF');
  const [notes, setNotes] = useState('');
  const [signatories, setSignatories] = useState<Signatory[]>([
    { position: 'Mine Manager', full_name: '', display_order: 0 },
    { position: 'Finance Manager', full_name: '', display_order: 1 },
  ]);

  // Selected productions summary
  const selectedProductions = availableProductions.filter(p => selectedProductionIds.has(p.id));
  const totalBullionGrams = selectedProductions.reduce((sum, p) => sum + p.bullion_grams, 0);
  const totalPureGoldGrams = selectedProductions.reduce((sum, p) => sum + p.pure_gold_grams, 0);
  const totalPureGoldOz = selectedProductions.reduce((sum, p) => sum + p.estimated_oz, 0);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Charger les productions disponibles (status = ready_for_customs)
      const productions = await freightShipmentService.getAvailableProductions();
      setAvailableProductions(productions);

      // Charger les raffineries
      const { data: refineriesData, error: refineriesError } = await supabase
        .from('refineries')
        .select('id, name, location, country')
        .order('name');

      if (refineriesError) throw refineriesError;
      setRefineries(refineriesData || []);

      if (productions.length === 0) {
        showNotification(
          'info',
          'Aucune production disponible. Les productions doivent avoir le statut "Prêt pour la Douane".'
        );
      }
    } catch (error: any) {
      console.error('Erreur lors du chargement des données:', error);
      showNotification('error', 'Erreur lors du chargement: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleProductionSelection = (productionId: string) => {
    const newSet = new Set(selectedProductionIds);
    if (newSet.has(productionId)) {
      newSet.delete(productionId);
    } else {
      newSet.add(productionId);
    }
    setSelectedProductionIds(newSet);
  };

  const selectAllProductions = () => {
    setSelectedProductionIds(new Set(availableProductions.map(p => p.id)));
  };

  const deselectAllProductions = () => {
    setSelectedProductionIds(new Set());
  };

  const handleAddSignatory = () => {
    setSignatories([
      ...signatories,
      { position: '', full_name: '', display_order: signatories.length },
    ]);
  };

  const handleRemoveSignatory = (index: number) => {
    setSignatories(signatories.filter((_, i) => i !== index));
  };

  const handleSignatoryChange = (index: number, field: keyof Signatory, value: string) => {
    const updated = [...signatories];
    updated[index] = { ...updated[index], [field]: value };
    setSignatories(updated);
  };

  const validateForm = (): boolean => {
    if (selectedProductionIds.size === 0) {
      showNotification('error', 'Veuillez sélectionner au moins une production');
      return false;
    }

    if (numberOfBoxes < 1) {
      showNotification('error', 'Le nombre de boîtes doit être au moins 1');
      return false;
    }

    if (!goldPriceUsdPerOz || parseFloat(goldPriceUsdPerOz) <= 0) {
      showNotification('error', 'Veuillez entrer un prix de l\'or valide');
      return false;
    }

    if (!exchangeRate || parseFloat(exchangeRate) <= 0) {
      showNotification('error', 'Veuillez entrer un taux de change valide');
      return false;
    }

    const validSignatories = signatories.filter((sig) => sig.position && sig.full_name);
    if (validSignatories.length === 0) {
      showNotification('error', 'Veuillez ajouter au moins un signataire avec position et nom');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      setSubmitting(true);

      const validSignatories = signatories
        .filter((sig) => sig.position && sig.full_name)
        .map((sig, index) => ({
          position: sig.position,
          full_name: sig.full_name,
          display_order: index,
        }));

      const shipment = await freightShipmentService.createShipment({
        production_ids: Array.from(selectedProductionIds),
        shipment_date: shipmentDate,
        destination_refinery_id: destinationRefineryId || undefined,
        number_of_boxes: numberOfBoxes,
        box_type: boxType,
        gold_price_usd_per_oz: parseFloat(goldPriceUsdPerOz),
        exchange_rate: parseFloat(exchangeRate),
        local_currency: localCurrency,
        notes,
        signatories: validSignatories,
      });

      showNotification('success', `Expédition Freight ${shipment.reference_number} créée avec succès`);
      navigate(`/freight/shipments/${shipment.id}`);
    } catch (error: any) {
      console.error('Erreur lors de la création:', error);
      showNotification('error', 'Erreur lors de la création: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <Loading />
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="secondary" onClick={() => navigate('/freight')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Nouvelle Expédition vers Raffinerie</h1>
              <p className="text-sm text-gray-600 mt-1">
                Sélectionnez les productions prêtes pour expédition (validées par la douane)
              </p>
            </div>
          </div>
        </div>

        {availableProductions.length === 0 ? (
          <Card className="p-6">
            <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-yellow-900">Aucune production disponible</h3>
                <p className="text-sm text-yellow-700 mt-1">
                  Toutes les productions avec le statut "Prêt pour la Douane" (ready_for_customs) ont déjà
                  été assignées à une expédition ou aucune n'est encore validée.
                </p>
              </div>
            </div>
          </Card>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Sélection des Productions */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  <Package className="w-5 h-5 inline mr-2" />
                  Sélection des Productions ({selectedProductionIds.size} / {availableProductions.length})
                </h2>
                <div className="flex gap-2">
                  <Button type="button" variant="secondary" size="sm" onClick={selectAllProductions}>
                    Tout sélectionner
                  </Button>
                  <Button type="button" variant="secondary" size="sm" onClick={deselectAllProductions}>
                    Tout désélectionner
                  </Button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 border">
                        <input
                          type="checkbox"
                          checked={selectedProductionIds.size === availableProductions.length}
                          onChange={(e) => e.target.checked ? selectAllProductions() : deselectAllProductions()}
                          className="rounded border-gray-300"
                        />
                      </th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 border">Bar Ref.</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 border">Date</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 border">Compagnie</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 border">Poids Brut (g)</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 border">Finesse (%)</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 border">Or Pur (g)</th>
                      <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 border">Or Pur (oz)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {availableProductions.map((prod) => (
                      <tr
                        key={prod.id}
                        className={`hover:bg-gray-50 cursor-pointer transition ${
                          selectedProductionIds.has(prod.id) ? 'bg-blue-50' : ''
                        }`}
                        onClick={() => toggleProductionSelection(prod.id)}
                      >
                        <td className="px-3 py-2 border">
                          <input
                            type="checkbox"
                            checked={selectedProductionIds.has(prod.id)}
                            onChange={() => toggleProductionSelection(prod.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="rounded border-gray-300"
                          />
                        </td>
                        <td className="px-3 py-2 text-sm font-medium text-gray-900 border">{prod.bar_reference}</td>
                        <td className="px-3 py-2 text-sm text-gray-600 border">
                          {new Date(prod.production_date).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="px-3 py-2 text-sm text-gray-600 border">
                          {prod.mining_companies?.name || 'N/A'}
                        </td>
                        <td className="px-3 py-2 text-sm text-right text-gray-900 border">
                          {prod.bullion_grams.toFixed(3)}
                        </td>
                        <td className="px-3 py-2 text-sm text-right text-gray-600 border">
                          {prod.estimated_fineness_pct.toFixed(2)}%
                        </td>
                        <td className="px-3 py-2 text-sm text-right font-medium text-gray-900 border">
                          {prod.pure_gold_grams.toFixed(3)}
                        </td>
                        <td className="px-3 py-2 text-sm text-right font-semibold text-amber-700 border">
                          {prod.estimated_oz.toFixed(6)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {selectedProductions.length > 0 && (
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-medium text-green-900">Résumé de la Sélection</h4>
                      <div className="mt-2 grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-green-700">Productions:</span>
                          <span className="ml-2 font-semibold text-green-900">{selectedProductions.length}</span>
                        </div>
                        <div>
                          <span className="text-green-700">Poids Brut Total:</span>
                          <span className="ml-2 font-semibold text-green-900">{totalBullionGrams.toFixed(3)} g</span>
                        </div>
                        <div>
                          <span className="text-green-700">Or Pur Total:</span>
                          <span className="ml-2 font-semibold text-green-900">
                            {totalPureGoldGrams.toFixed(3)} g / {totalPureGoldOz.toFixed(6)} oz
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </Card>

            {/* Informations d'Expédition */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Informations d'Expédition</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Date d'Expédition *"
                  type="date"
                  value={shipmentDate}
                  onChange={(e) => setShipmentDate(e.target.value)}
                  required
                />

                <Select
                  label="Raffinerie de Destination"
                  value={destinationRefineryId}
                  onChange={(e) => setDestinationRefineryId(e.target.value)}
                >
                  <option value="">-- Sélectionner une raffinerie --</option>
                  {refineries.map((refinery) => (
                    <option key={refinery.id} value={refinery.id}>
                      {refinery.name} - {refinery.location}, {refinery.country}
                    </option>
                  ))}
                </Select>

                <Input
                  label="Nombre de Boîtes *"
                  type="number"
                  min="1"
                  value={numberOfBoxes}
                  onChange={(e) => setNumberOfBoxes(parseInt(e.target.value) || 1)}
                  required
                />

                <Input
                  label="Type de Boîte"
                  value={boxType}
                  onChange={(e) => setBoxType(e.target.value)}
                  placeholder="Plastic Box"
                />
              </div>
            </Card>

            {/* Informations Douanières */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Informations Douanières</h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input
                  label="Prix de l'Or (USD/oz) *"
                  type="number"
                  step="0.01"
                  min="0"
                  value={goldPriceUsdPerOz}
                  onChange={(e) => setGoldPriceUsdPerOz(e.target.value)}
                  required
                  placeholder="Ex: 2650.00"
                />

                <Input
                  label="Taux de Change *"
                  type="number"
                  step="0.0001"
                  min="0"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(e.target.value)}
                  required
                  placeholder="Ex: 656.5 pour USD/XOF"
                />

                <Select
                  label="Monnaie Locale"
                  value={localCurrency}
                  onChange={(e) => setLocalCurrency(e.target.value)}
                >
                  <option value="XOF">XOF (Franc CFA)</option>
                  <option value="GNF">GNF (Franc Guinéen)</option>
                  <option value="USD">USD</option>
                </Select>
              </div>

              <div className="mt-4">
                <TextArea
                  label="Notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Notes ou observations pour cette expédition..."
                />
              </div>
            </Card>

            {/* Signataires */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Signataires des Documents PDF</h2>
                <Button type="button" variant="secondary" size="sm" onClick={handleAddSignatory}>
                  <Plus className="w-4 h-4 mr-2" />
                  Ajouter un signataire
                </Button>
              </div>

              <div className="space-y-3">
                {signatories.map((signatory, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1 grid grid-cols-2 gap-3">
                      <Input
                        label={`Position ${index + 1}`}
                        value={signatory.position}
                        onChange={(e) => handleSignatoryChange(index, 'position', e.target.value)}
                        placeholder="Ex: Mine Manager"
                      />
                      <Input
                        label="Nom complet"
                        value={signatory.full_name}
                        onChange={(e) => handleSignatoryChange(index, 'full_name', e.target.value)}
                        placeholder="Ex: John Doe"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => handleRemoveSignatory(index)}
                      className="mt-6"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <p className="text-xs text-gray-500 mt-3">
                Les signataires apparaîtront sur les documents PDF (Bullion Summary et Facture Customs)
              </p>
            </Card>

            {/* Informations importantes */}
            <Card className="p-6 bg-blue-50 border-blue-200">
              <h3 className="font-semibold text-blue-900 mb-2">Génération Automatique des Documents</h3>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>
                  <Check className="w-4 h-4 inline mr-1" />
                  Bullion Summary PDF: Liste détaillée de toutes les productions sélectionnées
                </li>
                <li>
                  <Check className="w-4 h-4 inline mr-1" />
                  Facture Customs (Invoice pour besoins de la douane)
                </li>
                <li>
                  <Check className="w-4 h-4 inline mr-1" />
                  Référence unique auto-générée: HUM-SMK-XXX/YYYY
                </li>
                <li>
                  <Check className="w-4 h-4 inline mr-1" />
                  Statut initial: En Attente (Pending)
                </li>
              </ul>
            </Card>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4">
              <Button type="button" variant="secondary" onClick={() => navigate('/freight')}>
                Annuler
              </Button>
              <Button type="submit" disabled={submitting || selectedProductionIds.size === 0}>
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Création en cours...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Créer l'Expédition
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </MainLayout>
  );
}
