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
