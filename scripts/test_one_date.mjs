/**
 * Test avec une seule date nouvelle
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const XOF_TO_EUR_PEG = 655.957;
const GNF_DAILY_VARIANCE = 0.005;

async function fetchEurUsd(date) {
  try {
    const dateStr = date.toISOString().split('T')[0];
    const response = await fetch(`https://api.frankfurter.app/${dateStr}?from=EUR&to=USD`);
    if (!response.ok) return null;
    const data = await response.json();
    return data.rates?.USD ? parseFloat(data.rates.USD.toFixed(6)) : null;
  } catch (error) {
    console.error(`Error:`, error.message);
    return null;
  }
}

async function fetchCurrentUsdGnf() {
  try {
    const response = await fetch(`https://open.er-api.com/v6/latest/USD`);
    if (!response.ok) return 8715.75;
    const data = await response.json();
    return data.result === 'success' && data.rates?.GNF
      ? parseFloat(data.rates.GNF.toFixed(2))
      : 8715.75;
  } catch (error) {
    return 8715.75;
  }
}

function estimateUsdGnf(baseRate, daysFromNow) {
  const variance = (Math.random() - 0.5) * 2 * GNF_DAILY_VARIANCE * Math.sqrt(Math.abs(daysFromNow));
  return parseFloat((baseRate * (1 + variance)).toFixed(2));
}

async function testOneDate() {
  console.log('=== Test Import 2025-12-05 ===\n');

  const { data: ecbSource } = await supabase
    .from('fx_rate_sources')
    .select('id')
    .eq('code', 'ECB')
    .maybeSingle();

  if (!ecbSource) {
    console.error('❌ Source ECB non trouvée');
    return;
  }

  const testDate = new Date('2025-12-05');
  const dateStr = testDate.toISOString().split('T')[0];
  const currentUsdGnf = await fetchCurrentUsdGnf();

  console.log(`📅 Date: ${dateStr}`);
  console.log(`💰 Taux USD/GNF actuel: ${currentUsdGnf}\n`);

  const eurUsd = await fetchEurUsd(testDate);

  if (!eurUsd) {
    console.log('❌ EUR/USD non disponible');
    return;
  }

  const usdXof = parseFloat((XOF_TO_EUR_PEG / eurUsd).toFixed(2));
  const today = new Date();
  const daysFromNow = Math.floor((today - testDate) / (1000 * 60 * 60 * 24));
  const usdGnf = estimateUsdGnf(currentUsdGnf, daysFromNow);
  const xofGnf = parseFloat((usdGnf / usdXof).toFixed(4));

  console.log('📊 Taux calculés:');
  console.log(`   EUR/USD: ${eurUsd}`);
  console.log(`   USD/XOF: ${usdXof}`);
  console.log(`   USD/GNF: ${usdGnf}`);
  console.log(`   XOF/GNF: ${xofGnf}\n`);

  const records = [
    {
      rate_date: dateStr,
      source_id: ecbSource.id,
      currency_pair: 'EUR/USD',
      rate: eurUsd,
      notes: 'Test: Import Frankfurter',
    },
    {
      rate_date: dateStr,
      source_id: ecbSource.id,
      currency_pair: 'USD/XOF',
      rate: usdXof,
      notes: 'Test: Calculé depuis EUR/USD',
    },
    {
      rate_date: dateStr,
      source_id: ecbSource.id,
      currency_pair: 'USD/GNF',
      rate: usdGnf,
      notes: 'Test: Estimation avec variance',
    },
    {
      rate_date: dateStr,
      source_id: ecbSource.id,
      currency_pair: 'XOF/GNF',
      rate: xofGnf,
      notes: 'Test: Taux croisé',
    },
  ];

  const { error: insertError } = await supabase
    .from('fx_rates_daily')
    .insert(records);

  if (insertError) {
    console.log(`❌ Erreur d'insertion: ${insertError.message}`);
  } else {
    console.log(`✅ Données sauvegardées avec succès!`);
  }
}

testOneDate()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Erreur:', err);
    process.exit(1);
  });
