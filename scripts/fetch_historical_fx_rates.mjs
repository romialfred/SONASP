/**
 * Script to fetch historical FX rates from October 30, 2025 to December 11, 2025
 * and populate the fx_rates_daily table with data for 2024 and 2025
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const XOF_TO_EUR_PEG = 655.957;

// Helper function to check if date is a weekend
function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

// Fetch EUR/USD from Frankfurter (ECB data)
async function fetchEurUsd(date) {
  try {
    const dateStr = date.toISOString().split('T')[0];
    const response = await fetch(`https://api.frankfurter.app/${dateStr}?from=EUR&to=USD`);

    if (!response.ok) {
      console.log(`Failed to fetch EUR/USD for ${dateStr}`);
      return null;
    }

    const data = await response.json();

    if (data.rates && data.rates.USD) {
      return parseFloat(data.rates.USD.toFixed(6));
    }
  } catch (error) {
    console.error(`Error fetching EUR/USD for ${date.toISOString().split('T')[0]}:`, error.message);
  }

  return null;
}

// Fetch USD/GNF from open.er-api.com
async function fetchUsdGnf(date) {
  try {
    // Note: open.er-api only provides latest rates, not historical
    // For historical data, we'll use the latest rate as approximation
    const response = await fetch(`https://open.er-api.com/v6/latest/USD`);

    if (!response.ok) {
      console.log(`Failed to fetch USD/GNF`);
      return null;
    }

    const data = await response.json();

    if (data.result === 'success' && data.rates && data.rates.GNF) {
      return parseFloat(data.rates.GNF.toFixed(2));
    }
  } catch (error) {
    console.error(`Error fetching USD/GNF:`, error.message);
  }

  return null;
}

// Main function
async function fetchHistoricalRates() {
  console.log('=== Fetching Historical FX Rates ===');
  console.log('Date range: 2024-01-01 to 2025-12-11\n');

  // Get ECB source ID
  const { data: ecbSource, error: sourceError } = await supabase
    .from('fx_rate_sources')
    .select('id')
    .eq('code', 'ECB')
    .maybeSingle();

  if (sourceError || !ecbSource) {
    console.error('Error fetching ECB source:', sourceError);
    return;
  }

  const ecbSourceId = ecbSource.id;
  console.log(`Using ECB source ID: ${ecbSourceId}\n`);

  // Start from 2024-01-01
  const startDate = new Date('2024-01-01');
  const endDate = new Date('2025-12-11');

  let currentDate = new Date(startDate);
  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split('T')[0];

    // Skip weekends
    if (isWeekend(currentDate)) {
      console.log(`⏭️  ${dateStr} - Weekend, skipping`);
      currentDate.setDate(currentDate.getDate() + 1);
      skipCount++;
      continue;
    }

    // Check if data already exists
    const { data: existing } = await supabase
      .from('fx_rates_daily')
      .select('rate_date')
      .eq('rate_date', dateStr)
      .eq('source_id', ecbSourceId)
      .limit(1);

    if (existing && existing.length > 0) {
      console.log(`✓ ${dateStr} - Already exists, skipping`);
      currentDate.setDate(currentDate.getDate() + 1);
      skipCount++;
      continue;
    }

    // Fetch rates
    console.log(`🔄 ${dateStr} - Fetching rates...`);

    const eurUsd = await fetchEurUsd(currentDate);

    if (!eurUsd) {
      console.log(`❌ ${dateStr} - Failed to fetch EUR/USD`);
      currentDate.setDate(currentDate.getDate() + 1);
      errorCount++;
      continue;
    }

    const usdXof = parseFloat((XOF_TO_EUR_PEG / eurUsd).toFixed(2));

    const usdGnf = await fetchUsdGnf(currentDate);

    if (!usdGnf) {
      console.log(`❌ ${dateStr} - Failed to fetch USD/GNF`);
      currentDate.setDate(currentDate.getDate() + 1);
      errorCount++;
      continue;
    }

    const xofGnf = parseFloat((usdGnf / usdXof).toFixed(4));

    // Insert records
    const records = [
      {
        rate_date: dateStr,
        source_id: ecbSourceId,
        currency_pair: 'EUR/USD',
        rate: eurUsd,
        notes: 'Historical import from ECB',
      },
      {
        rate_date: dateStr,
        source_id: ecbSourceId,
        currency_pair: 'USD/XOF',
        rate: usdXof,
        notes: 'Calculated from EUR/USD using fixed XOF/EUR peg (655.957)',
      },
      {
        rate_date: dateStr,
        source_id: ecbSourceId,
        currency_pair: 'USD/GNF',
        rate: usdGnf,
        notes: 'Historical import from ExchangeRate-API',
      },
      {
        rate_date: dateStr,
        source_id: ecbSourceId,
        currency_pair: 'XOF/GNF',
        rate: xofGnf,
        notes: 'Cross rate calculated from USD/XOF and USD/GNF',
      },
    ];

    const { error: insertError } = await supabase
      .from('fx_rates_daily')
      .insert(records);

    if (insertError) {
      console.log(`❌ ${dateStr} - Database insert failed:`, insertError.message);
      errorCount++;
    } else {
      console.log(`✅ ${dateStr} - Rates saved: EUR/USD=${eurUsd}, USD/XOF=${usdXof}, USD/GNF=${usdGnf}`);
      successCount++;
    }

    // Add small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));

    currentDate.setDate(currentDate.getDate() + 1);
  }

  console.log('\n=== Summary ===');
  console.log(`Success: ${successCount}`);
  console.log(`Skipped: ${skipCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log(`Total processed: ${successCount + skipCount + errorCount}`);

  // Now calculate monthly aggregates
  console.log('\n=== Calculating Monthly Aggregates ===');
  await calculateMonthlyAggregates(ecbSourceId);
}

async function calculateMonthlyAggregates(ecbSourceId) {
  const currencyPairs = ['EUR/USD', 'USD/XOF', 'USD/GNF', 'XOF/GNF'];

  // Process 2024 and 2025
  for (let year = 2024; year <= 2025; year++) {
    const maxMonth = year === 2025 ? 12 : 12; // Up to December 2025

    for (let month = 1; month <= maxMonth; month++) {
      for (const pair of currencyPairs) {
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const nextMonth = month === 12 ? 1 : month + 1;
        const nextYear = month === 12 ? year + 1 : year;
        const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

        const { data: monthlyData, error: fetchError } = await supabase
          .from('fx_rates_daily')
          .select('*')
          .eq('source_id', ecbSourceId)
          .eq('currency_pair', pair)
          .gte('rate_date', startDate)
          .lt('rate_date', endDate)
          .order('rate_date', { ascending: true });

        if (fetchError) {
          console.error(`Error fetching data for ${year}-${month} ${pair}:`, fetchError);
          continue;
        }

        if (monthlyData && monthlyData.length > 0) {
          const rates = monthlyData.map(d => d.rate);
          const avgRate = rates.reduce((sum, r) => sum + r, 0) / rates.length;
          const variance = rates.reduce((sum, r) => sum + Math.pow(r - avgRate, 2), 0) / rates.length;
          const volatility = Math.sqrt(variance);

          const { error: upsertError } = await supabase
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

          if (upsertError) {
            console.error(`Error upserting aggregate for ${year}-${month} ${pair}:`, upsertError);
          } else {
            console.log(`✅ ${year}-${String(month).padStart(2, '0')} ${pair} - Aggregate calculated`);
          }
        }
      }
    }
  }
}

fetchHistoricalRates()
  .then(() => {
    console.log('\n✅ Historical FX rates import completed');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Error:', err);
    process.exit(1);
  });
