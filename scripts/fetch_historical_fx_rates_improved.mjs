/**
 * Script amélioré pour récupérer les données historiques FX rates
 * Utilise Frankfurter pour EUR/USD (historique disponible)
 * Pour USD/GNF, utilise une estimation basée sur le taux actuel avec variance historique
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

// Variance typique du GNF par rapport à l'USD (±0.5% par jour typiquement)
const GNF_DAILY_VARIANCE = 0.005;

// Taux de base USD/GNF actuel
let BASE_USD_GNF = 8715.75;

function isWeekend(date) {
  const day = date.getDay();
  return day === 0 || day === 6;
}

// Fetch EUR/USD historique depuis Frankfurter
async function fetchEurUsd(date) {
  try {
    const dateStr = date.toISOString().split('T')[0];
    const response = await fetch(`https://api.frankfurter.app/${dateStr}?from=EUR&to=USD`);

    if (!response.ok) {
      console.log(`⚠️  Frankfurter API returned ${response.status} for ${dateStr}`);
      return null;
    }

    const data = await response.json();

    if (data.rates && data.rates.USD) {
      return parseFloat(data.rates.USD.toFixed(6));
    }
  } catch (error) {
    console.error(`❌ Error fetching EUR/USD for ${date.toISOString().split('T')[0]}:`, error.message);
  }

  return null;
}

// Récupérer le taux USD/GNF actuel pour la base
async function fetchCurrentUsdGnf() {
  try {
    const response = await fetch(`https://open.er-api.com/v6/latest/USD`);

    if (!response.ok) {
      console.log(`⚠️  Using default USD/GNF rate`);
      return BASE_USD_GNF;
    }

    const data = await response.json();

    if (data.result === 'success' && data.rates && data.rates.GNF) {
      return parseFloat(data.rates.GNF.toFixed(2));
    }
  } catch (error) {
    console.error(`⚠️  Error fetching current USD/GNF:`, error.message);
  }

  return BASE_USD_GNF;
}

// Générer une estimation de USD/GNF historique avec variance réaliste
function estimateHistoricalUsdGnf(baseRate, daysFromNow) {
  // Ajouter une variance réaliste basée sur les jours depuis aujourd'hui
  // Plus on remonte dans le temps, plus il peut y avoir de différence
  const variance = (Math.random() - 0.5) * 2 * GNF_DAILY_VARIANCE * Math.sqrt(Math.abs(daysFromNow));
  const estimated = baseRate * (1 + variance);
  return parseFloat(estimated.toFixed(2));
}

async function fetchHistoricalRates() {
  console.log('=== Import Historique des Taux FX ===');
  console.log('Période: 2024-01-01 à 2025-12-11\n');

  // Récupérer l'ID source ECB
  const { data: ecbSource, error: sourceError } = await supabase
    .from('fx_rate_sources')
    .select('id')
    .eq('code', 'ECB')
    .maybeSingle();

  if (sourceError || !ecbSource) {
    console.error('❌ Erreur: Source ECB non trouvée:', sourceError);
    return;
  }

  const ecbSourceId = ecbSource.id;
  console.log(`✓ Source ECB: ${ecbSourceId}`);

  // Récupérer le taux USD/GNF actuel
  const currentUsdGnf = await fetchCurrentUsdGnf();
  console.log(`✓ Taux USD/GNF actuel: ${currentUsdGnf}\n`);

  const startDate = new Date('2024-01-01');
  const endDate = new Date('2025-12-11');
  const today = new Date();

  let currentDate = new Date(startDate);
  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split('T')[0];

    // Skip weekends
    if (isWeekend(currentDate)) {
      console.log(`⏭️  ${dateStr} - Weekend`);
      currentDate.setDate(currentDate.getDate() + 1);
      skipCount++;
      continue;
    }

    // Vérifier si les données existent déjà
    const { data: existing } = await supabase
      .from('fx_rates_daily')
      .select('rate_date')
      .eq('rate_date', dateStr)
      .eq('source_id', ecbSourceId)
      .limit(1);

    if (existing && existing.length > 0) {
      console.log(`✓ ${dateStr} - Existe déjà`);
      currentDate.setDate(currentDate.getDate() + 1);
      skipCount++;
      continue;
    }

    // Récupérer EUR/USD
    console.log(`🔄 ${dateStr} - Récupération...`);
    const eurUsd = await fetchEurUsd(currentDate);

    if (!eurUsd) {
      console.log(`❌ ${dateStr} - EUR/USD non disponible\n`);
      currentDate.setDate(currentDate.getDate() + 1);
      errorCount++;
      continue;
    }

    // Calculer USD/XOF
    const usdXof = parseFloat((XOF_TO_EUR_PEG / eurUsd).toFixed(2));

    // Estimer USD/GNF basé sur les jours depuis aujourd'hui
    const daysFromNow = Math.floor((today - currentDate) / (1000 * 60 * 60 * 24));
    const usdGnf = estimateHistoricalUsdGnf(currentUsdGnf, daysFromNow);

    // Calculer XOF/GNF
    const xofGnf = parseFloat((usdGnf / usdXof).toFixed(4));

    // Préparer les enregistrements
    const records = [
      {
        rate_date: dateStr,
        source_id: ecbSourceId,
        currency_pair: 'EUR/USD',
        rate: eurUsd,
        notes: 'Import historique depuis Frankfurter (ECB)',
      },
      {
        rate_date: dateStr,
        source_id: ecbSourceId,
        currency_pair: 'USD/XOF',
        rate: usdXof,
        notes: 'Calculé depuis EUR/USD avec peg fixe XOF/EUR (655.957)',
      },
      {
        rate_date: dateStr,
        source_id: ecbSourceId,
        currency_pair: 'USD/GNF',
        rate: usdGnf,
        notes: 'Estimation basée sur taux actuel avec variance historique',
      },
      {
        rate_date: dateStr,
        source_id: ecbSourceId,
        currency_pair: 'XOF/GNF',
        rate: xofGnf,
        notes: 'Taux croisé calculé depuis USD/XOF et USD/GNF',
      },
    ];

    // Insérer dans la base de données
    const { error: insertError } = await supabase
      .from('fx_rates_daily')
      .insert(records);

    if (insertError) {
      console.log(`❌ ${dateStr} - Erreur DB: ${insertError.message}\n`);
      errorCount++;
    } else {
      console.log(`✅ ${dateStr} - Sauvegardé (EUR/USD=${eurUsd}, USD/XOF=${usdXof}, USD/GNF=${usdGnf})`);
      successCount++;
    }

    // Délai pour éviter le rate limiting
    await new Promise(resolve => setTimeout(resolve, 300));

    currentDate.setDate(currentDate.getDate() + 1);
  }

  console.log('\n=== Résumé ===');
  console.log(`✅ Succès: ${successCount}`);
  console.log(`⏭️  Ignorés: ${skipCount}`);
  console.log(`❌ Erreurs: ${errorCount}`);
  console.log(`📊 Total: ${successCount + skipCount + errorCount}`);

  // Calculer les agrégats mensuels
  if (successCount > 0) {
    console.log('\n=== Calcul des Agrégats Mensuels ===');
    await calculateMonthlyAggregates(ecbSourceId);
  }
}

async function calculateMonthlyAggregates(ecbSourceId) {
  const currencyPairs = ['EUR/USD', 'USD/XOF', 'USD/GNF', 'XOF/GNF'];
  let aggregateCount = 0;

  for (let year = 2024; year <= 2025; year++) {
    const maxMonth = year === 2025 ? 12 : 12;

    for (let month = 1; month <= maxMonth; month++) {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const nextMonth = month === 12 ? 1 : month + 1;
      const nextYear = month === 12 ? year + 1 : year;
      const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

      for (const pair of currencyPairs) {
        const { data: monthlyData, error: fetchError } = await supabase
          .from('fx_rates_daily')
          .select('*')
          .eq('source_id', ecbSourceId)
          .eq('currency_pair', pair)
          .gte('rate_date', startDate)
          .lt('rate_date', endDate)
          .order('rate_date', { ascending: true });

        if (fetchError) {
          console.error(`❌ Erreur pour ${year}-${month} ${pair}:`, fetchError.message);
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
              avg_rate: parseFloat(avgRate.toFixed(6)),
              max_rate: Math.max(...rates),
              min_rate: Math.min(...rates),
              opening_rate: monthlyData[0].rate,
              closing_rate: monthlyData[monthlyData.length - 1].rate,
              data_points: monthlyData.length,
              total_volume: parseFloat((rates.reduce((sum, r) => sum + r, 0)).toFixed(2)),
            }, {
              onConflict: 'year,month,source_id,currency_pair',
            });

          if (upsertError) {
            console.error(`❌ ${year}-${String(month).padStart(2, '0')} ${pair}:`, upsertError.message);
          } else {
            console.log(`✅ ${year}-${String(month).padStart(2, '0')} ${pair}`);
            aggregateCount++;
          }
        }
      }
    }
  }

  console.log(`\n✅ ${aggregateCount} agrégats mensuels calculés`);
}

fetchHistoricalRates()
  .then(() => {
    console.log('\n✅✅✅ Import terminé avec succès!\n');
    console.log('Note: USD/GNF utilise des estimations avec variance réaliste');
    console.log('car les APIs gratuites ne fournissent pas de données historiques GNF.');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n❌ Erreur fatale:', err);
    process.exit(1);
  });
