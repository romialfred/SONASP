import { useState, useEffect } from 'react';
import { Save, X, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { TextArea } from '@/components/ui/TextArea';
import { Card } from '@/components/ui/Card';
import { dailyProductionService, DailyProduction } from '@/services/dailyProductionService';
import { supabase } from '@/lib/supabase';

interface DailyProductionFormProps {
  production?: DailyProduction | null;
  onCancel: () => void;
  onSuccess: () => void;
}

interface MiningCompany {
  id: string;
  name: string;
}

export function DailyProductionForm({ production, onCancel, onSuccess }: DailyProductionFormProps) {
  const [formData, setFormData] = useState({
    production_date: production?.production_date || new Date().toISOString().split('T')[0],
    bullion_grams: production?.bullion_grams?.toString() || '',
    estimated_gold_pct: production?.estimated_gold_pct?.toString() || production?.estimated_fineness_pct?.toString() || '',
    estimated_silver_pct: production?.estimated_silver_pct?.toString() || '',
    bar_reference: production?.bar_reference || '',
    mining_company_id: production?.mining_company_id || '',
    notes: production?.notes || '',
  });

  const [miningCompanies, setMiningCompanies] = useState<MiningCompany[]>([]);
  const [loading, setLoading] = useState(false);
  const [generatingBarRef, setGeneratingBarRef] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadMiningCompanies();
  }, []);

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

  const pureGoldGrams = formData.bullion_grams && formData.estimated_gold_pct
    ? (parseFloat(formData.bullion_grams) * parseFloat(formData.estimated_gold_pct) / 100).toFixed(2)
    : '0.00';

  const estimatedOz = pureGoldGrams !== '0.00'
    ? (parseFloat(pureGoldGrams) / 31.1034768).toFixed(4)
    : '0.0000';

  const silverContentGrams = formData.bullion_grams && formData.estimated_silver_pct
    ? (parseFloat(formData.bullion_grams) * parseFloat(formData.estimated_silver_pct) / 100).toFixed(2)
    : '0.00';

  const silverContentOz = silverContentGrams !== '0.00'
    ? (parseFloat(silverContentGrams) / 31.1034768).toFixed(4)
    : '0.0000';

  const handleGenerateBarReference = async () => {
    try {
      setGeneratingBarRef(true);
      const companyName = miningCompanies.find(c => c.id === formData.mining_company_id)?.name;
      const barRef = await dailyProductionService.generateBarReference(
        companyName,
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

    if (!formData.estimated_gold_pct || parseFloat(formData.estimated_gold_pct) <= 0 || parseFloat(formData.estimated_gold_pct) > 100) {
      newErrors.estimated_gold_pct = 'La finesse or doit être entre 0 et 100%';
    }

    if (formData.estimated_silver_pct && (parseFloat(formData.estimated_silver_pct) < 0 || parseFloat(formData.estimated_silver_pct) > 100)) {
      newErrors.estimated_silver_pct = 'La finesse argent doit être entre 0 et 100%';
    }

    // Vérifier que la somme des pourcentages ne dépasse pas 100%
    const goldPct = parseFloat(formData.estimated_gold_pct) || 0;
    const silverPct = parseFloat(formData.estimated_silver_pct) || 0;
    if (goldPct + silverPct > 100) {
      newErrors.estimated_silver_pct = `La somme Or (${goldPct}%) + Argent (${silverPct}%) ne peut pas dépasser 100%`;
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

      const data = {
        production_date: formData.production_date,
        bullion_grams: parseFloat(formData.bullion_grams),
        estimated_gold_pct: parseFloat(formData.estimated_gold_pct),
        estimated_silver_pct: formData.estimated_silver_pct ? parseFloat(formData.estimated_silver_pct) : 0,
        estimated_fineness_pct: parseFloat(formData.estimated_gold_pct),
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

          {/* Bar Reference with Auto-Generate */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Bar Reference
            </label>
            <div className="flex gap-2">
              <Input
                type="text"
                value={formData.bar_reference}
                onChange={(e) => handleChange('bar_reference', e.target.value)}
                placeholder="Auto-généré"
                className="flex-1"
              />
              <Button
                type="button"
                onClick={handleGenerateBarReference}
                disabled={generatingBarRef || !formData.mining_company_id}
                variant="outline"
                size="sm"
                title="Générer automatiquement"
              >
                <RefreshCw className={`w-4 h-4 ${generatingBarRef ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Laissez vide pour génération automatique
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Bullion Grams */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Bullion (g) *
            </label>
            <Input
              type="number"
              step="0.01"
              value={formData.bullion_grams}
              onChange={(e) => handleChange('bullion_grams', e.target.value)}
              placeholder="ex: 11270"
              error={errors.bullion_grams}
              required
            />
          </div>

          {/* Estimated Gold Fineness */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Estimated Fineness Gold (%) *
            </label>
            <Input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={formData.estimated_gold_pct}
              onChange={(e) => handleChange('estimated_gold_pct', e.target.value)}
              placeholder="ex: 92.1"
              error={errors.estimated_gold_pct}
              required
            />
          </div>

          {/* Estimated Silver Percentage */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Estimated Silver (%)
            </label>
            <Input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={formData.estimated_silver_pct}
              onChange={(e) => handleChange('estimated_silver_pct', e.target.value)}
              placeholder="ex: 5.2"
              error={errors.estimated_silver_pct}
            />
          </div>
        </div>

        {/* Calculated Fields */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-900 mb-3">
            Calculs Automatiques
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-blue-700 mb-1">
                Pure Gold (g)
              </label>
              <div className="text-xl font-bold text-blue-900">
                {pureGoldGrams}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-blue-700 mb-1">
                Gold Oz
              </label>
              <div className="text-xl font-bold text-blue-900">
                {estimatedOz}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Ag Content (g)
              </label>
              <div className="text-xl font-bold text-gray-700">
                {silverContentGrams}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Silver Oz
              </label>
              <div className="text-xl font-bold text-gray-700">
                {silverContentOz}
              </div>
            </div>
          </div>

          <p className="text-xs text-blue-600 mt-2">
            Pure Gold = Bullion × Gold% ÷ 100 | Ag Content = Bullion × Silver% ÷ 100 | Oz = Grams ÷ 31.1034768
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
  );
}
