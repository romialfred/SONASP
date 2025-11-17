import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Package, Plus, X, AlertCircle, CheckCircle } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { TextArea } from '@/components/ui/TextArea';
import { Loading } from '@/components/ui/Loading';
import { freightShipmentService, type AvailableShippingPreparation } from '@/services/freightShipmentService';
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
  const [availableExpeditions, setAvailableExpeditions] = useState<AvailableShippingPreparation[]>([]);
  const [refineries, setRefineries] = useState<any[]>([]);

  // Form state
  const [selectedExpeditionId, setSelectedExpeditionId] = useState('');
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

  // Selected expedition details
  const selectedExpedition = availableExpeditions.find((exp) => exp.id === selectedExpeditionId);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Charger les expéditions disponibles (status = ready_for_expedition)
      const expeditions = await freightShipmentService.getAvailableShippingPreparations();
      setAvailableExpeditions(expeditions);

      // Charger les raffineries
      const { data: refineriesData, error: refineriesError } = await supabase
        .from('refineries')
        .select('id, name, location, country')
        .order('name');

      if (refineriesError) throw refineriesError;
      setRefineries(refineriesData || []);

      if (expeditions.length === 0) {
        showNotification(
          'info',
          'Aucune expédition disponible. Les expéditions doivent avoir le statut "Prêt pour Expédition".'
        );
      }
    } catch (error: any) {
      console.error('Erreur lors du chargement des données:', error);
      showNotification('error', 'Erreur lors du chargement: ' + error.message);
    } finally {
      setLoading(false);
    }
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
    if (!selectedExpeditionId) {
      showNotification('error', 'Veuillez sélectionner une expédition');
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

    // Valider les signataires
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
        shipping_preparation_id: selectedExpeditionId,
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
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="secondary" onClick={() => navigate('/freight')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Nouvelle Expédition Freight & Customs</h1>
              <p className="text-sm text-gray-600 mt-1">
                Créer une opération douanière depuis une expédition validée
              </p>
            </div>
          </div>
        </div>

        {availableExpeditions.length === 0 ? (
          <Card className="p-6">
            <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-yellow-900">Aucune expédition disponible</h3>
                <p className="text-sm text-yellow-700 mt-1">
                  Toutes les expéditions avec le statut "Prêt pour Expédition" ont déjà une opération
                  douanière associée. Créez une nouvelle expédition ou attendez qu'une expédition soit
                  marquée comme "Prêt pour Expédition".
                </p>
              </div>
            </div>
          </Card>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Sélection de l'expédition */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                <Package className="w-5 h-5 inline mr-2" />
                Sélection de l'Expédition
              </h2>

              <div className="space-y-4">
                <Select
                  label="Expédition *"
                  value={selectedExpeditionId}
                  onChange={(e) => setSelectedExpeditionId(e.target.value)}
                  required
                >
                  <option value="">Sélectionner une expédition...</option>
                  {availableExpeditions.map((exp) => (
                    <option key={exp.id} value={exp.id}>
                      {exp.reference_number} - {exp.mining_companies?.name} -{' '}
                      {exp.total_weight_oz.toFixed(3)} oz - {new Date(exp.shipment_date).toLocaleDateString('fr-FR')}
                    </option>
                  ))}
                </Select>

                {selectedExpedition && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-medium text-blue-900">Détails de l'expédition</h4>
                        <div className="mt-2 grid grid-cols-2 gap-3 text-sm text-blue-700">
                          <div>
                            <span className="font-medium">Référence:</span> {selectedExpedition.reference_number}
                          </div>
                          <div>
                            <span className="font-medium">Compagnie minière:</span>{' '}
                            {selectedExpedition.mining_companies?.name}
                          </div>
                          <div>
                            <span className="font-medium">Poids total:</span>{' '}
                            {selectedExpedition.total_weight_grams.toFixed(3)} g /{' '}
                            {selectedExpedition.total_weight_oz.toFixed(3)} oz
                          </div>
                          <div>
                            <span className="font-medium">Date:</span>{' '}
                            {new Date(selectedExpedition.shipment_date).toLocaleDateString('fr-FR')}
                          </div>
                          <div>
                            <span className="font-medium">Productions:</span> {selectedExpedition.items?.length || 0}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <p className="text-xs text-gray-500">
                  Seules les expéditions avec statut "Prêt pour Expédition" sont disponibles
                </p>
              </div>
            </Card>

            {/* Informations commerciales */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Informations Commerciales</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select
                  label="Raffinerie de destination"
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
                  label="Nombre de boîtes *"
                  type="number"
                  min="1"
                  value={numberOfBoxes}
                  onChange={(e) => setNumberOfBoxes(parseInt(e.target.value) || 1)}
                  required
                />

                <Input
                  label="Type de boîte"
                  value={boxType}
                  onChange={(e) => setBoxType(e.target.value)}
                  placeholder="Plastic Box"
                />

                <Input
                  label="Prix de l'or (USD/oz) *"
                  type="number"
                  step="0.01"
                  min="0"
                  value={goldPriceUsdPerOz}
                  onChange={(e) => setGoldPriceUsdPerOz(e.target.value)}
                  required
                />

                <Input
                  label="Taux de change *"
                  type="number"
                  step="0.0001"
                  min="0"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(e.target.value)}
                  required
                  placeholder="Ex: 656.5 pour USD/XOF"
                />

                <Select
                  label="Monnaie locale"
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
                <h2 className="text-lg font-semibold text-gray-900">Signataires des Documents</h2>
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
              <h3 className="font-semibold text-blue-900 mb-2">À propos de la création d'opération</h3>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Un numéro de référence unique sera généré automatiquement (Format: HUM-SMK-XXX/YYYY)</li>
                <li>• Le statut initial sera "En Attente Douane" (customs_pending)</li>
                <li>• Les PDFs (Bullion Summary et Facture Customs) seront générés automatiquement</li>
                <li>• Vous pourrez ajouter des documents et changer le statut après la création</li>
              </ul>
            </Card>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4">
              <Button type="button" variant="secondary" onClick={() => navigate('/freight')}>
                Annuler
              </Button>
              <Button type="submit" disabled={submitting || !selectedExpeditionId}>
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Création en cours...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Créer l'opération
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
