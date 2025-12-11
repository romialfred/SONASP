/**
 * Test rapide du script amélioré (seulement 3 jours)
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root
dotenv.config({ path: join(__dirname, '..', '.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const XOF_TO_EUR_PEG = 655.957;
const GNF_DAILY_VARIANCE = 0.005;
let BASE_USD_GNF = 8715.75;

function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

async function fetchEurUsd(date) {
  try {
    const dateStr = date.toISOString().split('T')[0];
    const response = await fetch(`https://api.frankfurter.app/${dateStr}?from=EUR&to=USD`);

    if (!response.ok) return null;

    const data = await response.json();
    if (data.rates && data.rates.USD) {
      return parseFloat(data.rates.USD.toFixed(6));
    }
  } catch (error) {
    console.error(`Error:`, error.message);
  }
  return null;
}

async function fetchCurrentUsdGnf() {
  try {
    const response = await fetch(`https://open.er-api.com/v6/latest/USD`);
    if (!response.ok) return BASE_USD_GNF;

    const data = await response.json();
    if (data.result === 'success' && data.rates && data.rates.GNF) {
      return parseFloat(data.rates.GNF.toFixed(2));
    }
  } catch (error) {
    console.error(`Error:`, error.message);
  }
  return BASE_USD_GNF;
}

function estimateHistoricalUsdGnf(baseRate, daysFromNow) {
  const variance = (Math.random() - 0.5) * 2 * GNF_DAILY_VARIANCE * Math.sqrt(Math.abs(daysFromNow));
  const estimated = baseRate * (1 + variance);
  return parseFloat(estimated.toFixed(2));
}

async function testImport() {
  console.log('=== Test Import Amélioré ===\n');

  const { data: ecbSource } = await supabase
    .from('fx_rate_sources')
    .select('id')
    .eq('code', 'ECB')
    .maybeSingle();

  if (!ecbSource) {
    console.error('❌ Source ECB non trouvée');
    return;
  }

  console.log(`✓ Source ECB: ${ecbSource.id}`);

  const currentUsdGnf = await fetchCurrentUsdGnf();
  console.log(`✓ Taux USD/GNF actuel: ${currentUsdGnf}\n`);

  // Test avec 3 dates: 2025-12-02, 12-03, 12-04
  const testDates = [
    new Date('2025-12-02'),
    new Date('2025-12-03'),
    new Date('2025-12-04'),
  ];

  const today = new Date();

  for (const currentDate of testDates) {
    const dateStr = currentDate.toISOString().split('T')[0];

    if (isWeekend(currentDate)) {
      console.log(`⏭️  ${dateStr} - Weekend`);
      continue;
    }

    // Vérifier si existe déjà
    const { data: existing } = await supabase
      .from('fx_rates_daily')
      .select('rate_date')
      .eq('rate_date', dateStr)
      .eq('source_id', ecbSource.id)
      .limit(1);

    if (existing && existing.length > 0) {
      console.log(`✓ ${dateStr} - Existe déjà\n`);
      continue;
    }

    console.log(`🔄 ${dateStr} - Test...`);

    const eurUsd = await fetchEurUsd(currentDate);
    if (!eurUsd) {
      console.log(`❌ ${dateStr} - EUR/USD non disponible\n`);
      continue;
    }

    const usdXof = parseFloat((XOF_TO_EUR_PEG / eurUsd).toFixed(2));
    const daysFromNow = Math.floor((today - currentDate) / (1000 * 60 * 60 * 24));
    const usdGnf = estimateHistoricalUsdGnf(currentUsdGnf, daysFromNow);
    const xofGnf = parseFloat((usdGnf / usdXof).toFixed(4));

    console.log(`   EUR/USD: ${eurUsd}`);
    console.log(`   USD/XOF: ${usdXof}`);
    console.log(`   USD/GNF: ${usdGnf} (estimation)`);
    console.log(`   XOF/GNF: ${xofGnf}`);

    const records = [
      {
        rate_date: dateStr,
        source_id: ecbSource.id,
        currency_pair: 'EUR/USD',
        rate: eurUsd,
        notes: 'Test import Frankfurter',
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
      console.log(`❌ ${dateStr} - Erreur: ${insertError.message}`);
    } else {
      console.log(`✅ ${dateStr} - Sauvegardé avec succès`);
    }

    console.log('');
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('=== Test Terminé ===');
}

testImport()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Erreur:', err);
    process.exit(1);
  });
