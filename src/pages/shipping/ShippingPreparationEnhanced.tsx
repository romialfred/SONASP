import { useState, useEffect } from 'react';
import { Package, Save, Plus, Trash2, User, FileText, Loader } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { PDFViewer } from '@/components/ui/PDFViewer';
import { supabase } from '@/lib/supabase';
import { shippingPreparationService, ShippingPreparation, ShippingSignatory } from '@/services/shippingPreparationService';

interface DailyProduction {
  id: string;
  production_date: string;
  bullion_grams: number;
  estimated_fineness_pct: number;
  pure_gold_grams: number;
  estimated_oz: number;
  bar_reference: string | null;
  notes: string | null;
  mining_company_id: string | null;
  mining_company?: {
    id: string;
    name: string;
    code: string;
  };
}

export default function ShippingPreparationEnhanced() {
  const [productions, setProductions] = useState<DailyProduction[]>([]);
  const [selectedProduction, setSelectedProduction] = useState<DailyProduction | null>(null);
  const [preparation, setPreparation] = useState<ShippingPreparation | null>(null);
  const [signatories, setSignatories] = useState<ShippingSignatory[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [expeditionLotNumber, setExpeditionLotNumber] = useState('');
  const [sealNumber, setSealNumber] = useState('');
  const [editedFineness, setEditedFineness] = useState('');

  // Signatory form
  const [newSignatoryPosition, setNewSignatoryPosition] = useState('');
  const [newSignatoryName, setNewSignatoryName] = useState('');

  useEffect(() => {
    loadProductions();
  }, []);

  useEffect(() => {
    if (selectedProduction) {
      loadPreparation();
      setEditedFineness(selectedProduction.estimated_fineness_pct.toString());
      generateExpeditionLotNumber();
    }
  }, [selectedProduction]);

  const loadProductions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('daily_production')
        .select(`
          *,
          mining_company:mining_companies(id, name, code)
        `)
        .order('production_date', { ascending: false })
        .limit(30);

      if (error) throw error;
      setProductions(data || []);
    } catch (error) {
      console.error('Error loading productions:', error);
      alert('Erreur lors du chargement des productions');
    } finally {
      setLoading(false);
    }
  };

  const loadPreparation = async () => {
    if (!selectedProduction) return;

    try {
      const prep = await shippingPreparationService.getPreparationByProduction(selectedProduction.id);

      if (prep) {
        setPreparation(prep);
        setExpeditionLotNumber(prep.expedition_lot_number || '');
        setSealNumber(prep.seal_number || '');

        const sigs = await shippingPreparationService.getSignatories(prep.id);
        setSignatories(sigs);
      } else {
        setPreparation(null);
        setSignatories([]);
        setSealNumber('');
      }
    } catch (error) {
      console.error('Error loading preparation:', error);
    }
  };

  const generateExpeditionLotNumber = () => {
    if (!selectedProduction) return;

    const date = new Date(selectedProduction.production_date);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const companyCode = selectedProduction.mining_company?.code || 'XXX';

    // Format: HUM-SMK-380/2025
    const lotNumber = `HUM-${companyCode}-${month}${date.getDate()}/${year}`;
    setExpeditionLotNumber(lotNumber);
  };

  const handleProductionSelect = (productionId: string) => {
    const production = productions.find(p => p.id === productionId);
    if (production) {
      setSelectedProduction(production);
    }
  };

  const handleSavePreparation = async () => {
    if (!selectedProduction) return;

    try {
      setSaving(true);

      // Update fineness if changed
      const fineness = parseFloat(editedFineness);
      if (fineness !== selectedProduction.estimated_fineness_pct) {
        const pureGoldGrams = (selectedProduction.bullion_grams * fineness) / 100;
        const estimatedOz = pureGoldGrams / 31.1035;

        await supabase
          .from('daily_production')
          .update({
            estimated_fineness_pct: fineness,
            pure_gold_grams: pureGoldGrams,
            estimated_oz: estimatedOz,
          })
          .eq('id', selectedProduction.id);
      }

      // Create or update shipping preparation
      const prepData = {
        daily_production_id: selectedProduction.id,
        expedition_lot_number: expeditionLotNumber,
        seal_number: sealNumber,
        status: 'prepared' as const,
        prepared_at: new Date().toISOString(),
      };

      if (preparation) {
        await shippingPreparationService.updatePreparation(preparation.id, prepData);
      } else {
        const newPrep = await shippingPreparationService.createPreparation(prepData);
        setPreparation(newPrep);
      }

      alert('Préparation enregistrée avec succès');
      await loadProductions();
    } catch (error) {
      console.error('Error saving preparation:', error);
      alert('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleAddSignatory = async () => {
    if (!preparation || !newSignatoryPosition.trim() || !newSignatoryName.trim()) {
      alert('Veuillez remplir la position et le nom');
      return;
    }

    try {
      const newSignatory = await shippingPreparationService.createSignatory({
        shipping_preparation_id: preparation.id,
        position: newSignatoryPosition,
        name: newSignatoryName,
        order_index: signatories.length,
      });

      setSignatories([...signatories, newSignatory]);
      setNewSignatoryPosition('');
      setNewSignatoryName('');
    } catch (error) {
      console.error('Error adding signatory:', error);
      alert('Erreur lors de l\'ajout du signataire');
    }
  };

  const handleDeleteSignatory = async (id: string) => {
    if (!confirm('Supprimer ce signataire ?')) return;

    try {
      await shippingPreparationService.deleteSignatory(id);
      setSignatories(signatories.filter(s => s.id !== id));
    } catch (error) {
      console.error('Error deleting signatory:', error);
      alert('Erreur lors de la suppression');
    }
  };

  const calculateUpdatedValues = () => {
    if (!selectedProduction || !editedFineness) return null;

    const fineness = parseFloat(editedFineness);
    const pureGoldGrams = (selectedProduction.bullion_grams * fineness) / 100;
    const estimatedOz = pureGoldGrams / 31.1035;

    return { pure_gold_grams: pureGoldGrams, estimated_oz: estimatedOz };
  };

  const updatedValues = calculateUpdatedValues();

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Left Sidebar - Always Visible */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-emerald-500 to-teal-600">
          <div className="flex items-center gap-2 text-white">
            <Package className="w-6 h-6" />
            <h1 className="text-lg font-bold">Shipping Preparation</h1>
          </div>
        </div>

        {/* Production Selector */}
        <div className="p-4 border-b border-gray-200">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Sélectionner Production
          </label>
          <select
            value={selectedProduction?.id || ''}
            onChange={(e) => handleProductionSelect(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
            disabled={loading}
          >
            <option value="">-- Choisir --</option>
            {productions.map((production) => (
              <option key={production.id} value={production.id}>
                {new Date(production.production_date).toLocaleDateString('fr-FR')} - {production.bar_reference}
              </option>
            ))}
          </select>
        </div>

        {/* Quick Info */}
        {selectedProduction && (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="text-xs text-blue-600 mb-1">Date</div>
              <div className="text-sm font-semibold text-blue-900">
                {new Date(selectedProduction.production_date).toLocaleDateString('fr-FR')}
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="text-xs text-amber-600 mb-1">Mining Company</div>
              <div className="text-sm font-semibold text-amber-900">
                {selectedProduction.mining_company?.name || 'N/A'}
              </div>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
              <div className="text-xs text-purple-600 mb-1">Bar Reference</div>
              <div className="text-sm font-semibold text-purple-900 font-mono">
                {selectedProduction.bar_reference || 'N/A'}
              </div>
            </div>

            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <div className="text-xs text-emerald-600 mb-1">Bullion</div>
              <div className="text-sm font-semibold text-emerald-900">
                {selectedProduction.bullion_grams.toFixed(2)} g
              </div>
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <div className="text-xs text-orange-600 mb-1">Fineness</div>
              <div className="text-sm font-semibold text-orange-900">
                {selectedProduction.estimated_fineness_pct.toFixed(2)}%
              </div>
            </div>

            <div className="bg-teal-50 border border-teal-200 rounded-lg p-3">
              <div className="text-xs text-teal-600 mb-1">Pure Gold</div>
              <div className="text-sm font-semibold text-teal-900">
                {selectedProduction.pure_gold_grams.toFixed(2)} g
              </div>
            </div>

            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
              <div className="text-xs text-indigo-600 mb-1">Estimated Oz</div>
              <div className="text-sm font-semibold text-indigo-900">
                {selectedProduction.estimated_oz.toFixed(4)} oz
              </div>
            </div>
          </div>
        )}

        {!selectedProduction && !loading && (
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="text-center text-gray-500">
              <Package className="w-12 h-12 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Sélectionnez une production</p>
            </div>
          </div>
        )}

        {loading && (
          <div className="flex-1 flex items-center justify-center">
            <Loader className="w-8 h-8 animate-spin text-emerald-600" />
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        {selectedProduction ? (
          <div className="p-6 space-y-6">
            {/* Preparation Form */}
            <Card className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Détails d'Expédition</h2>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Expedition / Lot Number
                  </label>
                  <Input
                    value={expeditionLotNumber}
                    onChange={(e) => setExpeditionLotNumber(e.target.value)}
                    placeholder="HUM-SMK-380/2025"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Seal Number *
                  </label>
                  <Input
                    value={sealNumber}
                    onChange={(e) => setSealNumber(e.target.value)}
                    placeholder="0097099"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fineness (%) *
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={editedFineness}
                    onChange={(e) => setEditedFineness(e.target.value)}
                  />
                  {updatedValues && parseFloat(editedFineness) !== selectedProduction.estimated_fineness_pct && (
                    <div className="mt-2 text-xs space-y-1">
                      <div className="text-yellow-700">
                        → Pure Gold: <span className="font-semibold">{updatedValues.pure_gold_grams.toFixed(2)} g</span>
                      </div>
                      <div className="text-yellow-700">
                        → Estimated Oz: <span className="font-semibold">{updatedValues.estimated_oz.toFixed(4)} oz</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <Button
                onClick={handleSavePreparation}
                disabled={saving || !sealNumber.trim()}
                className="w-full"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Enregistrement...' : 'Enregistrer Préparation'}
              </Button>
            </Card>

            {/* Signatories Section */}
            {preparation && (
              <Card className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900">Signataires</h2>
                </div>

                {/* Add Signatory Form */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <Input
                      value={newSignatoryPosition}
                      onChange={(e) => setNewSignatoryPosition(e.target.value)}
                      placeholder="Position (ex: Gold Room Operator)"
                    />
                    <Input
                      value={newSignatoryName}
                      onChange={(e) => setNewSignatoryName(e.target.value)}
                      placeholder="Nom"
                    />
                  </div>
                  <Button
                    onClick={handleAddSignatory}
                    variant="outline"
                    size="sm"
                    disabled={!newSignatoryPosition.trim() || !newSignatoryName.trim()}
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Ajouter Signataire
                  </Button>
                </div>

                {/* Signatories List */}
                <div className="space-y-2">
                  {signatories.map((signatory) => (
                    <div
                      key={signatory.id}
                      className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-3"
                    >
                      <div className="flex items-center gap-3">
                        <User className="w-5 h-5 text-gray-400" />
                        <div>
                          <div className="font-medium text-gray-900">{signatory.position}</div>
                          <div className="text-sm text-gray-600">{signatory.name}</div>
                        </div>
                      </div>
                      <Button
                        onClick={() => handleDeleteSignatory(signatory.id)}
                        variant="outline"
                        size="sm"
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                  ))}

                  {signatories.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <User className="w-12 h-12 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">Aucun signataire ajouté</p>
                    </div>
                  )}
                </div>
              </Card>
            )}
          </div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center text-gray-500">
              <FileText className="w-16 h-16 mx-auto mb-4 opacity-30" />
              <h3 className="text-lg font-semibold mb-2">Aucune Production Sélectionnée</h3>
              <p className="text-sm">Sélectionnez une production dans le panneau de gauche</p>
            </div>
          </div>
        )}
      </div>

      {/* Right Panel - PDF Viewer */}
      {selectedProduction && preparation && (
        <div className="w-96 bg-white border-l border-gray-200 flex flex-col">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <h3 className="font-semibold text-gray-900">Packing List</h3>
            <p className="text-sm text-gray-600">Facture d'expédition</p>
          </div>
          <div className="flex-1 overflow-hidden">
            <PDFViewer pdfUrl="/sample-assay-certificate.pdf" fileName="Packing-List.pdf" />
          </div>
        </div>
      )}
    </div>
  );
}
