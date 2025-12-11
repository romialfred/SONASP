/**
 * Test script to fetch FX rates for a few days only
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const XOF_TO_EUR_PEG = 655.957;

function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

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
    console.error(`Error fetching EUR/USD:`, error.message);
  }

  return null;
}

async function fetchUsdGnf(date) {
  try {
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

async function testFxImport() {
  console.log('=== Test FX Rates Import ===\n');

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

  // Test with 3 recent dates: Nov 1, Nov 4, Nov 5
  const testDates = [
    new Date('2025-11-01'),
    new Date('2025-11-04'),
    new Date('2025-11-05'),
  ];

  for (const currentDate of testDates) {
    const dateStr = currentDate.toISOString().split('T')[0];

    if (isWeekend(currentDate)) {
      console.log(`⏭️  ${dateStr} - Weekend, skipping\n`);
      continue;
    }

    console.log(`🔄 ${dateStr} - Testing fetch...`);

    const eurUsd = await fetchEurUsd(currentDate);

    if (!eurUsd) {
      console.log(`❌ ${dateStr} - Failed to fetch EUR/USD\n`);
      continue;
    }

    const usdXof = parseFloat((XOF_TO_EUR_PEG / eurUsd).toFixed(2));

    const usdGnf = await fetchUsdGnf(currentDate);

    if (!usdGnf) {
      console.log(`❌ ${dateStr} - Failed to fetch USD/GNF\n`);
      continue;
    }

    const xofGnf = parseFloat((usdGnf / usdXof).toFixed(4));

    console.log(`   EUR/USD: ${eurUsd}`);
    console.log(`   USD/XOF: ${usdXof}`);
    console.log(`   USD/GNF: ${usdGnf}`);
    console.log(`   XOF/GNF: ${xofGnf}`);

    // Check if exists
    const { data: existing } = await supabase
      .from('fx_rates_daily')
      .select('rate_date')
      .eq('rate_date', dateStr)
      .eq('source_id', ecbSourceId)
      .limit(1);

    if (existing && existing.length > 0) {
      console.log(`✓ ${dateStr} - Already exists in database\n`);
      continue;
    }

    const records = [
      {
        rate_date: dateStr,
        source_id: ecbSourceId,
        currency_pair: 'EUR/USD',
        rate: eurUsd,
        notes: 'Test import from ECB',
      },
      {
        rate_date: dateStr,
        source_id: ecbSourceId,
        currency_pair: 'USD/XOF',
        rate: usdXof,
        notes: 'Test: Calculated from EUR/USD',
      },
      {
        rate_date: dateStr,
        source_id: ecbSourceId,
        currency_pair: 'USD/GNF',
        rate: usdGnf,
        notes: 'Test import',
      },
      {
        rate_date: dateStr,
        source_id: ecbSourceId,
        currency_pair: 'XOF/GNF',
        rate: xofGnf,
        notes: 'Test: Cross rate',
      },
    ];

    const { error: insertError } = await supabase
      .from('fx_rates_daily')
      .insert(records);

    if (insertError) {
      console.log(`❌ ${dateStr} - Database insert failed:`, insertError.message);
    } else {
      console.log(`✅ ${dateStr} - Successfully saved to database`);
    }

    console.log('');

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('=== Test Complete ===');
}

testFxImport()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
