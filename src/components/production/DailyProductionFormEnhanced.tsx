import { useState, useEffect } from 'react';
import { Save, X, RefreshCw, Calendar, CalendarRange, CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { TextArea } from '@/components/ui/TextArea';
import { Card } from '@/components/ui/Card';
import { FieldGuidePanel } from '@/components/ui/FieldGuidePanel';
import { dailyProductionService, DailyProduction, ProductionSummary } from '@/services/dailyProductionService';
import { supabase } from '@/lib/supabase';
import { dailyProductionFieldGuides } from '@/data/productionFieldGuides';

interface DailyProductionFormProps {
  production?: DailyProduction | null;
  onCancel: () => void;
  onSuccess: () => void;
}

interface MiningCompany {
  id: string;
  name: string;
}

export function DailyProductionFormEnhanced({ production, onCancel, onSuccess }: DailyProductionFormProps) {
  const [formData, setFormData] = useState({
    production_date: production?.production_date || new Date().toISOString().split('T')[0],
    bullion_grams: production?.bullion_grams?.toString() || '',
    estimated_fineness_pct: production?.estimated_fineness_pct?.toString() || '',
    bar_reference: production?.bar_reference || '',
    mining_company_id: production?.mining_company_id || '',
    notes: production?.notes || '',
  });

  const [weightUnit, setWeightUnit] = useState<'grams' | 'oz'>('grams');

  const [miningCompanies, setMiningCompanies] = useState<MiningCompany[]>([]);
  const [loading, setLoading] = useState(false);
  const [generatingBarRef, setGeneratingBarRef] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [wtdSummary, setWtdSummary] = useState<ProductionSummary | null>(null);
  const [mtdSummary, setMtdSummary] = useState<ProductionSummary | null>(null);
  const [ytdSummary, setYtdSummary] = useState<ProductionSummary | null>(null);
  const [activeField, setActiveField] = useState<string | null>(null);

  useEffect(() => {
    loadMiningCompanies();
    if (!production) {
      loadSummaries();
    }
  }, []);

  // Générer automatiquement la bar reference quand une société est sélectionnée
  useEffect(() => {
    if (formData.mining_company_id && !production) {
      generateBarReference(formData.mining_company_id, formData.production_date)
        .then(barRef => {
          if (barRef) {
            setFormData(prev => ({ ...prev, bar_reference: barRef }));
          }
        });
    }
  }, [formData.mining_company_id, miningCompanies]);

  const loadSummaries = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const [wtd, mtd] = await Promise.all([
        dailyProductionService.getWTDSummary(today),
        dailyProductionService.getMTDSummary(today)
      ]);
      setWtdSummary(wtd);
      setMtdSummary(mtd);

      const startOfYear = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
      const { data: ytdData } = await supabase
        .from('daily_production')
        .select('bullion_grams, pure_gold_grams, estimated_oz, estimated_fineness_pct')
        .gte('production_date', startOfYear)
        .lte('production_date', today);

      if (ytdData && ytdData.length > 0) {
        const total = ytdData.reduce((sum, p) => sum + p.estimated_oz, 0);
        const avgFineness = ytdData.reduce((sum, p) => sum + p.estimated_fineness_pct, 0) / ytdData.length;
        setYtdSummary({
          total_estimated_oz: total,
          avg_fineness_pct: avgFineness,
          record_count: ytdData.length,
          total_bullion_grams: ytdData.reduce((sum, p) => sum + p.bullion_grams, 0),
          total_pure_gold_grams: ytdData.reduce((sum, p) => sum + p.pure_gold_grams, 0)
        });
      }
    } catch (error) {
      console.error('Error loading summaries:', error);
    }
  };

  const loadMiningCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('mining_companies')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setMiningCompanies(data || []);
    } catch (error) {
      console.error('Error loading mining companies:', error);
    }
  };

  // Conversion helpers
  const gramsToOz = (grams: number) => grams / 31.1035;
  const ozToGrams = (oz: number) => oz * 31.1035;

  // Calcul du bullion en fonction de l'unité
  const bullionInGrams = weightUnit === 'grams'
    ? parseFloat(formData.bullion_grams) || 0
    : ozToGrams(parseFloat(formData.bullion_grams) || 0);

  const bullionInOz = gramsToOz(bullionInGrams);

  const pureGoldGrams = formData.bullion_grams && formData.estimated_fineness_pct
    ? (bullionInGrams * parseFloat(formData.estimated_fineness_pct) / 100).toFixed(2)
    : '0.00';

  const estimatedOz = pureGoldGrams !== '0.00'
    ? (parseFloat(pureGoldGrams) / 31.1035).toFixed(4)
    : '0.0000';

  // Fonction pour obtenir le préfixe de la société
  const getCompanyPrefix = (companyName: string): string => {
    const name = companyName.toLowerCase();

    // Société des Mines de Komana (SMK) -> HUMSMK
    if (name.includes('komana') || name.includes('smk')) {
      return 'HUMSMK';
    }
    // Kourousa -> HUMKGM
    if (name.includes('kourousa') || name.includes('kgm')) {
      return 'HUMKGM';
    }
    // Dugbe -> HUMDUG
    if (name.includes('dugbe') || name.includes('dug')) {
      return 'HUMDUG';
    }
    // Mansa Resource -> HUMMRL
    if (name.includes('mansa') || name.includes('mrl')) {
      return 'HUMMRL';
    }

    // Par défaut, utiliser les 3 premières lettres après HUM
    return 'HUM' + companyName.substring(0, 3).toUpperCase();
  };

  const generateBarReference = async (companyId: string, productionDate: string) => {
    try {
      const company = miningCompanies.find(c => c.id === companyId);
      if (!company) return '';

      const prefix = getCompanyPrefix(company.name);

      // Obtenir le dernier numéro pour ce préfixe
      const { data, error } = await supabase
        .from('daily_production')
        .select('bar_reference')
        .like('bar_reference', `${prefix}-%`)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      let nextNumber = 1;
      if (data && data.length > 0 && data[0].bar_reference) {
        const lastRef = data[0].bar_reference;
        const match = lastRef.match(/-(\d+)$/);
        if (match) {
          nextNumber = parseInt(match[1], 10) + 1;
        }
      }

      // Format: HUMSMK-0001, HUMKGM-0002, etc.
      return `${prefix}-${nextNumber.toString().padStart(4, '0')}`;
    } catch (error) {
      console.error('Error generating bar reference:', error);
      return '';
    }
  };

  const handleGenerateBarReference = async () => {
    if (!formData.mining_company_id) {
      alert('Veuillez sélectionner une société minière');
      return;
    }

    try {
      setGeneratingBarRef(true);
      const barRef = await generateBarReference(
        formData.mining_company_id,
        formData.production_date
      );
      setFormData(prev => ({ ...prev, bar_reference: barRef }));
    } catch (error) {
      console.error('Error generating bar reference:', error);
      alert('Erreur lors de la génération de la référence');
    } finally {
      setGeneratingBarRef(false);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.production_date) {
      newErrors.production_date = 'La date est requise';
    }

    if (!formData.bullion_grams || parseFloat(formData.bullion_grams) <= 0) {
      newErrors.bullion_grams = 'Le poids du bullion doit être supérieur à 0';
    }

    if (!formData.estimated_fineness_pct || parseFloat(formData.estimated_fineness_pct) <= 0 || parseFloat(formData.estimated_fineness_pct) > 100) {
      newErrors.estimated_fineness_pct = 'La finesse doit être entre 0 et 100%';
    }

    if (!formData.mining_company_id) {
      newErrors.mining_company_id = 'Veuillez sélectionner une mining company';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);

      // Toujours sauvegarder en grammes
      const bullionGramsToSave = weightUnit === 'oz'
        ? ozToGrams(parseFloat(formData.bullion_grams))
        : parseFloat(formData.bullion_grams);

      const data = {
        production_date: formData.production_date,
        bullion_grams: bullionGramsToSave,
        estimated_fineness_pct: parseFloat(formData.estimated_fineness_pct),
        bar_reference: formData.bar_reference || undefined,
        mining_company_id: formData.mining_company_id || undefined,
        notes: formData.notes || undefined,
      };

      if (production?.id) {
        await dailyProductionService.updateProduction(production.id, data);
      } else {
        await dailyProductionService.createProduction(data);
      }

      onSuccess();
    } catch (error: any) {
      console.error('Error saving production:', error);
      alert(error.message || 'Erreur lors de la sauvegarde');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Production Form - 3 columns */}
      <div className="lg:col-span-3">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">
              {production ? 'Modifier Production' : 'Nouvelle Production Journalière'}
            </h2>
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              size="sm"
            >
              <X className="w-4 h-4 mr-1" />
              Annuler
            </Button>
          </div>

          {/* Period Summaries - Only show for new production */}
          {!production && (wtdSummary || mtdSummary || ytdSummary) && (
            <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* WTD Summary */}
              {wtdSummary && (
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-2 bg-blue-600 rounded-lg">
                      <Calendar className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-blue-900">Week-To-Date</h3>
                      <p className="text-xs text-blue-700">Semaine en cours</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-xs text-blue-700">Production:</span>
                      <span className="text-sm font-bold text-blue-900">
                        {wtdSummary.total_estimated_oz?.toFixed(2)} oz
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-blue-700">Records:</span>
                      <span className="text-sm font-semibold text-blue-900">
                        {wtdSummary.record_count}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* MTD Summary */}
              {mtdSummary && (
                <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-lg p-4 border border-emerald-200">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-2 bg-emerald-600 rounded-lg">
                      <CalendarRange className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-emerald-900">Month-To-Date</h3>
                      <p className="text-xs text-emerald-700">Mois en cours</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-xs text-emerald-700">Production:</span>
                      <span className="text-sm font-bold text-emerald-900">
                        {mtdSummary.total_estimated_oz?.toFixed(2)} oz
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-emerald-700">Records:</span>
                      <span className="text-sm font-semibold text-emerald-900">
                        {mtdSummary.record_count}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* YTD Summary */}
              {ytdSummary && (
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-2 bg-purple-600 rounded-lg">
                      <CalendarClock className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-purple-900">Year-To-Date</h3>
                      <p className="text-xs text-purple-700">Année en cours</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-xs text-purple-700">Production:</span>
                      <span className="text-sm font-bold text-purple-900">
                        {ytdSummary.total_estimated_oz?.toFixed(2)} oz
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-purple-700">Records:</span>
                      <span className="text-sm font-semibold text-purple-900">
                        {ytdSummary.record_count}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Production Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date de Production *
                </label>
                <input
                  type="date"
                  value={formData.production_date}
                  onChange={(e) => handleChange('production_date', e.target.value)}
                  onFocus={() => setActiveField('production_date')}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                    errors.production_date ? 'border-red-500' : 'border-gray-300'
                  }`}
                  required
                />
                {errors.production_date && (
                  <p className="text-red-500 text-sm mt-1">{errors.production_date}</p>
                )}
              </div>

              {/* Mining Company */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mining Company *
                </label>
                <select
                  value={formData.mining_company_id}
                  onChange={(e) => handleChange('mining_company_id', e.target.value)}
                  onFocus={() => setActiveField('mining_company_id')}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 ${
                    errors.mining_company_id ? 'border-red-500' : 'border-gray-300'
                  }`}
                  required
                >
                  <option value="">Sélectionner...</option>
                  {miningCompanies.map(company => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
                {errors.mining_company_id && (
                  <p className="text-red-500 text-sm mt-1">{errors.mining_company_id}</p>
                )}
              </div>

              {/* Bar Reference - Read Only */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bar Reference
                </label>
                <Input
                  type="text"
                  value={formData.bar_reference}
                  onFocus={() => setActiveField('bar_reference')}
                  placeholder="Auto-généré"
                  className="bg-gray-50 cursor-not-allowed"
                  readOnly
                  disabled
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Bullion with Unit Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bullion *
                </label>
                <div className="flex gap-2">
                  <select
                    value={weightUnit}
                    onChange={(e) => setWeightUnit(e.target.value as 'grams' | 'oz')}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                  >
                    <option value="grams">g</option>
                    <option value="oz">oz</option>
                  </select>
                  <div className="flex-1">
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.bullion_grams}
                      onChange={(e) => handleChange('bullion_grams', e.target.value)}
                      onFocus={() => setActiveField('bullion_grams')}
                      placeholder={weightUnit === 'grams' ? 'ex: 11270' : 'ex: 362.31'}
                      error={errors.bullion_grams}
                      required
                    />
                  </div>
                </div>
                {/* Conversion display */}
                {formData.bullion_grams && (
                  <div className="mt-2 space-y-1">
                    {weightUnit === 'grams' ? (
                      <p className="text-sm text-gray-600">= {bullionInOz.toFixed(2)} oz</p>
                    ) : (
                      <p className="text-sm text-gray-600">= {bullionInGrams.toFixed(2)} g</p>
                    )}
                    <p className="text-xs text-gray-500">Reference: 1 oz = 31.10 g</p>
                  </div>
                )}
              </div>

              {/* Estimated Fineness */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Estimated Fineness (%) *
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.estimated_fineness_pct}
                  onChange={(e) => handleChange('estimated_fineness_pct', e.target.value)}
                  onFocus={() => setActiveField('estimated_fineness_pct')}
                  placeholder="ex: 92.1"
                  error={errors.estimated_fineness_pct}
                  required
                />
              </div>
            </div>

            {/* Calculated Fields */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-blue-900 mb-3">
                Calculs Automatiques
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-blue-700 mb-1">
                    Pure Gold (g)
                  </label>
                  <div className="text-2xl font-bold text-blue-900">
                    {pureGoldGrams}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-blue-700 mb-1">
                    Estimated Oz
                  </label>
                  <div className="text-2xl font-bold text-blue-900">
                    {estimatedOz}
                  </div>
                </div>
              </div>

              <p className="text-xs text-blue-600 mt-2">
                Pure Gold = Bullion × Fineness ÷ 100 | Oz = Pure Gold ÷ 31.1035
              </p>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes
              </label>
              <TextArea
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                onFocus={() => setActiveField('notes')}
                placeholder="Notes supplémentaires sur la production..."
                rows={3}
              />
            </div>

            {/* Form Actions */}
            <div className="flex gap-3 pt-4 border-t border-gray-200">
              <Button
                type="submit"
                disabled={loading}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <Save className="w-4 h-4 mr-2" />
                {loading ? 'Enregistrement...' : production ? 'Mettre à jour' : 'Enregistrer'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={loading}
              >
                Annuler
              </Button>
            </div>
          </form>
        </Card>
      </div>

      {/* Field Guide Panel - 1 column */}
      <div className="lg:col-span-1">
        <FieldGuidePanel
          fields={dailyProductionFieldGuides}
          activeField={activeField}
        />
      </div>
    </div>
  );
}
