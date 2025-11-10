import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  Save,
  ArrowLeft,
  Building2,
  FileText,
  TrendingUp,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { MainLayout } from '@/components/layout/MainLayout';
import { LicenseSelectorCard } from '@/components/licenses/LicenseSelectorCard';
import { supabase } from '@/lib/supabase';

interface MiningCompany {
  id: string;
  name: string;
  code: string;
  country: string;
  is_active: boolean;
}

interface License {
  id: string;
  license_number: string;
  license_type: string;
  applicant_mine_id: string;
  applicant_company_name: string;
  mining_company_name: string;
  mining_company_code: string;
  issue_date: string;
  start_date: string | null;
  expiry_date: string;
  authorized_qty_oz: number;
  reserved_qty_oz: number;
  consumed_qty_oz: number;
  remaining_qty_oz: number;
  remaining_percentage: number;
  status: string;
  issuer_country: string;
  theoretical_price_usd_per_oz: number | null;
  days_until_expiry: number;
  is_expiring_soon: boolean;
  is_low_quantity: boolean;
}

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
  is_shipped: boolean;
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

interface SelectedProductionData {
  production: DailyProduction;
  sealNumber1: string;
  sealNumber2: string;
}

export default function ShippingPreparationEnhanced() {
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [miningCompanies, setMiningCompanies] = useState<MiningCompany[]>([]);
  const [selectedMiningCompanyId, setSelectedMiningCompanyId] = useState('');
  const [selectedLicenseId, setSelectedLicenseId] = useState('');
  const [selectedLicense, setSelectedLicense] = useState<License | null>(null);
  const [productions, setProductions] = useState<DailyProduction[]>([]);
  const [selectedProductions, setSelectedProductions] = useState<SelectedProductionData[]>([]);
  const [freightCompanies, setFreightCompanies] = useState<TransportCompany[]>([]);
  const [refineries, setRefineries] = useState<Refinery[]>([]);
  const [selectedFreightCompanyId, setSelectedFreightCompanyId] = useState('');
  const [selectedRefineryId, setSelectedRefineryId] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedMiningCompanyId) {
      loadProductionsByMiningCompany();
    } else {
      setProductions([]);
      setSelectedProductions([]);
    }
  }, [selectedMiningCompanyId]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadMiningCompanies(),
        loadFreightCompanies(),
        loadRefineries(),
      ]);
    } catch (error) {
      console.error('Error loading initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMiningCompanies = async () => {
    const { data, error } = await supabase
      .from('mining_companies')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    setMiningCompanies(data || []);
  };

  const loadProductionsByMiningCompany = async () => {
    const { data, error } = await supabase
      .from('v_available_productions')
      .select('*')
      .eq('mining_company_id', selectedMiningCompanyId)
      .eq('is_shipped', false)
      .order('production_date', { ascending: false })
      .limit(50);

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

  const handleMiningCompanyChange = (companyId: string) => {
    setSelectedMiningCompanyId(companyId);
    setSelectedLicenseId('');
    setSelectedLicense(null);
    setSelectedProductions([]);
  };

  const handleLicenseChange = (licenseId: string, license: License | null) => {
    setSelectedLicenseId(licenseId);
    setSelectedLicense(license);
  };

  const handleToggleProduction = (productionId: string) => {
    const production = productions.find(p => p.id === productionId);
    if (!production) return;

    const isSelected = selectedProductions.some(sp => sp.production.id === productionId);

    if (isSelected) {
      setSelectedProductions(selectedProductions.filter(sp => sp.production.id !== productionId));
    } else {
      const totalOz = getTotalSelectedOz() + production.estimated_oz;

      if (selectedLicense && totalOz > selectedLicense.remaining_qty_oz) {
        alert(
          `Impossible d'ajouter cette production.\n\n` +
          `Quantité licence restante: ${selectedLicense.remaining_qty_oz.toFixed(3)} oz\n` +
          `Quantité déjà sélectionnée: ${getTotalSelectedOz().toFixed(3)} oz\n` +
          `Quantité de cette production: ${production.estimated_oz.toFixed(3)} oz\n` +
          `Total: ${totalOz.toFixed(3)} oz\n\n` +
          `Dépassement: ${(totalOz - selectedLicense.remaining_qty_oz).toFixed(3)} oz`
        );
        return;
      }

      setSelectedProductions([...selectedProductions, {
        production,
        sealNumber1: '',
        sealNumber2: ''
      }]);
    }
  };

  const handleSealNumberChange = (productionId: string, sealNumber1: string, sealNumber2: string) => {
    setSelectedProductions(selectedProductions.map(sp =>
      sp.production.id === productionId ? { ...sp, sealNumber1, sealNumber2 } : sp
    ));
  };

  const getTotalSelectedOz = () => {
    return selectedProductions.reduce((sum, sp) => sum + sp.production.estimated_oz, 0);
  };

  const getTotalSelectedGrams = () => {
    return selectedProductions.reduce((sum, sp) => sum + sp.production.pure_gold_grams, 0);
  };

  const canProceedToStep2 = () => {
    return selectedMiningCompanyId && selectedLicenseId && selectedProductions.length > 0;
  };

  const canProceedToStep3 = () => {
    return selectedProductions.every(sp => sp.sealNumber1.trim());
  };

  const canSave = () => {
    return selectedFreightCompanyId && selectedRefineryId;
  };

  const handleSave = async () => {
    if (!canSave()) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    try {
      setSaving(true);

      const totalWeightOz = getTotalSelectedOz();

      const preparationData = {
        mining_company_id: selectedMiningCompanyId,
        license_id: selectedLicenseId,
        total_weight_oz: totalWeightOz,
        shipped_to_company: selectedFreightCompanyId,
        shipped_to_address: selectedRefineryId,
        status: 'prepared' as const,
        prepared_at: new Date().toISOString(),
      };

      const { data: preparation, error: prepError } = await supabase
        .from('shipping_preparations')
        .insert([preparationData])
        .select()
        .single();

      if (prepError) throw prepError;

      for (const sp of selectedProductions) {
        const { error: itemError } = await supabase
          .from('shipping_preparation_items')
          .insert([{
            shipping_preparation_id: preparation.id,
            daily_production_id: sp.production.id,
            seal_number_1: sp.sealNumber1,
            seal_number_2: sp.sealNumber2 || null,
          }]);

        if (itemError) throw itemError;
      }

      alert('Préparation d\'expédition créée avec succès!');
      navigate('/shipping/preparation');
    } catch (error: any) {
      console.error('Error saving preparation:', error);
      alert(`Erreur lors de la sauvegarde: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 3
    }).format(num);
  };

  return (
    <MainLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="secondary"
              onClick={() => navigate('/shipping/preparation')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Retour
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Nouvelle Préparation d'Expédition</h1>
              <p className="text-sm text-gray-600 mt-1">
                Créer une nouvelle expédition avec licence d'exportation
              </p>
            </div>
          </div>
        </div>

        <div className="mb-8">
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((stepNum) => (
              <div key={stepNum} className="flex items-center flex-1">
                <div
                  className={`flex items-center justify-center w-10 h-10 rounded-full font-semibold ${
                    step >= stepNum
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {step > stepNum ? <CheckCircle2 className="w-5 h-5" /> : stepNum}
                </div>
                <div className="ml-3 flex-1">
                  <div className={`text-sm font-medium ${
                    step >= stepNum ? 'text-blue-600' : 'text-gray-500'
                  }`}>
                    {stepNum === 1 && 'Sélection Société & Licence'}
                    {stepNum === 2 && 'Productions & Scellés'}
                    {stepNum === 3 && 'Transport & Destination'}
                  </div>
                </div>
                {stepNum < 3 && (
                  <div className={`h-0.5 flex-1 mx-2 ${
                    step > stepNum ? 'bg-blue-600' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {step === 1 && (
          <div className="space-y-6">
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="w-5 h-5 text-slate-600" />
                <h3 className="text-lg font-semibold text-gray-900">Société Minière</h3>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Sélectionner la Société Minière <span className="text-red-500">*</span>
                </label>
                <Select
                  value={selectedMiningCompanyId}
                  onChange={(e) => handleMiningCompanyChange(e.target.value)}
                  disabled={loading}
                  className="w-full"
                >
                  <option value="">-- Choisir une société minière --</option>
                  {miningCompanies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name} ({company.code}) - {company.country}
                    </option>
                  ))}
                </Select>
              </div>
            </Card>

            <LicenseSelectorCard
              selectedLicenseId={selectedLicenseId}
              onLicenseChange={handleLicenseChange}
              miningCompanyId={selectedMiningCompanyId}
              requiredQuantityOz={getTotalSelectedOz()}
            />

            {selectedMiningCompanyId && selectedLicenseId && (
              <Card className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="w-5 h-5 text-slate-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Productions Disponibles</h3>
                  <span className="ml-auto text-sm text-gray-600">
                    {productions.filter(p => !p.is_shipped).length} production(s) disponible(s)
                  </span>
                </div>

                {loading ? (
                  <div className="text-center py-8 text-gray-500">Chargement...</div>
                ) : productions.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <AlertCircle className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                    <p>Aucune production disponible pour cette société minière</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {productions.filter(p => !p.is_shipped).map((production) => {
                      const isSelected = selectedProductions.some(sp => sp.production.id === production.id);
                      return (
                        <div
                          key={production.id}
                          className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                            isSelected
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                          onClick={() => handleToggleProduction(production.id)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {}}
                                  className="w-5 h-5"
                                />
                                <div>
                                  <p className="font-medium text-gray-900">
                                    {production.bar_reference || 'Sans référence'}
                                  </p>
                                  <p className="text-sm text-gray-600">
                                    Date: {formatDate(production.production_date)}
                                  </p>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-gray-900">
                                {formatNumber(production.estimated_oz)} oz
                              </p>
                              <p className="text-sm text-gray-600">
                                {formatNumber(production.pure_gold_grams)} g
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {selectedProductions.length > 0 && (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-blue-900">
                          Total Sélectionné:
                        </span>
                        <div className="text-right">
                          <p className="text-xl font-bold text-blue-900">
                            {formatNumber(getTotalSelectedOz())} oz
                          </p>
                          <p className="text-sm text-blue-700">
                            {formatNumber(getTotalSelectedGrams())} g
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            )}

            <div className="flex justify-end">
              <Button
                onClick={() => setStep(2)}
                disabled={!canProceedToStep2()}
                className="px-8"
              >
                Suivant: Productions & Scellés
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Numéros de Scellés</h3>

              <div className="space-y-4">
                {selectedProductions.map((sp) => (
                  <div key={sp.production.id} className="p-4 bg-gray-50 rounded-lg">
                    <div className="mb-3">
                      <p className="font-medium text-gray-900">
                        {sp.production.bar_reference || 'Sans référence'}
                      </p>
                      <p className="text-sm text-gray-600">
                        {formatNumber(sp.production.estimated_oz)} oz
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Seal Number 1 <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={sp.sealNumber1}
                          onChange={(e) => handleSealNumberChange(sp.production.id, e.target.value, sp.sealNumber2)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          placeholder="Ex: SEAL-001"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Seal Number 2 (optionnel)
                        </label>
                        <input
                          type="text"
                          value={sp.sealNumber2}
                          onChange={(e) => handleSealNumberChange(sp.production.id, sp.sealNumber1, e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          placeholder="Ex: SEAL-002"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <div className="flex justify-between">
              <Button variant="secondary" onClick={() => setStep(1)}>
                Retour
              </Button>
              <Button
                onClick={() => setStep(3)}
                disabled={!canProceedToStep3()}
                className="px-8"
              >
                Suivant: Transport & Destination
              </Button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Transport & Destination</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Freight Company <span className="text-red-500">*</span>
                  </label>
                  <Select
                    value={selectedFreightCompanyId}
                    onChange={(e) => setSelectedFreightCompanyId(e.target.value)}
                    className="w-full"
                  >
                    <option value="">-- Choisir une freight company --</option>
                    {freightCompanies.map((company) => (
                      <option key={company.id} value={company.id}>
                        {company.name}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Refinery <span className="text-red-500">*</span>
                  </label>
                  <Select
                    value={selectedRefineryId}
                    onChange={(e) => setSelectedRefineryId(e.target.value)}
                    className="w-full"
                  >
                    <option value="">-- Choisir une refinery --</option>
                    {refineries.map((refinery) => (
                      <option key={refinery.id} value={refinery.id}>
                        {refinery.name} - {refinery.location}, {refinery.country}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-blue-50 border-blue-200">
              <h3 className="text-lg font-semibold text-blue-900 mb-4">Résumé</h3>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-blue-700">Société Minière:</span>
                  <span className="font-medium text-blue-900">
                    {miningCompanies.find(c => c.id === selectedMiningCompanyId)?.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700">Licence:</span>
                  <span className="font-medium text-blue-900">
                    {selectedLicense?.license_number}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700">Productions:</span>
                  <span className="font-medium text-blue-900">
                    {selectedProductions.length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700">Total:</span>
                  <span className="font-bold text-lg text-blue-900">
                    {formatNumber(getTotalSelectedOz())} oz
                  </span>
                </div>
              </div>
            </Card>

            <div className="flex justify-between">
              <Button variant="secondary" onClick={() => setStep(2)}>
                Retour
              </Button>
              <Button
                onClick={handleSave}
                disabled={!canSave() || saving}
                className="px-8 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
