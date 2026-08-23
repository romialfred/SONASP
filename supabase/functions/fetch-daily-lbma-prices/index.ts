/**
 * Supabase Edge Function: Fetch Daily LBMA Gold Prices
 *
 * This function runs automatically at market close (London: 4:30 PM GMT)
 * to fetch and store an observed gold market price.
 *
 * Key Features:
 * - Fetches one observed XAU/USD market price from a configured provider
 * - Never reconstructs or fabricates an official LBMA fixing
 * - Automatically calculates monthly aggregates at month-end
 * - Handles weekends and holidays (skips non-trading days)
 *
 * Table Structure:
 * - Uses spot_price as the day's closing price
 * - Legacy non-null price columns receive the same observed value
 * - Columns: price_date, london_am_rate, london_pm_rate, spot_price,
 *   average_price, high_price, low_price, source, currency, notes
 *
 * Trigger Schedule:
 * - Daily at 16:45 GMT (after London PM Fix at 15:00 GMT)
 * - Cron: 0 16 45 * * 1-5 (Monday-Friday only)
 *
 * Environment Variables Required:
 * - METALS_API_KEY (optional - for official LBMA data)
 * - GOLD_API_KEY (optional - fallback source)
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

const LBMA_HOLIDAYS_2025 = [
  '2025-01-01',
  '2025-04-18',
  '2025-04-21',
  '2025-05-05',
  '2025-05-26',
  '2025-08-25',
  '2025-12-25',
  '2025-12-26',
];

// =============================================================================
// Helper Functions
// =============================================================================

function isTradingDay(date: Date): boolean {
  const dayOfWeek = date.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) return false;

  const dateStr = date.toISOString().split('T')[0];
  if (LBMA_HOLIDAYS_2025.includes(dateStr)) return false;

  return true;
}

async function fetchFromMetalsAPI(date: string): Promise<number | null> {
  const apiKey = Deno.env.get('METALS_API_KEY');
  if (!apiKey) return null;

  try {
    const response = await fetch(
      `https://metals-api.com/api/${date}?access_key=${apiKey}&base=USD&symbols=XAU`
    );

    if (!response.ok) return null;

    const data = await response.json();

    if (data.success && data.rates && data.rates.XAU) {
      const pricePerGram = 1 / data.rates.XAU;
      const pricePerOunce = pricePerGram * 31.1034768;
      return parseFloat(pricePerOunce.toFixed(2));
    }
  } catch (error) {
    console.error('Metals-API error:', error);
  }

  return null;
}

async function fetchFromGoldAPI(date: string): Promise<number | null> {
  const apiKey = Deno.env.get('GOLD_API_KEY');
  if (!apiKey) return null;

  try {
    const response = await fetch(
      `https://www.goldapi.io/api/XAU/USD/${date}`,
      {
        headers: {
          'x-access-token': apiKey,
        },
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    return data.price ? parseFloat(data.price.toFixed(2)) : null;
  } catch (error) {
    console.error('Gold-API error:', error);
  }

  return null;
}

async function fetchLivePrice(): Promise<number | null> {
  // Try multiple free sources for live gold price
  const sources = [
    'https://api.gold-api.com/price/XAU',
    'https://api.metals.live/v1/spot/gold',
  ];

  for (const url of sources) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data.price || data.usd) {
          return data.price || data.usd;
        }
      }
    } catch {
      continue;
    }
  }

  return null;
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
          message: `Non-trading day: ${todayStr}`,
          reason: today.getDay() === 0 || today.getDay() === 6 ? 'weekend' : 'holiday',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Check if price already exists for today
    const { data: existing } = await supabase
      .from('gold_prices_daily')
      .select('price_date')
      .eq('price_date', todayStr)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `Price already recorded for ${todayStr}`,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Fetch today's price
    let closingPrice = await fetchFromMetalsAPI(todayStr);
    if (!closingPrice) closingPrice = await fetchFromGoldAPI(todayStr);
    if (!closingPrice) closingPrice = await fetchLivePrice();

    if (!closingPrice) {
      throw new Error('Unable to fetch gold price from any source');
    }

    // Les fournisseurs interrogés renvoient un cours observé, pas les fixings
    // officiels LBMA AM/PM ni les extrêmes intrajournaliers. La version
    // précédente fabriquait ces valeurs avec Math.random(), ce qui est
    // inacceptable pour une donnée financière. Les colonnes historiques étant
    // obligatoires, elles reçoivent toutes le même cours effectivement observé.
    const observedPrice = parseFloat(closingPrice.toFixed(2));

    // Insert daily price (using actual table columns only)
    const { error: insertError } = await supabase
      .from('gold_prices_daily')
      .insert({
        price_date: todayStr,
        london_am_rate: observedPrice,
        london_pm_rate: observedPrice,
        spot_price: observedPrice,
        high_price: observedPrice,
        low_price: observedPrice,
        average_price: observedPrice,
        source: 'API marché — cours observé',
        currency: 'USD',
        notes: 'Cours unique observé auprès d’un fournisseur externe ; aucun fixing LBMA AM/PM reconstitué.',
      });

    if (insertError) {
      throw new Error(`Database insert failed: ${insertError.message}`);
    }

    // Check if month-end - if yes, calculate monthly aggregate
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let monthlyAggregateCreated = false;

    if (tomorrow.getDate() === 1 || tomorrow.getMonth() !== today.getMonth()) {
      const year = today.getFullYear();
      const month = today.getMonth() + 1;

      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;

      const { data: monthlyData } = await supabase
        .from('gold_prices_daily')
        .select('*')
        .gte('price_date', startDate)
        .lt('price_date', endDate)
        .order('price_date', { ascending: true });

      if (monthlyData && monthlyData.length > 0) {
        const prices = monthlyData.map((d: any) => d.average_price);
        const avgPrice = prices.reduce((sum: number, p: number) => sum + p, 0) / prices.length;
        const variance = prices.reduce((sum: number, p: number) =>
          sum + Math.pow(p - avgPrice, 2), 0) / prices.length;
        const volatility = Math.sqrt(variance);

        await supabase
          .from('gold_prices_monthly')
          .upsert({
            year,
            month,
            average_price: parseFloat(avgPrice.toFixed(2)),
            high_price: Math.max(...monthlyData.map((d: any) => d.high_price)),
            low_price: Math.min(...monthlyData.map((d: any) => d.low_price)),
            opening_price: monthlyData[0].london_am_rate,
            closing_price: monthlyData[monthlyData.length - 1].spot_price,
            total_days: monthlyData.length,
            volatility: parseFloat(volatility.toFixed(2)),
          }, {
            onConflict: 'year,month',
          });

        monthlyAggregateCreated = true;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Gold price recorded successfully',
        data: {
          date: todayStr,
          london_am_rate: londonAM,
          spot_price: closingPrice,
          previous_spot_used: previousDay?.spot_price || null,
          monthly_aggregate_created: monthlyAggregateCreated,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: any) {
    console.error('Error in fetch-daily-lbma-prices:', error);

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
