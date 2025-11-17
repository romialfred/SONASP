import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

console.log('=== VERIFICATION ENREGISTREMENTS EXISTANTS ===\n');

// Get ALL daily_production records without any filter
const { data: allRecords, error: allError } = await supabase
  .from('daily_production')
  .select('*')
  .order('production_date', { ascending: false });

if (allError) {
  console.log('Erreur lecture:', allError.message);
  console.log('Code:', allError.code);
  process.exit(1);
}

console.log('Total enregistrements daily_production:', allRecords?.length || 0);

if (allRecords && allRecords.length > 0) {
  console.log('\n=== TOUS LES ENREGISTREMENTS ===');
  allRecords.forEach((r, idx) => {
    console.log(`\n${idx + 1}. ${r.production_date}`);
    console.log(`   Weight OZ: ${r.total_weight_oz}`);
    console.log(`   Company ID: ${r.mining_company_id || 'NULL'}`);
    console.log(`   Site: ${r.site_id}`);
  });

  // Filter octobre
  const octobre = allRecords.filter(r =>
    r.production_date && r.production_date.includes('2025-10')
  );

  if (octobre.length > 0) {
    console.log('\n=== OCTOBRE 2025 ===');
    console.log('Nombre:', octobre.length);
    const total = octobre.reduce((s, r) => s + Number(r.total_weight_oz || 0), 0);
    console.log('Total:', total.toFixed(2), 'oz');
  }
}

// Check companies
const { data: companies } = await supabase
  .from('mining_companies')
  .select('id, name');

console.log('\n=== MINING COMPANIES ===');
console.log('Total:', companies?.length || 0);
if (companies && companies.length > 0) {
  companies.forEach(c => console.log(`  - ${c.name} (${c.id})`));
}

process.exit(0);
