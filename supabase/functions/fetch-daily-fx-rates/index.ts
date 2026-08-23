/**
 * Supabase Edge Function: Fetch Daily FX Rates
 *
 * This function runs automatically daily to fetch and store foreign exchange rates
 * from ECB data for the currency pairs used by SONASP.
 *
 * Key Features:
 * - Fetches rates from ECB (European Central Bank)
 * - Handles EUR/USD, USD/XOF and EUR/XOF
 * - Automatically calculates monthly aggregates at month-end
 * - Handles weekends (skips Saturday and Sunday)
 *
 * Currency Pairs:
 * - EUR/USD: Euro to US Dollar
 * - USD/XOF: US Dollar to West African CFA Franc (BCEAO)
 * - EUR/XOF: fixed BCEAO parity
 *
 * Trigger Schedule:
 * - Daily at 10:00 UTC (after markets open)
 * - Cron: 0 10 * * 1-5 (Monday-Friday only)
 *
 * Note: XOF is pegged to EUR at 655.957 XOF = 1 EUR
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

// =============================================================================
// Configuration
// =============================================================================

const XOF_TO_EUR_PEG = 655.957; // Fixed peg: 1 EUR = 655.957 XOF

const WEEKENDS = [0, 6]; // Sunday and Saturday

// =============================================================================
// Helper Functions
// =============================================================================

function isTradingDay(date: Date): boolean {
  const dayOfWeek = date.getDay();
  return !WEEKENDS.includes(dayOfWeek);
}

/**
 * Fetch EUR/USD and calculate USD/XOF from ECB via Frankfurter API
 * Frankfurter provides free ECB exchange rate data
 * XOF is pegged to EUR, so we can calculate: USD/XOF = (1 / EUR/USD) * XOF_TO_EUR_PEG
 */
async function fetchFromECB(): Promise<{ eurUsd: number | null; usdXof: number | null }> {
  try {
    // Using Frankfurter API (free, no API key required, ECB data)
    const response = await fetch('https://api.frankfurter.app/latest?from=EUR&to=USD');

    if (!response.ok) return { eurUsd: null, usdXof: null };

    const data = await response.json();

    if (data.rates && data.rates.USD) {
      const eurUsd = parseFloat(data.rates.USD.toFixed(6));
      // Calculate USD/XOF: If 1 EUR = X USD, then 1 USD = (655.957 / X) XOF
      const usdXof = parseFloat((XOF_TO_EUR_PEG / eurUsd).toFixed(2));

      return { eurUsd, usdXof };
    }
  } catch (error) {
    console.error('Frankfurter API error:', error);
  }

  return { eurUsd: null, usdXof: null };
}

// =============================================================================
// Main Function
// =============================================================================

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (req.headers.get('Authorization') !== `Bearer ${supabaseKey}`) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Check if today is a trading day
    if (!isTradingDay(today)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `Weekend: ${todayStr}`,
          reason: 'weekend',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get ECB source ID
    const { data: ecbSource } = await supabase
      .from('fx_rate_sources')
      .select('id')
      .eq('code', 'ECB')
      .maybeSingle();

    if (!ecbSource) {
      throw new Error('ECB source not found in database');
    }

    const ecbSourceId = ecbSource.id;

    // Check if rates already exist for today
    const { data: existing } = await supabase
      .from('fx_rates_daily')
      .select('rate_date')
      .eq('rate_date', todayStr)
      .eq('source_id', ecbSourceId)
      .limit(1);

    if (existing && existing.length > 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `Rates already recorded for ${todayStr}`,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Fetch rates from ECB
    const { eurUsd, usdXof } = await fetchFromECB();

    if (!eurUsd || !usdXof) {
      throw new Error('Unable to fetch EUR/USD or USD/XOF from ECB');
    }

    // Prepare records to insert
    const records = [
      {
        rate_date: todayStr,
        source_id: ecbSourceId,
        currency_pair: 'EUR/USD',
        rate: eurUsd,
        notes: 'Automated daily import from ECB',
      },
      {
        rate_date: todayStr,
        source_id: ecbSourceId,
        currency_pair: 'USD/XOF',
        rate: usdXof,
        notes: 'Calculated from EUR/USD using fixed XOF/EUR peg (655.957)',
      },
      {
        rate_date: todayStr,
        source_id: ecbSourceId,
        currency_pair: 'EUR/XOF',
        rate: XOF_TO_EUR_PEG,
        notes: 'Parité fixe BCEAO : 1 EUR = 655,957 XOF',
      },
    ];

    // Insert daily rates
    const { error: insertError } = await supabase
      .from('fx_rates_daily')
      .insert(records);

    if (insertError) {
      throw new Error(`Database insert failed: ${insertError.message}`);
    }

    // Check if month-end - if yes, calculate monthly aggregates
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let monthlyAggregatesCreated = false;

    if (tomorrow.getDate() === 1 || tomorrow.getMonth() !== today.getMonth()) {
      const year = today.getFullYear();
      const month = today.getMonth() + 1;

      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? year + 1 : year;
      const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

      // Get unique currency pairs
      const currencyPairs = ['EUR/USD', 'USD/XOF', 'EUR/XOF'];

      for (const pair of currencyPairs) {
        const { data: monthlyData } = await supabase
          .from('fx_rates_daily')
          .select('*')
          .eq('source_id', ecbSourceId)
          .eq('currency_pair', pair)
          .gte('rate_date', startDate)
          .lt('rate_date', endDate)
          .order('rate_date', { ascending: true });

        if (monthlyData && monthlyData.length > 0) {
          const rates = monthlyData.map((d: any) => d.rate);
          const avgRate = rates.reduce((sum: number, r: number) => sum + r, 0) / rates.length;
          const variance = rates.reduce((sum: number, r: number) =>
            sum + Math.pow(r - avgRate, 2), 0) / rates.length;
          const volatility = Math.sqrt(variance);

          await supabase
            .from('fx_rates_monthly_aggregated')
            .upsert({
              year,
              month,
              source_id: ecbSourceId,
              currency_pair: pair,
              average_rate: parseFloat(avgRate.toFixed(6)),
              high_rate: Math.max(...rates),
              low_rate: Math.min(...rates),
              opening_rate: monthlyData[0].rate,
              closing_rate: monthlyData[monthlyData.length - 1].rate,
              total_days: monthlyData.length,
              volatility: parseFloat(volatility.toFixed(6)),
            }, {
              onConflict: 'year,month,source_id,currency_pair',
            });

          monthlyAggregatesCreated = true;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'FX rates recorded successfully',
        data: {
          date: todayStr,
          rates: {
            'EUR/USD': eurUsd,
            'USD/XOF': usdXof,
            'EUR/XOF': XOF_TO_EUR_PEG,
          },
          monthly_aggregates_created: monthlyAggregatesCreated,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error in fetch-daily-fx-rates:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
