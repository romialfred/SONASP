import { supabase } from '@/lib/supabase';

export interface FxAnalysisResult {
  transactionDate: string;
  customerName: string;
  customerId: string;
  usdPaid: number;
  customerRate: number;
  eurReceived: number;
  ecbSpotRate: number;
  revolutRate: number;

  // Calculations
  eurIfEcb: number;
  eurIfRevolut: number;
  diffVsEcb: number;
  diffVsRevolut: number;
  spreadVsEcb: number;
  spreadVsRevolut: number;

  // Best option
  bestRate: number;
  bestSource: 'customer' | 'ecb' | 'revolut';
  opportunityCost: number;

  // Auto-generated commentary
  commentary: string;
  recommendation: string;
}

export const analyzeFxTransaction = async (
  customerId: string,
  startDate: string,
  endDate: string
): Promise<{ success: boolean; data: FxAnalysisResult[]; error?: any }> => {
  try {
    // Get customer transactions
    const { data: transactions, error: txError } = await supabase
      .from('customer_fx_rates')
      .select(`
        *,
        customers!inner(name)
      `)
      .eq('customer_id', customerId)
      .eq('currency_pair', 'EUR/USD')
      .gte('transaction_date', startDate)
      .lte('transaction_date', endDate)
      .order('transaction_date', { ascending: true });

    if (txError) throw txError;

    if (!transactions || transactions.length === 0) {
      return { success: true, data: [] };
    }

    const { data: sources } = await supabase
      .from('fx_rate_sources')
      .select('id, code')
      .in('code', ['ECB', 'REVOLUT']);

    const ecbSourceId = sources?.find(s => s.code === 'ECB')?.id;
    const revolutSourceId = sources?.find(s => s.code === 'REVOLUT')?.id;

    const analysisResults: FxAnalysisResult[] = [];

    for (const tx of transactions) {
      // Get ECB and Revolut rates for this date
      const { data: rates } = await supabase
        .from('fx_rates_daily')
        .select('*')
        .eq('rate_date', tx.transaction_date)
        .eq('currency_pair', 'EUR/USD')
        .in('source_id', [ecbSourceId, revolutSourceId]);

      const ecbRate = rates?.find(r => r.source_id === ecbSourceId);
      const revolutRate = rates?.find(r => r.source_id === revolutSourceId);

      if (!ecbRate || !revolutRate) continue;

      // Since we're converting USD to EUR, we need the inverse (EUR/USD means 1 EUR = X USD)
      // To convert USD to EUR: EUR = USD * (EUR/USD rate)
      const usdPaid = tx.amount;
      const customerRate = tx.rate_paid;
      const eurReceived = usdPaid * customerRate;

      const ecbSpotRate = ecbRate.rate;
      const revolutSpotRate = revolutRate.rate;

      const eurIfEcb = usdPaid * ecbSpotRate;
      const eurIfRevolut = usdPaid * revolutSpotRate;

      const diffVsEcb = eurReceived - eurIfEcb;
      const diffVsRevolut = eurReceived - eurIfRevolut;

      const spreadVsEcb = ((customerRate - ecbSpotRate) / ecbSpotRate) * 100;
      const spreadVsRevolut = ((customerRate - revolutSpotRate) / revolutSpotRate) * 100;

      // Determine best option
      const options = [
        { name: 'customer', rate: customerRate, eur: eurReceived },
        { name: 'ecb', rate: ecbSpotRate, eur: eurIfEcb },
        { name: 'revolut', rate: revolutSpotRate, eur: eurIfRevolut },
      ];

      const bestOption = options.reduce((best, current) =>
        current.eur > best.eur ? current : best
      );

      const opportunityCost = bestOption.eur - eurReceived;

      // Generate commentary
      const commentary = generateCommentary({
        customerRate,
        ecbSpotRate,
        revolutSpotRate,
        diffVsEcb,
        diffVsRevolut,
        spreadVsEcb,
        spreadVsRevolut,
        customerName: tx.customers.name,
      });

      // Generate recommendation
      const recommendation = generateRecommendation({
        bestSource: bestOption.name as any,
        opportunityCost,
        customerRate,
        ecbSpotRate,
        revolutSpotRate,
        diffVsEcb,
        diffVsRevolut,
        customerName: tx.customers.name,
      });

      analysisResults.push({
        transactionDate: tx.transaction_date,
        customerName: tx.customers.name,
        customerId: tx.customer_id,
        usdPaid,
        customerRate,
        eurReceived,
        ecbSpotRate,
        revolutRate: revolutSpotRate,
        eurIfEcb,
        eurIfRevolut,
        diffVsEcb,
        diffVsRevolut,
        spreadVsEcb,
        spreadVsRevolut,
        bestRate: bestOption.rate,
        bestSource: bestOption.name as any,
        opportunityCost,
        commentary,
        recommendation,
      });
    }

    return { success: true, data: analysisResults };
  } catch (error) {
    console.error('Error analyzing FX transactions:', error);
    return { success: false, data: [], error };
  }
};

interface CommentaryParams {
  customerRate: number;
  ecbSpotRate: number;
  revolutSpotRate: number;
  diffVsEcb: number;
  diffVsRevolut: number;
  spreadVsEcb: number;
  spreadVsRevolut: number;
  customerName: string;
}

const generateCommentary = (params: CommentaryParams): string => {
  const {
    customerRate,
    ecbSpotRate,
    revolutSpotRate,
    diffVsEcb,
    diffVsRevolut,
    spreadVsEcb,
    spreadVsRevolut,
    customerName,
  } = params;

  let commentary = '';

  // Compare customer rate with ECB
  if (Math.abs(spreadVsEcb) < 0.05) {
    commentary += `${customerName} rate ${customerRate.toFixed(4)} EUR/USD is essentially equal to ECB spot rate ${ecbSpotRate.toFixed(4)} (difference < 0.05%). `;
  } else if (diffVsEcb > 0) {
    commentary += `${customerName} rate ${customerRate.toFixed(4)} EUR/USD is BETTER than ECB spot ${ecbSpotRate.toFixed(4)} by ${Math.abs(spreadVsEcb).toFixed(3)}%. We received €${Math.abs(diffVsEcb).toFixed(2)} MORE. `;
  } else {
    commentary += `${customerName} rate ${customerRate.toFixed(4)} EUR/USD is WORSE than ECB spot ${ecbSpotRate.toFixed(4)} by ${Math.abs(spreadVsEcb).toFixed(3)}%. We received €${Math.abs(diffVsEcb).toFixed(2)} LESS. `;
  }

  // Compare customer rate with Revolut
  if (Math.abs(spreadVsRevolut) < 0.05) {
    commentary += `\n${customerName} rate is similar to Revolut ${revolutSpotRate.toFixed(4)} (difference < 0.05%). `;
  } else if (diffVsRevolut > 0) {
    commentary += `\n${customerName} rate is BETTER than Revolut ${revolutSpotRate.toFixed(4)} by ${Math.abs(spreadVsRevolut).toFixed(3)}%. We received €${Math.abs(diffVsRevolut).toFixed(2)} MORE than if using Revolut. `;
  } else {
    commentary += `\n${customerName} rate is WORSE than Revolut ${revolutSpotRate.toFixed(4)} by ${Math.abs(spreadVsRevolut).toFixed(3)}%. We would have received €${Math.abs(diffVsRevolut).toFixed(2)} MORE using Revolut. `;
  }

  // Compare ECB vs Revolut
  const ecbVsRevolut = ecbSpotRate - revolutSpotRate;
  const spreadEcbRevolut = ((ecbSpotRate - revolutSpotRate) / revolutSpotRate) * 100;

  if (Math.abs(spreadEcbRevolut) < 0.05) {
    commentary += `\nECB and Revolut rates are nearly identical for this date.`;
  } else if (ecbVsRevolut > 0) {
    commentary += `\nECB spot was ${Math.abs(spreadEcbRevolut).toFixed(3)}% better than Revolut on this date.`;
  } else {
    commentary += `\nRevolut rate was ${Math.abs(spreadEcbRevolut).toFixed(3)}% better than ECB spot on this date.`;
  }

  return commentary.trim();
};

interface RecommendationParams {
  bestSource: 'customer' | 'ecb' | 'revolut';
  opportunityCost: number;
  customerRate: number;
  ecbSpotRate: number;
  revolutSpotRate: number;
  diffVsEcb: number;
  diffVsRevolut: number;
  customerName: string;
}

const generateRecommendation = (params: RecommendationParams): string => {
  const {
    bestSource,
    opportunityCost,
    customerRate,
    ecbSpotRate,
    revolutSpotRate,
    diffVsEcb,
    diffVsRevolut,
    customerName,
  } = params;

  let recommendation = '';

  if (bestSource === 'customer') {
    // Customer gave us the best rate
    if (opportunityCost < 100) {
      recommendation = `✅ EXCELLENT: Continue working with ${customerName}. Their rate is optimal and the best available option for this transaction. The difference vs alternatives is negligible (< €100).`;
    } else if (opportunityCost < 1000) {
      recommendation = `✅ GOOD: ${customerName} provided a competitive rate. While ECB or Revolut might have been slightly better (€${opportunityCost.toFixed(2)}), the difference is minimal. Maintain the relationship.`;
    } else {
      recommendation = `✅ FAVORABLE: ${customerName}'s rate was the best option. This relationship is beneficial. Continue monitoring market rates to ensure continued competitiveness.`;
    }
  } else if (bestSource === 'ecb') {
    // ECB would have been better
    const lostAmount = Math.abs(diffVsEcb);

    if (lostAmount < 1000) {
      recommendation = `⚠️ MINOR LOSS: Using ECB spot rate would have yielded €${lostAmount.toFixed(2)} more. However, this is acceptable given transaction costs and relationship value with ${customerName}.`;
    } else if (lostAmount < 5000) {
      recommendation = `⚠️ MODERATE LOSS: ECB spot rate would have saved €${lostAmount.toFixed(2)}. Consider negotiating with ${customerName} for rates closer to ECB spot, or explore direct ECB-based settlement options for larger transactions.`;
    } else {
      recommendation = `🚨 SIGNIFICANT LOSS: Using ECB spot rate would have saved €${lostAmount.toFixed(2)}. RECOMMENDATION: For transactions of this size, strongly consider:\n1. Renegotiating terms with ${customerName} to align closer to ECB spot\n2. Using alternative settlement methods with ECB-based rates\n3. Hedging future transactions\n4. Setting maximum spread thresholds in contracts`;
    }
  } else {
    // Revolut would have been better
    const lostAmount = Math.abs(diffVsRevolut);

    if (lostAmount < 1000) {
      recommendation = `⚠️ MINOR OPPORTUNITY: Revolut rate would have yielded €${lostAmount.toFixed(2)} more. This is acceptable, but consider Revolut Business for future transactions if volumes increase.`;
    } else if (lostAmount < 5000) {
      recommendation = `⚠️ MODERATE OPPORTUNITY: Revolut would have saved €${lostAmount.toFixed(2)}. Consider:\n1. Opening a Revolut Business account for FX transactions\n2. Using Revolut for larger payments where spreads matter\n3. Negotiating with ${customerName} to match Revolut rates`;
    } else {
      recommendation = `🚨 SIGNIFICANT OPPORTUNITY LOSS: Revolut would have saved €${lostAmount.toFixed(2)}. URGENT RECOMMENDATION:\n1. Immediately open Revolut Business account if not already active\n2. Use Revolut for all large FX transactions (> $1M)\n3. Renegotiate terms with ${customerName} - current spread is not competitive\n4. Set up automated rate comparison before accepting payments`;
    }
  }

  // Add forward-looking guidance
  recommendation += `\n\n📊 ONGOING STRATEGY: Monitor ECB and Revolut rates daily. For transactions > $500K, always compare rates before accepting payment terms. Aim to keep spread within 0.1% (10 basis points) of best available market rate.`;

  return recommendation;
};

export const compareFxRates = async (
  date: string
): Promise<{ success: boolean; data: any; error?: any }> => {
  try {
    const { data: sources } = await supabase
      .from('fx_rate_sources')
      .select('id, code, name')
      .in('code', ['ECB', 'REVOLUT']);

    const { data: rates } = await supabase
      .from('fx_rates_daily')
      .select('*')
      .eq('rate_date', date)
      .eq('currency_pair', 'EUR/USD')
      .in('source_id', sources?.map(s => s.id) || []);

    return { success: true, data: { sources, rates } };
  } catch (error) {
    return { success: false, data: null, error };
  }
};
