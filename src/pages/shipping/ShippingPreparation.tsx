import { useState, useEffect } from 'react';
import { Package, Calendar, Factory, Scale, Percent, Save, X, Edit2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { supabase } from '@/lib/supabase';

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
  };
  status?: 'pending' | 'prepared' | 'shipped';
}

export default function ShippingPreparation() {
  const [productions, setProductions] = useState<DailyProduction[]>([]);
  const [selectedProduction, setSelectedProduction] = useState<DailyProduction | null>(null);
  const [editedFineness, setEditedFineness] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadProductions();
  }, []);

  useEffect(() => {
    if (selectedProduction) {
      setEditedFineness(selectedProduction.estimated_fineness_pct.toString());
    }
  }, [selectedProduction]);

  const loadProductions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('daily_production')
        .select(`
          *,
          mining_company:mining_companies(id, name)
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

  const handleProductionSelect = (productionId: string) => {
    const production = productions.find(p => p.id === productionId);
    if (production) {
      setSelectedProduction(production);
      setIsEditing(false);
    }
  };

  const calculateUpdatedValues = () => {
    if (!selectedProduction || !editedFineness) return null;

    const fineness = parseFloat(editedFineness);
    const pureGoldGrams = (selectedProduction.bullion_grams * fineness) / 100;
    const estimatedOz = pureGoldGrams / 31.1035;

    return {
      pure_gold_grams: pureGoldGrams,
      estimated_oz: estimatedOz,
      estimated_fineness_pct: fineness,
    };
  };

  const handleSaveFineness = async () => {
    if (!selectedProduction) return;

    const updatedValues = calculateUpdatedValues();
    if (!updatedValues) return;

    try {
      setSaving(true);

      const { error } = await supabase
        .from('daily_production')
        .update({
          estimated_fineness_pct: updatedValues.estimated_fineness_pct,
          pure_gold_grams: updatedValues.pure_gold_grams,
          estimated_oz: updatedValues.estimated_oz,
        })
        .eq('id', selectedProduction.id);

      if (error) throw error;

      // Reload productions and update selected
      await loadProductions();
      const updated = productions.find(p => p.id === selectedProduction.id);
      if (updated) {
        setSelectedProduction({
          ...updated,
          estimated_fineness_pct: updatedValues.estimated_fineness_pct,
          pure_gold_grams: updatedValues.pure_gold_grams,
          estimated_oz: updatedValues.estimated_oz,
        });
      }

      setIsEditing(false);
      alert('Fineness mis à jour avec succès');
    } catch (error) {
      console.error('Error updating fineness:', error);
      alert('Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
    }
  };

  const updatedValues = calculateUpdatedValues();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Shipping Preparation</h1>
          <p className="text-gray-600 mt-1">
            Préparez les barres de production pour l'expédition
          </p>
        </div>
      </div>

      {/* Production Selector */}
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Package className="w-6 h-6 text-emerald-600" />
          <h2 className="text-xl font-bold text-gray-900">Sélectionner une Production</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Production du Jour
            </label>
            <select
              value={selectedProduction?.id || ''}
              onChange={(e) => handleProductionSelect(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
              disabled={loading}
            >
              <option value="">-- Sélectionner une production --</option>
              {productions.map((production) => (
                <option key={production.id} value={production.id}>
                  {new Date(production.production_date).toLocaleDateString('fr-FR')} -
                  {production.bar_reference || 'Sans référence'} -
                  {production.bullion_grams.toFixed(2)}g -
                  {production.mining_company?.name || 'N/A'}
                </option>
              ))}
            </select>
          </div>

          {loading && (
            <div className="text-center py-4">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
              <p className="text-gray-600 mt-2">Chargement des productions...</p>
            </div>
          )}
        </div>
      </Card>

      {/* Production Details */}
      {selectedProduction && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Essential Information */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <CheckCircle className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-bold text-gray-900">Informations Essentielles</h2>
            </div>

            <div className="space-y-4">
              {/* Production Date */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">Date de Production</span>
                </div>
                <p className="text-lg font-bold text-blue-900">
                  {new Date(selectedProduction.production_date).toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>

              {/* Mining Company */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Factory className="w-5 h-5 text-amber-600" />
                  <span className="text-sm font-medium text-amber-900">Mining Company</span>
                </div>
                <p className="text-lg font-bold text-amber-900">
                  {selectedProduction.mining_company?.name || 'N/A'}
                </p>
              </div>

              {/* Bar Reference */}
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Package className="w-5 h-5 text-purple-600" />
                  <span className="text-sm font-medium text-purple-900">Bar Reference</span>
                </div>
                <p className="text-lg font-bold text-purple-900 font-mono">
                  {selectedProduction.bar_reference || 'Non définie'}
                </p>
              </div>

              {/* Bullion Weight */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Scale className="w-5 h-5 text-emerald-600" />
                  <span className="text-sm font-medium text-emerald-900">Bullion Weight</span>
                </div>
                <p className="text-lg font-bold text-emerald-900">
                  {selectedProduction.bullion_grams.toFixed(2)} g
                  <span className="text-sm font-normal text-emerald-700 ml-2">
                    ({(selectedProduction.bullion_grams / 31.1035).toFixed(2)} oz)
                  </span>
                </p>
              </div>

              {/* Notes */}
              {selectedProduction.notes && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <span className="text-sm font-medium text-gray-700 block mb-2">Notes</span>
                  <p className="text-sm text-gray-900">{selectedProduction.notes}</p>
                </div>
              )}
            </div>
          </Card>

          {/* Fineness Adjustment */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Percent className="w-6 h-6 text-orange-600" />
                <h2 className="text-xl font-bold text-gray-900">Ajustement Fineness</h2>
              </div>
              {!isEditing && (
                <Button
                  onClick={() => setIsEditing(true)}
                  variant="outline"
                  size="sm"
                >
                  <Edit2 className="w-4 h-4 mr-1" />
                  Modifier
                </Button>
              )}
            </div>

            <div className="space-y-4">
              {/* Current Fineness */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fineness Actuel (%)
                </label>
                <div className="bg-gray-50 border border-gray-300 rounded-lg p-3">
                  <p className="text-2xl font-bold text-gray-900">
                    {selectedProduction.estimated_fineness_pct.toFixed(2)}%
                  </p>
                </div>
              </div>

              {/* Edit Fineness */}
              {isEditing && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nouveau Fineness (%)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={editedFineness}
                    onChange={(e) => setEditedFineness(e.target.value)}
                    placeholder="Ex: 92.5"
                  />
                </div>
              )}

              {/* Updated Calculations Preview */}
              {isEditing && updatedValues && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-yellow-900 mb-3">
                    Aperçu des Nouveaux Calculs
                  </h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-yellow-700">Pure Gold:</span>
                      <span className="text-sm font-bold text-yellow-900">
                        {updatedValues.pure_gold_grams.toFixed(2)} g
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-yellow-700">Estimated Oz:</span>
                      <span className="text-sm font-bold text-yellow-900">
                        {updatedValues.estimated_oz.toFixed(4)} oz
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Current Calculations */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-blue-900 mb-3">
                  Calculs Actuels
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-blue-700">Pure Gold:</span>
                    <span className="text-sm font-bold text-blue-900">
                      {selectedProduction.pure_gold_grams.toFixed(2)} g
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-blue-700">Estimated Oz:</span>
                    <span className="text-sm font-bold text-blue-900">
                      {selectedProduction.estimated_oz.toFixed(4)} oz
                    </span>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-blue-300">
                  <p className="text-xs text-blue-600">
                    Pure Gold = Bullion × Fineness ÷ 100
                    <br />
                    Oz = Pure Gold ÷ 31.1035
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              {isEditing && (
                <div className="flex gap-2">
                  <Button
                    onClick={handleSaveFineness}
                    disabled={saving || !editedFineness || parseFloat(editedFineness) <= 0 || parseFloat(editedFineness) > 100}
                    className="flex-1"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {saving ? 'Enregistrement...' : 'Enregistrer'}
                  </Button>
                  <Button
                    onClick={() => {
                      setIsEditing(false);
                      setEditedFineness(selectedProduction.estimated_fineness_pct.toString());
                    }}
                    variant="outline"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Annuler
                  </Button>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Empty State */}
      {!selectedProduction && !loading && (
        <Card className="p-12">
          <div className="text-center">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Aucune Production Sélectionnée
            </h3>
            <p className="text-gray-600">
              Sélectionnez une production ci-dessus pour voir les détails et préparer l'expédition
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
