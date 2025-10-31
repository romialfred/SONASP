import { supabase } from '@/lib/supabase';

export interface FxRateAnalysis {
  id: string;
  payment_id: string;
  customer_rate: number;
  revolut_rate: number | null;
  ecb_rate: number | null;
  bceao_rate: number | null;
  best_rate: number;
  best_rate_source: string;
  amount_paid: number;
  payment_currency: string;
  gain_loss_amount: number;
  gain_loss_percentage: number;
  currency_pair: string;
  analysis_date: string;
  created_at: string;
}

export interface CreateFxAnalysisData {
  payment_id: string;
  customer_rate: number;
  revolut_rate?: number | null;
  ecb_rate?: number | null;
  bceao_rate?: number | null;
  amount_paid: number;
  payment_currency: string;
  currency_pair: string;
  created_by: string;
}

export interface FxRateSource {
  source: string;
  rate: number | null;
  converted_amount: number | null;
  difference_from_best: number;
  difference_percentage: number;
}

export interface ComprehensiveFxAnalysis {
  virtual_payment_amount: number;
  virtual_payment_currency: string;
  customer_rate: number;
  revolut_rate: number | null;
  ecb_rate: number | null;
  bceao_rate: number | null;
  best_rate: number;
  best_rate_source: string;
  worst_rate: number;
  worst_rate_source: string;
  amount_with_customer_rate: number;
  amount_with_best_rate: number;
  gain_loss_amount: number;
  gain_loss_percentage: number;
  all_sources: FxRateSource[];
  recommendation: string;
}

export async function createFxAnalysis(data: CreateFxAnalysisData) {
  const rates = [
    { rate: data.customer_rate, source: 'Customer' },
    ...(data.revolut_rate ? [{ rate: data.revolut_rate, source: 'Revolut' }] : []),
    ...(data.ecb_rate ? [{ rate: data.ecb_rate, source: 'ECB' }] : []),
    ...(data.bceao_rate ? [{ rate: data.bceao_rate, source: 'BCEAO' }] : [])
  ];

  const sorted = [...rates].sort((a, b) => b.rate - a.rate);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  const gainLoss = (data.amount_paid * best.rate) - (data.amount_paid * data.customer_rate);
  const gainLossPct = ((best.rate - data.customer_rate) / data.customer_rate) * 100;

  const { data: analysis, error } = await supabase
    .from('fx_rate_analysis')
    .insert({
      ...data,
      best_rate: best.rate,
      best_rate_source: best.source,
      worst_rate: worst.rate,
      worst_rate_source: worst.source,
      gain_loss_amount: gainLoss,
      gain_loss_percentage: gainLossPct,
      base_currency: 'USD',
      market_spread: ((best.rate - worst.rate) / worst.rate) * 100
    })
    .select()
    .single();

  if (error) throw error;

  await supabase.from('payments').update({ fx_analysis_id: analysis.id }).eq('id', data.payment_id);

  return { success: true, data: analysis };
}

export async function getFxAnalysisHistory(filters?: any) {
  let query = supabase.from('fx_analysis_with_details').select('*').order('analysis_date', { ascending: false });

  if (filters?.startDate) query = query.gte('analysis_date', filters.startDate);
  if (filters?.endDate) query = query.lte('analysis_date', filters.endDate);
  if (filters?.customerId) query = query.eq('customer_id', filters.customerId);
  if (filters?.currencyPair) query = query.eq('currency_pair', filters.currencyPair);

  const { data, error } = await query;
  if (error) throw error;

  return { success: true, data };
}

export async function getCurrentFxRates(currencyPair: string) {
  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('fx_rate_comparison')
    .select('*')
    .eq('rate_date', today)
    .eq('currency_pair', currencyPair);

  if (error) throw error;

  const rates: Record<string, number> = {};
  (data || []).forEach(r => { rates[r.source_name] = r.rate; });

  return { success: true, data: rates };
}

export interface FxAnalysisResult {
  best_rate: number;
  best_source: string;
  customer_rate: number;
  gain_loss_amount: number;
  gain_loss_percentage: number;
  rates: Array<{
    source: string;
    rate: number;
    converted_amount: number;
  }>;
}

export async function fetchFxRatesFromMultipleSources(
  currencyPair: string,
  date?: string
): Promise<{
  success: boolean;
  data?: {
    revolut_rate: number | null;
    ecb_rate: number | null;
    bceao_rate: number | null;
  };
  error?: string;
}> {
  try {
    const targetDate = date || new Date().toISOString().split('T')[0];

    const { data: fxRates, error } = await supabase
      .from('fx_rates_daily')
      .select('rate, source_id, fx_rate_sources(code, name)')
      .eq('currency_pair', currencyPair)
      .eq('rate_date', targetDate);

    if (error) {
      console.error('Error fetching FX rates:', error);
    }

    let revolutRate: number | null = null;
    let ecbRate: number | null = null;
    let bceaoRate: number | null = null;

    (fxRates || []).forEach((r: any) => {
      const sourceCode = r.fx_rate_sources?.code?.toUpperCase();
      if (sourceCode === 'REVOLUT') revolutRate = r.rate;
      else if (sourceCode === 'ECB') ecbRate = r.rate;
      else if (sourceCode === 'BCEAO') bceaoRate = r.rate;
    });

    return {
      success: true,
      data: {
        revolut_rate: revolutRate,
        ecb_rate: ecbRate,
        bceao_rate: bceaoRate,
      },
    };
  } catch (error: any) {
    console.error('Error in fetchFxRatesFromMultipleSources:', error);
    return { success: false, error: error.message };
  }
}

export async function performComprehensiveFxAnalysis(
  virtualPaymentAmount: number,
  virtualPaymentCurrency: string,
  customerRate: number,
  currencyPair: string
): Promise<{ success: boolean; data?: ComprehensiveFxAnalysis; error?: string }> {
  try {
    const ratesResult = await fetchFxRatesFromMultipleSources(currencyPair);

    if (!ratesResult.success) {
      return { success: false, error: 'Could not fetch FX rates from sources' };
    }

    const { revolut_rate, ecb_rate, bceao_rate } = ratesResult.data!;

    const ratesArray = [
      { source: 'Customer', rate: customerRate },
      ...(revolut_rate ? [{ source: 'Revolut', rate: revolut_rate }] : []),
      ...(ecb_rate ? [{ source: 'ECB', rate: ecb_rate }] : []),
      ...(bceao_rate ? [{ source: 'BCEAO', rate: bceao_rate }] : []),
    ];

    if (ratesArray.length === 0) {
      return { success: false, error: 'No FX rates available for comparison' };
    }

    const sortedRates = [...ratesArray].sort((a, b) => b.rate - a.rate);
    const bestRate = sortedRates[0];
    const worstRate = sortedRates[sortedRates.length - 1];

    const amountWithCustomerRate = virtualPaymentAmount * customerRate;
    const amountWithBestRate = virtualPaymentAmount * bestRate.rate;
    const gainLossAmount = amountWithBestRate - amountWithCustomerRate;
    const gainLossPercentage = ((bestRate.rate - customerRate) / customerRate) * 100;

    const allSourcesWithDetails: FxRateSource[] = ratesArray.map((rateObj) => {
      const convertedAmount = rateObj.rate ? virtualPaymentAmount * rateObj.rate : null;
      const differenceFromBest = convertedAmount && amountWithBestRate
        ? amountWithBestRate - convertedAmount
        : 0;
      const differencePercentage = rateObj.rate
        ? ((bestRate.rate - rateObj.rate) / rateObj.rate) * 100
        : 0;

      return {
        source: rateObj.source,
        rate: rateObj.rate,
        converted_amount: convertedAmount,
        difference_from_best: differenceFromBest,
        difference_percentage: differencePercentage,
      };
    });

    let recommendation = '';
    if (bestRate.source === 'Customer') {
      recommendation = `Le client utilise le meilleur taux disponible (${bestRate.rate.toFixed(4)}). Excellent choix!`;
    } else {
      recommendation = `Manque à gagner avec ${bestRate.source}: ${Math.abs(gainLossAmount).toFixed(2)} ${virtualPaymentCurrency} (${Math.abs(gainLossPercentage).toFixed(2)}%). Envisagez de négocier avec ${bestRate.source} pour de futurs paiements.`;
    }

    return {
      success: true,
      data: {
        virtual_payment_amount: virtualPaymentAmount,
        virtual_payment_currency: virtualPaymentCurrency,
        customer_rate: customerRate,
        revolut_rate,
        ecb_rate,
        bceao_rate,
        best_rate: bestRate.rate,
        best_rate_source: bestRate.source,
        worst_rate: worstRate.rate,
        worst_rate_source: worstRate.source,
        amount_with_customer_rate: amountWithCustomerRate,
        amount_with_best_rate: amountWithBestRate,
        gain_loss_amount: gainLossAmount,
        gain_loss_percentage: gainLossPercentage,
        all_sources: allSourcesWithDetails,
        recommendation,
      },
    };
  } catch (error: any) {
    console.error('Error in performComprehensiveFxAnalysis:', error);
    return { success: false, error: error.message };
  }
}

export async function saveFxAnalysisToDB(
  paymentId: string,
  analysisData: ComprehensiveFxAnalysis,
  currencyPair: string,
  userId: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const { data: analysis, error } = await supabase
      .from('fx_rate_analysis')
      .insert({
        payment_id: paymentId,
        virtual_payment_amount: analysisData.virtual_payment_amount,
        virtual_payment_currency: analysisData.virtual_payment_currency,
        customer_rate: analysisData.customer_rate,
        revolut_rate: analysisData.revolut_rate,
        ecb_rate: analysisData.ecb_rate,
        bceao_rate: analysisData.bceao_rate,
        best_rate: analysisData.best_rate,
        best_rate_source: analysisData.best_rate_source,
        worst_rate: analysisData.worst_rate,
        worst_rate_source: analysisData.worst_rate_source,
        amount_with_customer_rate: analysisData.amount_with_customer_rate,
        amount_with_best_rate: analysisData.amount_with_best_rate,
        gain_loss_amount: analysisData.gain_loss_amount,
        gain_loss_percentage: analysisData.gain_loss_percentage,
        currency_pair: currencyPair,
        analysis_date: new Date().toISOString().split('T')[0],
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving FX analysis:', error);
      return { success: false, error: error.message };
    }

    await supabase
      .from('payments')
      .update({ fx_analysis_id: analysis.id })
      .eq('id', paymentId);

    return { success: true, data: analysis };
  } catch (error: any) {
    console.error('Error in saveFxAnalysisToDB:', error);
    return { success: false, error: error.message };
  }
}

export async function analyzeFxTransaction(
  amount: number,
  currencyPair: string,
  customerRate: number
): Promise<{ success: boolean; data?: FxAnalysisResult; error?: string }> {
  try {
    const ratesResult = await getCurrentFxRates(currencyPair);

    if (!ratesResult.success || !ratesResult.data) {
      return { success: false, error: 'Could not fetch current rates' };
    }

    const rates = ratesResult.data;
    const comparison = Object.entries(rates).map(([source, rate]) => ({
      source,
      rate: rate as number,
      converted_amount: amount * (rate as number)
    }));

    comparison.push({
      source: 'Customer',
      rate: customerRate,
      converted_amount: amount * customerRate
    });

    comparison.sort((a, b) => b.rate - a.rate);

    const best = comparison[0];
    const gainLoss = (amount * best.rate) - (amount * customerRate);
    const gainLossPct = ((best.rate - customerRate) / customerRate) * 100;

    return {
      success: true,
      data: {
        best_rate: best.rate,
        best_source: best.source,
        customer_rate: customerRate,
        gain_loss_amount: gainLoss,
        gain_loss_percentage: gainLossPct,
        rates: comparison
      }
    };
  } catch (error: any) {
    console.error('Error analyzing FX transaction:', error);
    return { success: false, error: error.message };
  }
}
