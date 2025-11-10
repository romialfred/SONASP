import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { TextArea } from '@/components/ui/TextArea';
import { DatePicker } from '@/components/ui/DatePicker';
import { FieldGuidePanel } from '@/components/ui/FieldGuidePanel';
import { dailyProductionService, DailyProduction } from '@/services/dailyProductionService';
import { dailyProductionFieldGuides } from '@/data/productionFieldGuides';

interface DailyProductionFormProps {
  production?: DailyProduction | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function DailyProductionForm({ production, onClose, onSuccess }: DailyProductionFormProps) {
  const [formData, setFormData] = useState({
    production_date: production?.production_date || new Date().toISOString().split('T')[0],
    bullion_grams: production?.bullion_grams?.toString() || '',
    estimated_fineness_pct: production?.estimated_fineness_pct?.toString() || '',
    bar_reference: production?.bar_reference || '',
    notes: production?.notes || '',
  });

  const [activeField, setActiveField] = useState<string>('production_date');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const pureGoldGrams = formData.bullion_grams && formData.estimated_fineness_pct
    ? (parseFloat(formData.bullion_grams) * parseFloat(formData.estimated_fineness_pct) / 100).toFixed(2)
    : '0.00';

  const estimatedOz = pureGoldGrams !== '0.00'
    ? (parseFloat(pureGoldGrams) / 31.1035).toFixed(4)
    : '0.0000';

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
        estimated_fineness_pct: parseFloat(formData.estimated_fineness_pct),
        bar_reference: formData.bar_reference || undefined,
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
    setActiveField(field);
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {production ? 'Modifier Production' : 'Nouvelle Production Journalière'}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Enregistrez la production et les analyses préliminaires du laboratoire
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Form Section */}
          <div className="flex-1 overflow-y-auto p-6">
            <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
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
                  onFocus={() => setActiveField('bullion_grams')}
                  placeholder="ex: 11270"
                  error={errors.bullion_grams}
                  required
                />
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

              {/* Calculated Fields */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                <h3 className="text-sm font-semibold text-blue-900 mb-2">
                  Calculs Automatiques
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-blue-700 mb-1">
                      Pure Gold (g)
                    </label>
                    <div
                      className="w-full px-4 py-2 bg-white border border-blue-200 rounded-lg text-lg font-semibold text-blue-900"
                      onFocus={() => setActiveField('pure_gold_grams')}
                      tabIndex={0}
                    >
                      {pureGoldGrams}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-blue-700 mb-1">
                      Estimated Oz
                    </label>
                    <div
                      className="w-full px-4 py-2 bg-white border border-blue-200 rounded-lg text-lg font-semibold text-blue-900"
                      onFocus={() => setActiveField('estimated_oz')}
                      tabIndex={0}
                    >
                      {estimatedOz}
                    </div>
                  </div>
                </div>

                <p className="text-xs text-blue-600 mt-2">
                  Pure Gold = Bullion × Fineness ÷ 100 | Oz = Pure Gold ÷ 31.1035
                </p>
              </div>

              {/* Bar Reference */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bar Reference
                </label>
                <Input
                  type="text"
                  value={formData.bar_reference}
                  onChange={(e) => handleChange('bar_reference', e.target.value)}
                  onFocus={() => setActiveField('bar_reference')}
                  placeholder="ex: HUMSMK-1204"
                />
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
                  rows={4}
                />
              </div>

              {/* Form Actions */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={loading}
                >
                  Annuler
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  {loading ? 'Enregistrement...' : production ? 'Mettre à jour' : 'Enregistrer'}
                </Button>
              </div>
            </form>
          </div>

          {/* Field Guide Panel */}
          <div className="w-80 border-l border-gray-200 bg-gray-50 overflow-y-auto">
            <FieldGuidePanel
              fieldGuides={dailyProductionFieldGuides}
              activeField={activeField}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
