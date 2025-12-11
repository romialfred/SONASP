import { supabase } from '@/lib/supabase';
import { getCurrentGoldPrice, getGoldPriceTrend } from './goldPriceService';

export interface PricingMechanism {
  mechanism: 'spot' | 'forward_14d' | 'forward_30d' | 'in_process';
  displayName: string;
  pricePerOz: number;
  totalValue: number;
  adjustment: number;
  adjustmentPercentage: number;
  benefit: number;
  valueDate: string;
  description: string;
  settlementDays: number;
}

export interface PricingComparison {
  quantityOz: number;
  spotPrice: number;
  mechanisms: PricingMechanism[];
  recommendedMechanism: string;
  recommendationReason: string;
  goldTrend: 'bullish' | 'bearish' | 'neutral';
  marketVolatility: number;
}

export interface ForwardRate {
  id: string;
  forward_days: number;
  adjustment_rate_percentage: number;
  is_premium: boolean;
}

export interface QuantityRecommendation {
  recommendedQuantityOz: number;
  recommendedPercentage: number;
  reasoning: string;
  confidenceScore: number;
  optimalTiming: string;
  riskLevel: 'low' | 'medium' | 'high';
}

export async function getForwardRates(): Promise<{
  success: boolean;
  data?: ForwardRate[];
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from('forward_rates')
      .select('*')
      .eq('rate_date', new Date().toISOString().split('T')[0])
      .eq('is_active', true)
      .order('forward_days', { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data || [] };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function calculatePricingComparison(
  quantityOz: number
): Promise<{
  success: boolean;
  data?: PricingComparison;
  error?: string;
}> {
  try {
    const [goldPriceResult, forwardRatesResult, trendResult] = await Promise.all([
      getCurrentGoldPrice(),
      getForwardRates(),
      getGoldPriceTrend(30),
    ]);

    if (!goldPriceResult.success || !goldPriceResult.data) {
      return { success: false, error: 'Unable to fetch current gold price' };
    }

    if (!forwardRatesResult.success || !forwardRatesResult.data) {
      return { success: false, error: 'Unable to fetch forward rates' };
    }

    const spotPrice = goldPriceResult.data.london_am_rate;
    const forwardRates = forwardRatesResult.data;
    const trend = trendResult.data?.trend || 'neutral';
    const volatility = trendResult.data?.volatility || 10;

    const mechanisms: PricingMechanism[] = [];

    const spotValueDate = new Date();
    spotValueDate.setDate(spotValueDate.getDate() + 2);

    mechanisms.push({
      mechanism: 'spot',
      displayName: 'Spot Basis',
      pricePerOz: spotPrice,
      totalValue: spotPrice * quantityOz,
      adjustment: 0,
      adjustmentPercentage: 0,
      benefit: 0,
      valueDate: spotValueDate.toISOString().split('T')[0],
      description: 'Payment and delivery within 2 business days',
      settlementDays: 2,
    });

    const forwardDays = [14, 30];
    forwardDays.forEach((days) => {
      const forwardRate = forwardRates.find((fr) => fr.forward_days === days);
      const adjustmentPercentage = forwardRate?.adjustment_rate_percentage || (0.02 * days) / 7;

      const adjustmentAmount = spotPrice * (adjustmentPercentage / 100);
      const forwardPrice = spotPrice + (forwardRate?.is_premium ? adjustmentAmount : -adjustmentAmount);
      const totalValue = forwardPrice * quantityOz;
      const benefit = totalValue - spotPrice * quantityOz;

      const valueDate = new Date();
      valueDate.setDate(valueDate.getDate() + days);

      mechanisms.push({
        mechanism: `forward_${days}d` as any,
        displayName: `Forward ${days} Days`,
        pricePerOz: forwardPrice,
        totalValue,
        adjustment: adjustmentAmount,
        adjustmentPercentage,
        benefit,
        valueDate: valueDate.toISOString().split('T')[0],
        description: `Pricing up to ${days} days forward with market adjustment`,
        settlementDays: days,
      });
    });

    const inProcessPrice = spotPrice * 0.995;
    const inProcessTotal = inProcessPrice * quantityOz;
    const inProcessValueDate = new Date();
    inProcessValueDate.setDate(inProcessValueDate.getDate() + 7);

    mechanisms.push({
      mechanism: 'in_process',
      displayName: 'In-Process Basis',
      pricePerOz: inProcessPrice,
      totalValue: inProcessTotal,
      adjustment: -(spotPrice - inProcessPrice),
      adjustmentPercentage: -0.5,
      benefit: inProcessTotal - spotPrice * quantityOz,
      valueDate: inProcessValueDate.toISOString().split('T')[0],
      description: 'Priced during refining process with slight discount',
      settlementDays: 7,
    });

    const recommendedMechanism = determineRecommendedMechanism(mechanisms, trend, volatility);

    const comparison: PricingComparison = {
      quantityOz,
      spotPrice,
      mechanisms,
      recommendedMechanism: recommendedMechanism.mechanism,
      recommendationReason: recommendedMechanism.reason,
      goldTrend: trend,
      marketVolatility: volatility,
    };

    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (userId) {
      await supabase.from('pricing_mechanism_comparisons').insert({
        user_id: userId,
        quantity_oz: quantityOz,
        spot_price_per_oz: spotPrice,
        spot_total_value: mechanisms[0].totalValue,
        spot_value_date: mechanisms[0].valueDate,
        forward_7d_total_value: null,
        forward_7d_adjustment: null,
        forward_7d_benefit: null,
        forward_14d_total_value: mechanisms[1].totalValue,
        forward_14d_adjustment: mechanisms[1].adjustmentPercentage,
        forward_14d_benefit: mechanisms[1].benefit,
        forward_30d_total_value: mechanisms[2].totalValue,
        forward_30d_adjustment: mechanisms[2].adjustmentPercentage,
        forward_30d_benefit: mechanisms[2].benefit,
        in_process_estimated_value: mechanisms[3].totalValue,
        in_process_benefit: mechanisms[3].benefit,
        recommended_mechanism: recommendedMechanism.mechanism,
        recommendation_reason: recommendedMechanism.reason,
        gold_trend: trend,
        market_volatility: volatility,
      });
    }

    return { success: true, data: comparison };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

function determineRecommendedMechanism(
  mechanisms: PricingMechanism[],
  trend: 'bullish' | 'bearish' | 'neutral',
  volatility: number
): { mechanism: string; reason: string } {
  if (trend === 'bullish') {
    return {
      mechanism: 'spot',
      reason: 'Market is bullish. Selling now captures current high prices. Further increases are expected but not guaranteed.',
    };
  }

  if (trend === 'bearish') {
    const forward30d = mechanisms.find((m) => m.mechanism === 'forward_30d');
    if (forward30d && forward30d.benefit > 0) {
      return {
        mechanism: 'forward_30d',
        reason: 'Market is bearish. Locking in forward pricing protects against potential price drops. The premium compensates for the wait.',
      };
    }
  }

  if (volatility > 15) {
    return {
      mechanism: 'forward_14d',
      reason: 'High market volatility detected. Medium-term forward contract balances risk and opportunity, providing price stability.',
    };
  }

  const bestMechanism = mechanisms.reduce((best, current) => {
    return current.benefit > best.benefit ? current : best;
  });

  return {
    mechanism: bestMechanism.mechanism,
    reason: `Based on current market conditions (${trend} trend, ${volatility.toFixed(1)}% volatility), this mechanism offers the best financial outcome (+$${bestMechanism.benefit.toFixed(2)}).`,
  };
}

export async function getQuantityRecommendation(
  availableStockOz: number
): Promise<{
  success: boolean;
  data?: QuantityRecommendation;
  error?: string;
}> {
  try {
    const [trendResult, goldPriceResult] = await Promise.all([
      getGoldPriceTrend(30),
      getCurrentGoldPrice(),
    ]);

    if (!trendResult.success || !goldPriceResult.success) {
      return { success: false, error: 'Unable to fetch market data for recommendation' };
    }

    const { trend, volatility, avg_price } = trendResult.data!;
    const currentPrice = goldPriceResult.data!.london_am_rate;

    let recommendedPercentage = 50;
    let reasoning = '';
    let riskLevel: 'low' | 'medium' | 'high' = 'medium';
    let confidenceScore = 70;
    let optimalTiming = 'Now';

    if (trend === 'bullish') {
      if (currentPrice > avg_price * 1.03) {
        recommendedPercentage = 70;
        reasoning = 'Strong bullish trend with price 3%+ above 30-day average. High confidence to sell significant portion now to capture gains. Keep 30% for potential further upside.';
        riskLevel = 'low';
        confidenceScore = 85;
        optimalTiming = 'Immediate - within 24-48 hours';
      } else {
        recommendedPercentage = 40;
        reasoning = 'Bullish trend but price near average. Moderate selling recommended. Hold majority for continued upward movement.';
        riskLevel = 'medium';
        confidenceScore = 65;
        optimalTiming = 'Within 3-5 days';
      }
    } else if (trend === 'bearish') {
      if (volatility > 15) {
        recommendedPercentage = 30;
        reasoning = 'Bearish trend with high volatility. Conservative approach recommended. Consider forward contracts to lock in better pricing. Wait for market stabilization.';
        riskLevel = 'high';
        confidenceScore = 60;
        optimalTiming = 'Wait 7-10 days or use forward contracts';
      } else {
        recommendedPercentage = 45;
        reasoning = 'Moderate bearish trend with stable volatility. Balanced selling strategy. Use forward pricing to mitigate downside risk.';
        riskLevel = 'medium';
        confidenceScore = 70;
        optimalTiming = 'Within 5-7 days, prefer forward contracts';
      }
    } else {
      recommendedPercentage = 50;
      reasoning = 'Neutral market conditions. Standard 50% allocation provides balanced exposure. Monitor for trend development before committing remaining stock.';
      riskLevel = 'low';
      confidenceScore = 75;
      optimalTiming = 'Flexible - next 7 days';
    }

    const recommendedQuantityOz = (availableStockOz * recommendedPercentage) / 100;

    const recommendation: QuantityRecommendation = {
      recommendedQuantityOz,
      recommendedPercentage,
      reasoning,
      confidenceScore,
      optimalTiming,
      riskLevel,
    };

    await supabase.from('sale_quantity_recommendations').insert({
      available_stock_oz: availableStockOz,
      current_price_per_oz: currentPrice,
      gold_trend: trend,
      trend_strength: Math.abs((currentPrice - avg_price) / avg_price) * 100,
      price_volatility: volatility,
      avg_price_30d: avg_price,
      recommended_quantity_oz: recommendedQuantityOz,
      recommended_percentage: recommendedPercentage,
      reasoning,
      confidence_score: confidenceScore,
      optimal_timing: optimalTiming,
      risk_level: riskLevel,
    });

    return { success: true, data: recommendation };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getApprovedRefineries(): Promise<{
  success: boolean;
  data?: Array<{
    id: string;
    refinery_name: string;
    refinery_location: string;
    average_processing_days: number;
    max_monthly_capacity_oz: number;
  }>;
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from('refineries_approved')
      .select('id, refinery_name, refinery_location, average_processing_days, max_monthly_capacity_oz')
      .eq('is_approved', true)
      .order('refinery_name');

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data || [] };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createGoldSale(saleData: {
  customerId: string;
  quantityOz: number;
  pricingMechanism: 'spot' | 'forward' | 'in_process';
  forwardDays?: number;
  refineryId?: string;
  batchId?: string;
}): Promise<{
  success: boolean;
  data?: { saleId: string };
  error?: string;
}> {
  try {
    const comparisonResult = await calculatePricingComparison(saleData.quantityOz);

    if (!comparisonResult.success || !comparisonResult.data) {
      return { success: false, error: 'Unable to calculate pricing' };
    }

    const selectedMechanism = comparisonResult.data.mechanisms.find((m) => {
      if (saleData.pricingMechanism === 'spot') return m.mechanism === 'spot';
      if (saleData.pricingMechanism === 'forward') return m.mechanism === `forward_${saleData.forwardDays}d`;
      if (saleData.pricingMechanism === 'in_process') return m.mechanism === 'in_process';
      return false;
    });

    if (!selectedMechanism) {
      return { success: false, error: 'Invalid pricing mechanism' };
    }

    const saleNumber = `GS-${Date.now()}`;

    const saleInsertData: any = {
      sale_number: saleNumber,
      customer_id: saleData.customerId,
      quantity_oz: saleData.quantityOz,
      london_am_rate: comparisonResult.data.spotPrice,
      final_price_per_oz: selectedMechanism.pricePerOz,
      final_proceeds: selectedMechanism.totalValue,
      pricing_mechanism: saleData.pricingMechanism,
      currency: 'USD',
      status: 'pending_approval',
    };

    if (saleData.pricingMechanism === 'spot') {
      saleInsertData.spot_pricing_date = new Date().toISOString();
      saleInsertData.spot_value_date = selectedMechanism.valueDate;
    } else if (saleData.pricingMechanism === 'forward') {
      saleInsertData.forward_days = saleData.forwardDays;
      saleInsertData.forward_rate_adjustment = selectedMechanism.adjustmentPercentage;
      saleInsertData.forward_value_date = selectedMechanism.valueDate;
      saleInsertData.spot_pricing_date = new Date().toISOString();
    } else if (saleData.pricingMechanism === 'in_process') {
      saleInsertData.in_process_refinery_id = saleData.refineryId;
      saleInsertData.in_process_batch_id = saleData.batchId;
    }

    const { data: saleResult, error: saleError } = await supabase
      .from('sales')
      .insert(saleInsertData)
      .select('id')
      .single();

    if (saleError) {
      return { success: false, error: saleError.message };
    }

    await supabase.from('sale_pricing_details').insert({
      sale_id: saleResult.id,
      mechanism: saleData.pricingMechanism,
      base_spot_price: comparisonResult.data.spotPrice,
      forward_adjustment: selectedMechanism.adjustment,
      forward_adjustment_percentage: selectedMechanism.adjustmentPercentage,
      final_price_per_oz: selectedMechanism.pricePerOz,
      total_value_usd: selectedMechanism.totalValue,
      market_conditions: `${comparisonResult.data.goldTrend} trend, volatility: ${comparisonResult.data.marketVolatility.toFixed(2)}`,
    });

    return { success: true, data: { saleId: saleResult.id } };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export function calculateFinancialBenefit(
  mechanisms: PricingMechanism[],
  baselineMechanism: 'spot' = 'spot'
): Array<{
  mechanism: string;
  displayName: string;
  absoluteBenefit: number;
  percentageBenefit: number;
  isRecommended: boolean;
}> {
  const baseline = mechanisms.find((m) => m.mechanism === baselineMechanism);
  if (!baseline) return [];

  return mechanisms.map((m) => ({
    mechanism: m.mechanism,
    displayName: m.displayName,
    absoluteBenefit: m.totalValue - baseline.totalValue,
    percentageBenefit: ((m.totalValue - baseline.totalValue) / baseline.totalValue) * 100,
    isRecommended: false,
  }));
}
