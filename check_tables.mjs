import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

console.log('=== VERIFICATION TABLES ===\n');

// Check mining_companies
const { count: compCount, error: compError } = await supabase
  .from('mining_companies')
  .select('*', { count: 'exact', head: true });

console.log('mining_companies:');
console.log('  Existe:', !compError);
console.log('  Count:', compCount);
if (compError) console.log('  Error:', compError.message);

// Check daily_production
const { count: prodCount, error: prodError } = await supabase
  .from('daily_production')
  .select('*', { count: 'exact', head: true });

console.log('\ndaily_production:');
console.log('  Existe:', !prodError);
console.log('  Count:', prodCount);
if (prodError) console.log('  Error:', prodError.message);

// Get some daily_production records without filter
const { data: anyProduction, error: anyError } = await supabase
  .from('daily_production')
  .select('production_date, total_weight_oz, mining_company_id, site_id')
  .limit(5)
  .order('production_date', { ascending: false });

console.log('\n=== DERNIERS ENREGISTREMENTS DAILY_PRODUCTION ===');
console.log('Count:', anyProduction?.length || 0);
if (anyProduction && anyProduction.length > 0) {
  anyProduction.forEach((p, i) => {
    console.log(`\n${i + 1}. Date: ${p.production_date}`);
    console.log(`   Weight: ${p.total_weight_oz} oz`);
    console.log(`   Company ID: ${p.mining_company_id}`);
    console.log(`   Site: ${p.site_id}`);
  });
}

process.exit(0);
