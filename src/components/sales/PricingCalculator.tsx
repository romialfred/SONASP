import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Calendar, TrendingUp, Clock, Factory, DollarSign, AlertCircle } from 'lucide-react';
import { calculatePricingComparison, type PricingComparison, type PricingMechanism } from '@/services/goldTradeSpaceService';

interface PricingCalculatorProps {
  availableStockOz: number;
  onMechanismSelect?: (mechanism: PricingMechanism) => void;
}

export function PricingCalculator({ availableStockOz, onMechanismSelect }: PricingCalculatorProps) {
  const [quantityOz, setQuantityOz] = useState<string>('');
  const [unit, setUnit] = useState<'oz' | 'g'>('oz');
  const [comparison, setComparison] = useState<PricingComparison | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedMechanism, setSelectedMechanism] = useState<string | null>(null);

  const GRAMS_PER_OZ = 31.1035;

  const getQuantityInOz = (): number => {
    const qty = parseFloat(quantityOz);
    if (isNaN(qty)) return 0;
    return unit === 'oz' ? qty : qty / GRAMS_PER_OZ;
  };

  const getDisplayQuantity = (oz: number): string => {
    return unit === 'oz' ? oz.toFixed(2) : (oz * GRAMS_PER_OZ).toFixed(2);
  };

  const handleCalculate = async () => {
    const qtyInOz = getQuantityInOz();
    if (isNaN(qtyInOz) || qtyInOz <= 0 || qtyInOz > availableStockOz) {
      return;
    }

    setLoading(true);
    try {
      const result = await calculatePricingComparison(qtyInOz);
      if (result.success && result.data) {
        setComparison(result.data);
        setSelectedMechanism(result.data.recommendedMechanism);
      }
    } catch (error) {
      console.error('Error calculating pricing:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectMechanism = (mechanism: PricingMechanism) => {
    setSelectedMechanism(mechanism.mechanism);
    if (onMechanismSelect) {
      onMechanismSelect(mechanism);
    }
  };

  const getMechanismIcon = (mechanism: string) => {
    if (mechanism === 'spot') return <Clock className="w-5 h-5" />;
    if (mechanism.includes('forward')) return <Calendar className="w-5 h-5" />;
    if (mechanism === 'in_process') return <Factory className="w-5 h-5" />;
    return <DollarSign className="w-5 h-5" />;
  };

  const getMechanismBadge = (mechanism: string, isRecommended: boolean) => {
    if (isRecommended) {
      return (
        <span className="px-2 py-1 text-xs font-semibold bg-emerald-100 text-emerald-800 rounded">
          Recommended
        </span>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <Card>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Pricing Calculator</h3>
            <div className="text-sm text-gray-500">
              Available: <span className="font-semibold text-gray-900">{availableStockOz.toFixed(2)} oz</span>
              <span className="text-gray-400"> ({(availableStockOz * GRAMS_PER_OZ).toFixed(2)} g)</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quantity to Sell ({unit === 'oz' ? 'oz' : 'grams'})
              </label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  value={quantityOz}
                  onChange={(e) => setQuantityOz(e.target.value)}
                  placeholder={`Enter quantity in ${unit}`}
                  min="0"
                  max={unit === 'oz' ? availableStockOz : availableStockOz * GRAMS_PER_OZ}
                  step={unit === 'oz' ? '0.01' : '1'}
                  className="flex-1"
                />
                <Select
                  value={unit}
                  onChange={(e) => {
                    const newUnit = e.target.value as 'oz' | 'g';
                    const currentOz = getQuantityInOz();
                    setUnit(newUnit);
                    if (currentOz > 0) {
                      setQuantityOz(newUnit === 'oz' ? currentOz.toFixed(2) : (currentOz * GRAMS_PER_OZ).toFixed(2));
                    }
                  }}
                  className="w-20"
                >
                  <option value="oz">oz</option>
                  <option value="g">g</option>
                </Select>
              </div>
              {getQuantityInOz() > availableStockOz && (
                <p className="text-xs text-red-600 mt-1">Quantity exceeds available stock</p>
              )}
              {quantityOz && getQuantityInOz() > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  = {unit === 'oz' ? `${(getQuantityInOz() * GRAMS_PER_OZ).toFixed(2)} grams` : `${getQuantityInOz().toFixed(2)} oz`}
                </p>
              )}
            </div>

            <div className="flex items-end">
              <Button
                onClick={handleCalculate}
                disabled={loading || !quantityOz || getQuantityInOz() <= 0 || getQuantityInOz() > availableStockOz}
                className="w-full"
              >
                {loading ? 'Simulating...' : 'Simulate'}
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
                  <h4 className="font-semibold text-gray-900">Market Analysis</h4>
                  <p className="text-sm text-gray-700 mt-1">{comparison.recommendationReason}</p>
                  <div className="flex gap-4 mt-2 text-xs text-gray-600">
                    <span>Trend: <span className="font-semibold capitalize">{comparison.goldTrend}</span></span>
                    <span>Volatility: <span className="font-semibold">{comparison.marketVolatility.toFixed(2)}%</span></span>
                    <span>Spot Price: <span className="font-semibold">${comparison.spotPrice.toFixed(2)}/oz</span></span>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {comparison.mechanisms.map((mechanism) => {
              const isRecommended = mechanism.mechanism === comparison.recommendedMechanism;
              const isSelected = mechanism.mechanism === selectedMechanism;

              return (
                <Card
                  key={mechanism.mechanism}
                  className={`cursor-pointer transition-all ${
                    isSelected
                      ? 'ring-2 ring-blue-500 shadow-lg'
                      : isRecommended
                      ? 'ring-2 ring-emerald-500 shadow-md'
                      : 'hover:shadow-md'
                  }`}
                  onClick={() => handleSelectMechanism(mechanism)}
                >
                  <div className="p-5 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {getMechanismIcon(mechanism.mechanism)}
                        <div>
                          <h4 className="font-semibold text-gray-900">{mechanism.displayName}</h4>
                          <p className="text-xs text-gray-500 mt-0.5">{mechanism.settlementDays} days</p>
                        </div>
                      </div>
                      {getMechanismBadge(mechanism.mechanism, isRecommended)}
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-baseline">
                        <span className="text-sm text-gray-600">Price per oz:</span>
                        <span className="text-lg font-bold text-gray-900">
                          ${mechanism.pricePerOz.toFixed(2)}
                        </span>
                      </div>

                      {mechanism.adjustmentPercentage !== 0 && (
                        <div className="flex justify-between items-baseline">
                          <span className="text-xs text-gray-500">Adjustment:</span>
                          <span className={`text-sm font-semibold ${
                            mechanism.adjustmentPercentage > 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {mechanism.adjustmentPercentage > 0 ? '+' : ''}{mechanism.adjustmentPercentage.toFixed(3)}%
                          </span>
                        </div>
                      )}

                      <div className="border-t border-gray-200 pt-2 mt-2">
                        <div className="flex justify-between items-baseline">
                          <span className="text-sm font-semibold text-gray-700">Total Value:</span>
                          <span className="text-xl font-bold text-gray-900">
                            ${mechanism.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>

                      {mechanism.benefit !== 0 && (
                        <div className={`text-center py-2 px-3 rounded text-sm font-semibold ${
                          mechanism.benefit > 0
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {mechanism.benefit > 0 ? '+' : ''}${Math.abs(mechanism.benefit).toFixed(2)} vs Spot
                        </div>
                      )}

                      <div className="text-xs text-gray-500 pt-2 border-t border-gray-100">
                        <div className="flex justify-between">
                          <span>Value Date:</span>
                          <span className="font-medium">{new Date(mechanism.valueDate).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-gray-600 border-t border-gray-100 pt-3">
                      {mechanism.description}
                    </p>

                    {isSelected && (
                      <div className="pt-2">
                        <Button className="w-full" size="sm">
                          Continue with {mechanism.displayName}
                        </Button>
                      </div>
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
                <p className="font-semibold mb-1">Important Notes:</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>Spot Basis: Settlement within 2 business days during NY trading hours (7:30 AM - 4:30 PM EST)</li>
                  <li>Forward Basis: Requires buyer consent, adjustments based on current forward rates</li>
                  <li>In-Process Basis: Pricing during refining, subject to 7-day notice requirement</li>
                  <li>All prices are subject to final approval and market conditions</li>
                </ul>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
