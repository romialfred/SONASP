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

async function testImport() {
  console.log('=== Test Import avec Agrégats ===\n');

  const { data: ecbSource } = await supabase
    .from('fx_rate_sources')
    .select('id')
    .eq('code', 'ECB')
    .maybeSingle();

  if (!ecbSource) {
    console.error('❌ Source ECB non trouvée');
    return;
  }

  console.log(`✓ Source ECB: ${ecbSource.id}\n`);

  // Importer quelques dates de décembre 2025
  const testDates = ['2025-12-06', '2025-12-07', '2025-12-08'];

  for (const dateStr of testDates) {
    const date = new Date(dateStr);
    
    // Vérifier si existe déjà
    const { data: existing } = await supabase
      .from('fx_rates_daily')
      .select('rate_date')
      .eq('source_id', ecbSource.id)
      .eq('rate_date', dateStr)
      .eq('currency_pair', 'EUR/USD')
      .maybeSingle();

    if (existing) {
      console.log(`⏭️  ${dateStr} - Existe déjà`);
      continue;
    }

    // Récupérer EUR/USD
    const response = await fetch(`https://api.frankfurter.app/${dateStr}?from=EUR&to=USD`);
    if (!response.ok) {
      console.log(`❌ ${dateStr} - EUR/USD non disponible`);
      continue;
    }

    const data = await response.json();
    const eurUsd = data.rates?.USD ? parseFloat(data.rates.USD.toFixed(6)) : null;

    if (!eurUsd) {
      console.log(`❌ ${dateStr} - Pas de taux EUR/USD`);
      continue;
    }

    const usdXof = parseFloat((XOF_TO_EUR_PEG / eurUsd).toFixed(2));
    const usdGnf = 8715.75; // Taux fixe pour test
    const xofGnf = parseFloat((usdGnf / usdXof).toFixed(4));

    const records = [
      { rate_date: dateStr, source_id: ecbSource.id, currency_pair: 'EUR/USD', rate: eurUsd, notes: 'Test' },
      { rate_date: dateStr, source_id: ecbSource.id, currency_pair: 'USD/XOF', rate: usdXof, notes: 'Test' },
      { rate_date: dateStr, source_id: ecbSource.id, currency_pair: 'USD/GNF', rate: usdGnf, notes: 'Test' },
      { rate_date: dateStr, source_id: ecbSource.id, currency_pair: 'XOF/GNF', rate: xofGnf, notes: 'Test' },
    ];

    const { error } = await supabase.from('fx_rates_daily').insert(records);

    if (error) {
      console.log(`❌ ${dateStr} - Erreur: ${error.message}`);
    } else {
      console.log(`✅ ${dateStr} - Sauvegardé`);
    }

    await new Promise(resolve => setTimeout(resolve, 200));
  }

  // Calculer agrégat pour décembre 2025
  console.log('\n=== Calcul Agrégat Décembre 2025 ===\n');

  const { data: monthlyData } = await supabase
    .from('fx_rates_daily')
    .select('*')
    .eq('source_id', ecbSource.id)
    .eq('currency_pair', 'EUR/USD')
    .gte('rate_date', '2025-12-01')
    .lt('rate_date', '2026-01-01')
    .order('rate_date', { ascending: true });

  if (monthlyData && monthlyData.length > 0) {
    const rates = monthlyData.map(d => d.rate);
    const avgRate = rates.reduce((sum, r) => sum + r, 0) / rates.length;

    const aggregate = {
      year: 2025,
      month: 12,
      source_id: ecbSource.id,
      currency_pair: 'EUR/USD',
      avg_rate: parseFloat(avgRate.toFixed(6)),
      max_rate: Math.max(...rates),
      min_rate: Math.min(...rates),
      opening_rate: monthlyData[0].rate,
      closing_rate: monthlyData[monthlyData.length - 1].rate,
      data_points: monthlyData.length,
      total_volume: parseFloat((rates.reduce((sum, r) => sum + r, 0)).toFixed(2)),
    };

    console.log(`Données: ${monthlyData.length} jours`);
    console.log(`Taux moyen: ${aggregate.avg_rate}`);
    console.log(`Min: ${aggregate.min_rate} | Max: ${aggregate.max_rate}\n`);

    const { error } = await supabase
      .from('fx_rates_monthly_aggregated')
      .upsert(aggregate, { onConflict: 'year,month,source_id,currency_pair' });

    if (error) {
      console.error(`❌ Erreur agrégat: ${error.message}`);
    } else {
      console.log(`✅ Agrégat créé pour 2025-12 EUR/USD`);
    }
  }

  console.log('\n✅ Test terminé!');
}

testImport()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Erreur:', err);
    process.exit(1);
  });
