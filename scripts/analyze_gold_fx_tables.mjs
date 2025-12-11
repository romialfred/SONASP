/**
 * Analyze existing gold_prices and fx_rates tables
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function analyzeTable(tableName) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 Analyzing table: ${tableName}`);
  console.log('='.repeat(60));

  // Count rows
  const { count, error: countError } = await supabase
    .from(tableName)
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.log(`❌ Error counting rows: ${countError.message}`);
  } else {
    console.log(`📈 Total rows: ${count}`);
  }

  // Get sample data
  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(3);

  if (error) {
    console.log(`❌ Error fetching sample: ${error.message}`);
  } else if (data && data.length > 0) {
    console.log(`\n📝 Sample data (${data.length} rows):`);
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log('⚠️  No data found in table');
  }
}

async function main() {
  console.log('🔍 Starting table analysis...\n');

  // Analyze gold prices tables
  await analyzeTable('gold_prices_daily');
  await analyzeTable('gold_prices_monthly');

  // Analyze FX rates tables
  await analyzeTable('fx_rates_daily');
  await analyzeTable('fx_rates_monthly_aggregated');
  await analyzeTable('fx_rate_sources');

  console.log('\n' + '='.repeat(60));
  console.log('✅ Analysis complete!');
  console.log('='.repeat(60) + '\n');
}

main().catch(error => {
  console.error('❌ Analysis failed:', error);
  process.exit(1);
});
