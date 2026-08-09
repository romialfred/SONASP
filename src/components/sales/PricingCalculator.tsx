import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { CustomAlert } from '@/components/ui/CustomAlert';
import { Calendar, TrendingUp, Clock, Factory, DollarSign, AlertCircle } from 'lucide-react';
import { calculatePricingComparison, type PricingComparison, type PricingMechanism } from '@/services/goldTradeSpaceService';
import { useCustomAlert } from '@/hooks/useCustomAlert';

interface PricingCalculatorProps {
  availableStockOz: number;
  miningCompanyId?: string;
  onMechanismSelect?: (mechanism: PricingMechanism, comparison: PricingComparison) => void;
}

export function PricingCalculator({ availableStockOz, miningCompanyId, onMechanismSelect }: PricingCalculatorProps) {
  const navigate = useNavigate();
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
      setQuantityOz(unit === 'oz' ? availableStockOz.toFixed(2) : (availableStockOz * GRAMS_PER_OZ).toFixed(2));
    }
  }, [availableStockOz, unit]);

  const getQuantityInOz = (): number => {
    const qty = parseFloat(quantityOz);
    if (isNaN(qty)) return 0;
    return unit === 'oz' ? qty : qty / GRAMS_PER_OZ;
  };

  const getDisplayQuantity = (oz: number): string => {
    return unit === 'oz' ? oz.toFixed(2) : (oz * GRAMS_PER_OZ).toFixed(2);
  };

  const handleCalculate = async () => {
    console.log('🔵 [SIMULATE] Button clicked - Starting calculation');
    console.log('🔵 [SIMULATE] Available stock:', availableStockOz);
    console.log('🔵 [SIMULATE] Quantity input:', quantityOz);

    const qtyInOz = getQuantityInOz();
    console.log('🔵 [SIMULATE] Calculated quantity in oz:', qtyInOz);

    // Add tolerance for floating point comparison (0.01 oz = ~0.31 grams tolerance)
    const tolerance = 0.01;

    if (isNaN(qtyInOz) || qtyInOz <= 0) {
      console.error('❌ [SIMULATE] Invalid quantity', {
        qtyInOz,
        isNaN: isNaN(qtyInOz),
        isZeroOrNegative: qtyInOz <= 0
      });
      showError(
        'The quantity entered is invalid. Please ensure you have entered a valid positive number.',
        'Invalid Quantity'
      );
      return;
    }

    if (qtyInOz > (availableStockOz + tolerance)) {
      console.error('❌ [SIMULATE] Quantity exceeds stock', {
        qtyInOz,
        availableStockOz,
        difference: qtyInOz - availableStockOz
      });
      showError(
        `The quantity entered (${qtyInOz.toFixed(2)} oz) exceeds available stock (${availableStockOz.toFixed(2)} oz).`,
        'Insufficient Stock'
      );
      return;
    }

    console.log('✅ [SIMULATE] Quantity validation passed');
    setLoading(true);
    console.log('🔵 [SIMULATE] Loading state set to true');

    try {
      console.log('🔵 [SIMULATE] Calling calculatePricingComparison...');
      const startTime = Date.now();

      const result = await calculatePricingComparison(qtyInOz);

      const duration = Date.now() - startTime;
      console.log(`🔵 [SIMULATE] API call completed in ${duration}ms`);
      console.log('🔵 [SIMULATE] Result:', {
        success: result.success,
        hasData: !!result.data,
        error: result.error
      });

      if (result.success && result.data) {
        console.log('✅ [SIMULATE] Calculation successful');
        console.log('🔵 [SIMULATE] Mechanisms count:', result.data.mechanisms?.length);
        console.log('🔵 [SIMULATE] Recommended mechanism:', result.data.recommendedMechanism);

        // Sort mechanisms by benefit (highest to lowest)
        const sortedMechanisms = [...result.data.mechanisms].sort((a, b) => b.benefit - a.benefit);
        console.log('✅ [SIMULATE] Mechanisms sorted');

        setComparison({
          ...result.data,
          mechanisms: sortedMechanisms
        });
        setSelectedMechanism(result.data.recommendedMechanism);
        console.log('✅ [SIMULATE] State updated - Display should show');
      } else {
        console.error('❌ [SIMULATE] Calculation failed:', result.error);
        console.error('❌ [SIMULATE] Full result object:', JSON.stringify(result, null, 2));

        showError(
          `Unable to calculate pricing: ${result.error || 'Unknown error'}\n\n` +
          `This may be caused by missing gold price data. Please contact your administrator.`,
          'Calculation Error'
        );
      }
    } catch (error: any) {
      console.error('❌ [SIMULATE] Exception caught:', error);
      console.error('❌ [SIMULATE] Error stack:', error?.stack);
      console.error('❌ [SIMULATE] Error name:', error?.name);
      console.error('❌ [SIMULATE] Error message:', error?.message);

      showError(
        `An unexpected error occurred: ${error?.message || 'Unknown error'}\n\n` +
        `Please check the console for details or contact support.`,
        'Unexpected Error'
      );
    } finally {
      setLoading(false);
      console.log('🔵 [SIMULATE] Loading state set to false');
      console.log('🔵 [SIMULATE] Calculation complete');
    }
  };

  const handleSelectMechanism = (mechanism: PricingMechanism) => {
    setSelectedMechanism(mechanism.mechanism);
    if (onMechanismSelect && comparison) {
      onMechanismSelect(mechanism, comparison);
    }
  };

  const handleContinueWithMechanism = (mechanism: PricingMechanism) => {
    // Navigate to sale creation with mechanism data
    navigate('/sales/new', {
      state: {
        mechanismData: mechanism,
        quantityOz: getQuantityInOz(),
        availableStockOz,
        preselectedSellerId: miningCompanyId,
        lockSeller: true
      }
    });
  };

  const getMechanismIcon = (mechanism: string) => {
    if (mechanism === 'spot') return <Clock className="w-5 h-5" />;
    if (mechanism.includes('forward')) return <Calendar className="w-5 h-5" />;
    if (mechanism === 'in_process') return <Factory className="w-5 h-5" />;
    return <DollarSign className="w-5 h-5" />;
  };

  const getMechanismBadge = (index: number, totalMechanisms: number, isRecommended: boolean) => {
    if (index === 0) {
      return (
        <span className="px-2 py-1 text-xs font-semibold bg-emerald-100 text-emerald-800 rounded">
          Best Option
        </span>
      );
    }
    return null;
  };

  const getCardBackgroundColor = (index: number, totalMechanisms: number) => {
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
            <h3 className="text-lg font-semibold text-gray-900">Pricing Calculator</h3>
            <div className="text-sm text-gray-500">
              Available: <span className="font-semibold text-gray-900">{availableStockOz.toFixed(2)} oz</span>
              <span className="text-gray-400"> ({(availableStockOz * GRAMS_PER_OZ).toFixed(2)} g)</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quantity to Sell - 100% of Available Stock ({unit === 'oz' ? 'oz' : 'grams'})
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
                    setQuantityOz(newUnit === 'oz' ? availableStockOz.toFixed(2) : (availableStockOz * GRAMS_PER_OZ).toFixed(2));
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
                  <strong>Policy:</strong> All mines must sell 100% of their available stock. Partial sales are not permitted.
                </p>
              </div>
              {quantityOz && getQuantityInOz() > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  = {unit === 'oz' ? `${(getQuantityInOz() * GRAMS_PER_OZ).toFixed(2)} grams` : `${getQuantityInOz().toFixed(2)} oz`}
                </p>
              )}
            </div>

            <div className="flex items-end">
              <Button
                onClick={handleCalculate}
                disabled={loading || !quantityOz || getQuantityInOz() <= 0}
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

          <div className="grid grid-cols-4 gap-3">
            {comparison.mechanisms.map((mechanism, index) => {
              const isRecommended = mechanism.mechanism === comparison.recommendedMechanism;
              const isSelected = mechanism.mechanism === selectedMechanism;
              const isBestOption = index === 0;
              const bgColor = getCardBackgroundColor(index, comparison.mechanisms.length);

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
                          <p className="text-xs text-gray-500">{mechanism.settlementDays} days</p>
                        </div>
                      </div>
                      {getMechanismBadge(index, comparison.mechanisms.length, isRecommended)}
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between items-baseline">
                        <span className="text-xs text-gray-600">Price per oz:</span>
                        <span className="text-base font-bold text-gray-900">
                          ${mechanism.pricePerOz.toFixed(2)}
                        </span>
                      </div>

                      {mechanism.adjustmentPercentage !== 0 && (
                        <div className="flex justify-between items-baseline">
                          <span className="text-xs text-gray-500">Adjustment:</span>
                          <span className={`text-xs font-semibold ${
                            mechanism.adjustmentPercentage > 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {mechanism.adjustmentPercentage > 0 ? '+' : ''}{mechanism.adjustmentPercentage.toFixed(3)}%
                          </span>
                        </div>
                      )}

                      <div className="border-t border-gray-200 pt-1.5 mt-1.5">
                        <div className="flex justify-between items-baseline">
                          <span className="text-xs font-semibold text-gray-700">Total Value:</span>
                          <span className="text-base font-bold text-gray-900">
                            ${mechanism.totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>

                      {mechanism.benefit !== 0 && (
                        <div className={`text-center py-1 px-2 rounded text-xs font-semibold ${
                          mechanism.benefit > 0
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {mechanism.benefit > 0 ? '+' : ''}${Math.abs(mechanism.benefit).toFixed(2)} vs Spot
                        </div>
                      )}

                      <div className="text-xs text-gray-500 pt-1 border-t border-gray-100">
                        <div className="flex justify-between">
                          <span>Value Date:</span>
                          <span className="font-medium">{new Date(mechanism.valueDate).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-gray-600 border-t border-gray-100 pt-2 line-clamp-2">
                      {mechanism.description}
                    </p>

                    {isSelected && (
                      <div className="pt-1">
                        <Button
                          className="w-full"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleContinueWithMechanism(mechanism);
                          }}
                        >
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
