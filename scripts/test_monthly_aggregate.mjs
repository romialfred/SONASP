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

async function testAggregate() {
  console.log('Test calcul agrégat mensuel...\n');

  const { data: ecbSource } = await supabase
    .from('fx_rate_sources')
    .select('id')
    .eq('code', 'ECB')
    .maybeSingle();

  if (!ecbSource) {
    console.error('Source ECB non trouvée');
    return;
  }

  // Récupérer quelques données pour décembre 2025
  const { data: monthlyData } = await supabase
    .from('fx_rates_daily')
    .select('*')
    .eq('source_id', ecbSource.id)
    .eq('currency_pair', 'EUR/USD')
    .gte('rate_date', '2025-12-01')
    .lt('rate_date', '2026-01-01')
    .order('rate_date', { ascending: true });

  if (!monthlyData || monthlyData.length === 0) {
    console.log('Pas de données pour décembre 2025');
    return;
  }

  console.log(`Trouvé ${monthlyData.length} jours de données pour décembre 2025`);

  const rates = monthlyData.map(d => d.rate);
  const avgRate = rates.reduce((sum, r) => sum + r, 0) / rates.length;

  const testAggregate = {
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

  console.log('\nDonnées à insérer:', testAggregate);

  const { error } = await supabase
    .from('fx_rates_monthly_aggregated')
    .upsert(testAggregate, {
      onConflict: 'year,month,source_id,currency_pair',
    });

  if (error) {
    console.error('\n❌ Erreur:', error.message);
  } else {
    console.log('\n✅ Agrégat créé avec succès!');
  }
}

testAggregate()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Erreur:', err);
    process.exit(1);
  });
