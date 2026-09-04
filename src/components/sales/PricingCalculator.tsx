import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { CustomAlert } from '@/components/ui/CustomAlert';
import { Calendar, TrendingUp, Clock, Factory, DollarSign, AlertCircle } from 'lucide-react';
import { calculatePricingComparison, type PricingComparison, type PricingMechanism } from '@/services/goldTradeSpaceService';
import { useCustomAlert } from '@/hooks/useCustomAlert';

const formatNumber = (value: number, maximumFractionDigits = 2) =>
  new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits }).format(value);

const formatUsd = (value: number) =>
  new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);

const trendLabel = (trend: PricingComparison['goldTrend']) => ({
  bullish: 'Haussière',
  bearish: 'Baissière',
  neutral: 'Neutre',
})[trend];

interface PricingCalculatorProps {
  availableStockOz: number;
  onMechanismSelect?: (mechanism: PricingMechanism, comparison: PricingComparison) => void;
}

export function PricingCalculator({ availableStockOz, onMechanismSelect }: PricingCalculatorProps) {
  const {
    alertState,
    showError,
    closeAlert
  } = useCustomAlert();
  const [quantityOz, setQuantityOz] = useState<string>('');
  const [unit, setUnit] = useState<'oz' | 'g'>('oz');
  const [comparison, setComparison] = useState<PricingComparison | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedMechanism, setSelectedMechanism] = useState<string | null>(null);

  const GRAMS_PER_OZ = 31.1034768;

  useEffect(() => {
    if (availableStockOz > 0) {
      setQuantityOz((unit === 'oz' ? availableStockOz : availableStockOz * GRAMS_PER_OZ).toFixed(2).replace('.', ','));
    }
  }, [availableStockOz, unit]);

  const getQuantityInOz = (): number => {
    const qty = Number.parseFloat(quantityOz.replace(',', '.'));
    if (isNaN(qty)) return 0;
    return unit === 'oz' ? qty : qty / GRAMS_PER_OZ;
  };

  const handleCalculate = async () => {
    const qtyInOz = getQuantityInOz();

    // Add tolerance for floating point comparison (0.01 oz = ~0.31 grams tolerance)
    const tolerance = 0.01;

    if (isNaN(qtyInOz) || qtyInOz <= 0) {
      showError(
        'La quantité saisie doit être un nombre strictement positif.',
        'Quantité invalide'
      );
      return;
    }

    if (qtyInOz > (availableStockOz + tolerance)) {
      showError(
        `La quantité saisie (${formatNumber(qtyInOz)} oz) dépasse le stock disponible (${formatNumber(availableStockOz)} oz).`,
        'Stock insuffisant'
      );
      return;
    }

    setLoading(true);

    try {
      const result = await calculatePricingComparison(qtyInOz);

      if (result.success && result.data) {
        // Sort mechanisms by benefit (highest to lowest)
        const sortedMechanisms = [...result.data.mechanisms].sort((a, b) => b.benefit - a.benefit);

        setComparison({
          ...result.data,
          mechanisms: sortedMechanisms
        });
        setSelectedMechanism(result.data.recommendedMechanism);
      } else {
        showError(
          `Le calcul n’a pas abouti : ${result.error || 'cours de l’or indisponible'}.`,
          'Calcul indisponible'
        );
      }
    } catch (error: any) {
      console.error('[PricingCalculator] Calculation failed:', error);

      showError(
        'Le calcul est momentanément indisponible. Réessayez ou contactez l’administrateur.',
        'Erreur de calcul'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSelectMechanism = (mechanism: PricingMechanism) => {
    setSelectedMechanism(mechanism.mechanism);
    if (onMechanismSelect && comparison) {
      onMechanismSelect(mechanism, comparison);
    }
  };

  const getMechanismIcon = (mechanism: string) => {
    if (mechanism === 'spot') return <Clock className="w-5 h-5" />;
    if (mechanism.includes('forward')) return <Calendar className="w-5 h-5" />;
    if (mechanism === 'in_process') return <Factory className="w-5 h-5" />;
    return <DollarSign className="w-5 h-5" />;
  };

  const getMechanismBadge = (index: number) => {
    if (index === 0) {
      return (
        <span className="px-2 py-1 text-xs font-semibold bg-emerald-100 text-emerald-800 rounded">
          Meilleure option
        </span>
      );
    }
    return null;
  };

  const getCardBackgroundColor = (index: number) => {
    if (index === 0) {
      // Best option - light green
      return 'bg-emerald-50/80';
    }
    // No background color for other cards
    return '';
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Simulateur de tarification</h3>
            <div className="text-sm text-gray-500">
              Disponible : <span className="font-semibold text-gray-900">{formatNumber(availableStockOz)} oz</span>
              <span className="text-gray-400"> ({formatNumber(availableStockOz * GRAMS_PER_OZ)} g)</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quantité à vendre — 100 % du stock disponible ({unit === 'oz' ? 'onces troy' : 'grammes'})
              </label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Input
                    type="text"
                    value={quantityOz}
                    readOnly
                    className="bg-amber-50 border-amber-300 font-semibold text-amber-900 cursor-not-allowed"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                    <span className="text-xs font-bold text-amber-700 bg-amber-200 px-2 py-1 rounded">
                      100%
                    </span>
                  </div>
                </div>
                <Select
                  value={unit}
                  onChange={(e) => {
                    const newUnit = e.target.value as 'oz' | 'g';
                    setUnit(newUnit);
                    setQuantityOz((newUnit === 'oz' ? availableStockOz : availableStockOz * GRAMS_PER_OZ).toFixed(2).replace('.', ','));
                  }}
                  className="w-20"
                >
                  <option value="oz">oz</option>
                  <option value="g">g</option>
                </Select>
              </div>
              <div className="flex items-center gap-2 mt-2 p-2 bg-blue-50 rounded-md border border-blue-200">
                <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <p className="text-xs text-blue-800">
                  <strong>Règle de vente :</strong> les sociétés minières doivent céder 100 % de leur stock exportable. Les ventes partielles ne sont pas autorisées.
                </p>
              </div>
              {quantityOz && getQuantityInOz() > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  = {unit === 'oz' ? `${formatNumber(getQuantityInOz() * GRAMS_PER_OZ)} g` : `${formatNumber(getQuantityInOz())} oz`}
                </p>
              )}
            </div>

            <div className="flex items-end">
              <Button
                onClick={handleCalculate}
                disabled={loading || !quantityOz || getQuantityInOz() <= 0}
                className="w-full"
              >
                {loading ? 'Simulation en cours…' : 'Simuler'}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {comparison && (
        <div className="space-y-4">
          <Card className="bg-blue-50 border-blue-200">
            <div className="p-4 space-y-3">
              <div className="flex items-start gap-3">
                <TrendingUp className={`w-5 h-5 mt-0.5 ${
                  comparison.goldTrend === 'bullish' ? 'text-green-600' :
                  comparison.goldTrend === 'bearish' ? 'text-red-600' :
                  'text-gray-600'
                }`} />
                <div className="flex-1">
                  <h4 className="font-semibold text-gray-900">Analyse du marché</h4>
                  <p className="text-sm text-gray-700 mt-1">{comparison.recommendationReason}</p>
                  <div className="flex gap-4 mt-2 text-xs text-gray-600">
                    <span>Tendance : <span className="font-semibold">{trendLabel(comparison.goldTrend)}</span></span>
                    <span>Volatilité : <span className="font-semibold">{formatNumber(comparison.marketVolatility)} %</span></span>
                    <span>Prix au comptant : <span className="font-semibold">{formatUsd(comparison.spotPrice)}/oz</span></span>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-4 gap-3">
            {comparison.mechanisms.map((mechanism, index) => {
              const isSelected = mechanism.mechanism === selectedMechanism;
              const isBestOption = index === 0;
              const bgColor = getCardBackgroundColor(index);

              return (
                <Card
                  key={mechanism.mechanism}
                  className={`cursor-pointer transition-all duration-200 ease-in-out hover:scale-105 ${
                    isSelected
                      ? 'ring-2 ring-blue-500 shadow-lg'
                      : isBestOption
                      ? 'ring-2 ring-emerald-500 shadow-md'
                      : 'hover:shadow-md'
                  } ${bgColor}`}
                  onClick={() => handleSelectMechanism(mechanism)}
                >
                  <div className="p-3 space-y-2">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        {getMechanismIcon(mechanism.mechanism)}
                        <div>
                          <h4 className="font-semibold text-sm text-gray-900">{mechanism.displayName}</h4>
                          <p className="text-xs text-gray-500">{mechanism.settlementDays} jours</p>
                        </div>
                      </div>
                      {getMechanismBadge(index)}
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between items-baseline">
                        <span className="text-xs text-gray-600">Prix par once :</span>
                        <span className="text-base font-bold text-gray-900">
                          {formatUsd(mechanism.pricePerOz)}
                        </span>
                      </div>

                      {mechanism.adjustmentPercentage !== 0 && (
                        <div className="flex justify-between items-baseline">
                          <span className="text-xs text-gray-500">Ajustement :</span>
                          <span className={`text-xs font-semibold ${
                            mechanism.adjustmentPercentage > 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {mechanism.adjustmentPercentage > 0 ? '+' : ''}{mechanism.adjustmentPercentage.toFixed(3)}%
                          </span>
                        </div>
                      )}

                      <div className="border-t border-gray-200 pt-1.5 mt-1.5">
                        <div className="flex justify-between items-baseline">
                          <span className="text-xs font-semibold text-gray-700">Valeur totale :</span>
                          <span className="text-base font-bold text-gray-900">
                            {formatUsd(mechanism.totalValue)}
                          </span>
                        </div>
                      </div>

                      {mechanism.benefit !== 0 && (
                        <div className={`text-center py-1 px-2 rounded text-xs font-semibold ${
                          mechanism.benefit > 0
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {mechanism.benefit > 0 ? '+' : '−'}{formatUsd(Math.abs(mechanism.benefit))} par rapport au comptant
                        </div>
                      )}

                      <div className="text-xs text-gray-500 pt-1 border-t border-gray-100">
                        <div className="flex justify-between">
                          <span>Date de valeur :</span>
                          <span className="font-medium">{new Date(mechanism.valueDate).toLocaleDateString('fr-FR')}</span>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-gray-600 border-t border-gray-100 pt-2 line-clamp-2">
                      {mechanism.description}
                    </p>

                    {isSelected && (
                      <p className="pt-1 text-center text-xs font-semibold text-blue-700">
                        Mécanisme sélectionné
                      </p>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>

          <Card className="bg-amber-50 border-amber-200">
            <div className="p-4 flex gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p className="font-semibold mb-1">Informations importantes :</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>Prix au comptant : règlement sous deux jours ouvrés, pendant les heures de négociation de New York (7 h 30 à 16 h 30, heure de l’Est).</li>
                  <li>Prix à terme : accord préalable de l’acheteur et ajustement selon les taux à terme en vigueur.</li>
                  <li>Prix en cours de raffinage : fixation pendant le traitement, sous réserve d’un préavis de sept jours.</li>
                  <li>Tous les prix restent soumis à la validation finale et aux conditions du marché.</li>
                </ul>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Custom Alert Dialog */}
      <CustomAlert
        isOpen={alertState.isOpen}
        onClose={closeAlert}
        title={alertState.title}
        message={alertState.message}
        type={alertState.type}
      />
    </div>
  );
}
