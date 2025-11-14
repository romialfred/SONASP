import { useState, useEffect } from 'react';
import { Package, Save, Plus, Trash2, User, Truck, Building2, Loader } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { AccordionSidebar } from '@/components/layout/AccordionSidebar';
import { DynamicPackingList } from '@/components/shipping/DynamicPackingList';
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

interface TransportCompany {
  id: string;
  name: string;
  address: string | null;
  company_type: string;
  is_active: boolean;
}

interface Refinery {
  id: string;
  name: string;
  location: string;
  country: string;
  is_active: boolean;
}

export default function ShippingPreparationComplete() {
  const [productions, setProductions] = useState<DailyProduction[]>([]);
  const [selectedProduction, setSelectedProduction] = useState<DailyProduction | null>(null);
  const [preparation, setPreparation] = useState<ShippingPreparation | null>(null);
  const [signatories, setSignatories] = useState<ShippingSignatory[]>([]);
  const [freightCompanies, setFreightCompanies] = useState<TransportCompany[]>([]);
  const [refineries, setRefineries] = useState<Refinery[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [expeditionLotNumber, setExpeditionLotNumber] = useState('');
  const [sealNumber, setSealNumber] = useState('');
  const [editedFineness, setEditedFineness] = useState('');
  const [selectedFreightCompanyId, setSelectedFreightCompanyId] = useState('');
  const [selectedRefineryId, setSelectedRefineryId] = useState('');

  // Signatory form
  const [newSignatoryPosition, setNewSignatoryPosition] = useState('');
  const [newSignatoryName, setNewSignatoryName] = useState('');

  // Common signatory positions
  const commonPositions = [
    'Gold Room Operator',
    'SMK Finance',
    'DNGM Representative',
    'Customs Representative',
    'Brinks Representative',
    'Freight Forwarder',
    'Quality Control Manager',
  ];

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedProduction) {
      loadPreparation();
      setEditedFineness(selectedProduction.estimated_fineness_pct.toString());
      generateExpeditionLotNumber();
    }
  }, [selectedProduction]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadProductions(),
        loadFreightCompanies(),
        loadRefineries(),
      ]);
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadProductions = async () => {
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
  };

  const loadFreightCompanies = async () => {
    const { data, error } = await supabase
      .from('transport_companies')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    setFreightCompanies(data || []);
  };

  const loadRefineries = async () => {
    const { data, error } = await supabase
      .from('refineries')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    setRefineries(data || []);
  };

  const loadPreparation = async () => {
    if (!selectedProduction) return;

    try {
      const prep = await shippingPreparationService.getPreparationByProduction(selectedProduction.id);

      if (prep) {
        setPreparation(prep);
        setExpeditionLotNumber(prep.expedition_lot_number || '');
        setSealNumber(prep.seal_number || '');
        setSelectedFreightCompanyId(prep.shipped_to_company || '');
        setSelectedRefineryId(prep.shipped_to_address || '');

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
    const day = String(date.getDate()).padStart(2, '0');
    const companyCode = selectedProduction.mining_company?.code || 'XXX';

    const lotNumber = `HUM-${companyCode}-${month}${day}/${year}`;
    setExpeditionLotNumber(lotNumber);
  };

  const handleProductionSelect = (productionId: string) => {
    const production = productions.find(p => p.id === productionId);
    if (production) {
      setSelectedProduction(production);
    }
  };

  const handleSavePreparation = async () => {
    if (!selectedProduction || !selectedFreightCompanyId || !selectedRefineryId) {
      alert('Veuillez sélectionner une Freight Company et une Refinery');
      return;
    }

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
        shipped_to_company: selectedFreightCompanyId,
        shipped_to_address: selectedRefineryId,
        status: 'waiting_for_customs_approval' as const,  // Statut initial correct
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
  const selectedFreightCompany = freightCompanies.find(fc => fc.id === selectedFreightCompanyId);
  const selectedRefinery = refineries.find(r => r.id === selectedRefineryId);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200 flex-shrink-0">
        <AccordionSidebar />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Form Section */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-emerald-500 rounded-lg">
                <Package className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Shipping Preparation</h1>
                <p className="text-gray-600">Préparez les barres pour l'expédition</p>
              </div>
            </div>

            {/* Production Selector */}
            <Card className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Sélectionner Production *
              </label>
              <select
                value={selectedProduction?.id || ''}
                onChange={(e) => handleProductionSelect(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                disabled={loading}
              >
                <option value="">-- Choisir une production --</option>
                {productions.map((production) => (
                  <option key={production.id} value={production.id}>
                    {new Date(production.production_date).toLocaleDateString('fr-FR')} - {production.bar_reference} - {production.bullion_grams.toFixed(2)}g
                  </option>
                ))}
              </select>
            </Card>

            {selectedProduction && (
              <>
                {/* Production Info Card */}
                <Card className="p-6 bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200">
                  <h3 className="text-lg font-bold text-blue-900 mb-4">Informations Production</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-xs text-blue-600 mb-1">Date</div>
                      <div className="font-semibold text-blue-900">
                        {new Date(selectedProduction.production_date).toLocaleDateString('fr-FR')}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-blue-600 mb-1">Bar Reference</div>
                      <div className="font-semibold text-blue-900 font-mono">{selectedProduction.bar_reference}</div>
                    </div>
                    <div>
                      <div className="text-xs text-blue-600 mb-1">Bullion</div>
                      <div className="font-semibold text-blue-900">{selectedProduction.bullion_grams.toFixed(2)} g</div>
                    </div>
                    <div>
                      <div className="text-xs text-blue-600 mb-1">Mining Company</div>
                      <div className="font-semibold text-blue-900">{selectedProduction.mining_company?.name}</div>
                    </div>
                  </div>
                </Card>

                {/* Save Button Below Production Info */}
                <Button
                  onClick={handleSavePreparation}
                  disabled={saving || !sealNumber.trim() || !selectedFreightCompanyId || !selectedRefineryId}
                  className="w-full py-4 text-lg"
                  size="lg"
                >
                  <Save className="w-5 h-5 mr-2" />
                  {saving ? 'Enregistrement...' : 'Enregistrer Préparation'}
                </Button>

                {/* Expedition Details */}
                <Card className="p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-4">Détails d'Expédition</h2>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Truck className="w-4 h-4 inline mr-1" />
                        Freight Company *
                      </label>
                      <select
                        value={selectedFreightCompanyId}
                        onChange={(e) => setSelectedFreightCompanyId(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      >
                        <option value="">-- Sélectionner --</option>
                        {freightCompanies.map((company) => (
                          <option key={company.id} value={company.id}>
                            {company.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Building2 className="w-4 h-4 inline mr-1" />
                        Refinery *
                      </label>
                      <select
                        value={selectedRefineryId}
                        onChange={(e) => setSelectedRefineryId(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                      >
                        <option value="">-- Sélectionner --</option>
                        {refineries.map((refinery) => (
                          <option key={refinery.id} value={refinery.id}>
                            {refinery.name} - {refinery.country}
                          </option>
                        ))}
                      </select>
                    </div>

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
                </Card>

                {/* Signatories Section */}
                {preparation && (
                  <Card className="p-6">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">Signataires</h2>

                    {/* Add Signatory Form */}
                    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-lg p-4 mb-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                        <div>
                          <label className="block text-xs font-medium text-emerald-700 mb-1">Position</label>
                          <select
                            value={newSignatoryPosition}
                            onChange={(e) => setNewSignatoryPosition(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                          >
                            <option value="">-- Sélectionner ou saisir --</option>
                            {commonPositions.map((pos) => (
                              <option key={pos} value={pos}>{pos}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-emerald-700 mb-1">Nom</label>
                          <Input
                            value={newSignatoryName}
                            onChange={(e) => setNewSignatoryName(e.target.value)}
                            placeholder="Nom complet"
                          />
                        </div>
                      </div>
                      <Button
                        onClick={handleAddSignatory}
                        variant="outline"
                        size="sm"
                        className="border-emerald-500 text-emerald-700 hover:bg-emerald-50"
                        disabled={!newSignatoryPosition.trim() || !newSignatoryName.trim()}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Ajouter Signataire
                      </Button>
                    </div>

                    {/* Professional Signatories Table */}
                    {signatories.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="bg-gradient-to-r from-gray-700 to-gray-800 text-white">
                              <th className="p-4 text-left font-semibold text-sm uppercase tracking-wide">#</th>
                              <th className="p-4 text-left font-semibold text-sm uppercase tracking-wide">Position</th>
                              <th className="p-4 text-left font-semibold text-sm uppercase tracking-wide">Nom</th>
                              <th className="p-4 text-center font-semibold text-sm uppercase tracking-wide w-24">Action</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {signatories.map((signatory, index) => (
                              <tr key={signatory.id} className="hover:bg-gray-50 transition-colors">
                                <td className="p-4 text-gray-600 font-medium">{index + 1}</td>
                                <td className="p-4">
                                  <div className="flex items-center gap-2">
                                    <User className="w-4 h-4 text-emerald-600" />
                                    <span className="font-medium text-gray-900">{signatory.position}</span>
                                  </div>
                                </td>
                                <td className="p-4">
                                  <span className="text-blue-900 font-semibold">{signatory.name}</span>
                                </td>
                                <td className="p-4 text-center">
                                  <Button
                                    onClick={() => handleDeleteSignatory(signatory.id)}
                                    variant="outline"
                                    size="sm"
                                    className="border-red-300 text-red-600 hover:bg-red-50"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                        <User className="w-16 h-16 mx-auto mb-3 text-gray-300" />
                        <p className="text-gray-600 font-medium">Aucun signataire ajouté</p>
                        <p className="text-sm text-gray-500 mt-1">Ajoutez des signataires ci-dessus</p>
                      </div>
                    )}
                  </Card>
                )}
              </>
            )}

            {!selectedProduction && !loading && (
              <Card className="p-12">
                <div className="text-center">
                  <Package className="w-20 h-20 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    Aucune Production Sélectionnée
                  </h3>
                  <p className="text-gray-600">
                    Sélectionnez une production ci-dessus pour commencer
                  </p>
                </div>
              </Card>
            )}
          </div>
        </div>

        {/* Dynamic PDF Preview */}
        {selectedProduction && preparation && selectedRefinery && (
          <div className="w-[600px] bg-white border-l border-gray-200 flex flex-col overflow-hidden">
            <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-blue-500 to-indigo-600">
              <h3 className="font-bold text-white text-lg">Packing List Preview</h3>
              <p className="text-sm text-blue-100">Mise à jour dynamique</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
              <div className="bg-white rounded-lg shadow-lg">
                <DynamicPackingList
                  expeditionLotNumber={expeditionLotNumber}
                  productionDate={selectedProduction.production_date}
                  miningCompany={selectedProduction.mining_company?.name || ''}
                  refineryName={selectedRefinery.name}
                  refineryAddress={selectedRefinery.location}
                  refineryCountry={selectedRefinery.country}
                  freightCompany={selectedFreightCompany?.name || ''}
                  ingots={[
                    {
                      ingotBoxNumber: selectedProduction.bar_reference || 'N/A',
                      netWeight: selectedProduction.pure_gold_grams,
                      grossWeight: selectedProduction.bullion_grams,
                      sealNumber1: sealNumber,
                      sealNumber2: sealNumber ? `${parseInt(sealNumber) + 1}` : '',
                    }
                  ]}
                  signatories={signatories.map(s => ({
                    position: s.position,
                    name: s.name,
                  }))}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
