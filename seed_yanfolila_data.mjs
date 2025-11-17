import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

console.log('=== SEED DATA YANFOLILA ===\n');

// 1. Check if Yanfolila exists, create if not
console.log('1. Verification/Creation compagnie Yanfolila...');
let { data: existingCompany } = await supabase
  .from('mining_companies')
  .select('*')
  .eq('name', 'Yanfolila')
  .single();

let company;

if (existingCompany) {
  console.log('Compagnie existe deja:', existingCompany.name);
  company = existingCompany;
} else {
  const { data: newCompany, error: compError } = await supabase
    .from('mining_companies')
    .insert({
      name: 'Yanfolila',
      country: 'Mali',
      is_active: true
    })
    .select()
    .single();

  if (compError) {
    console.error('Erreur creation compagnie:', compError);
    process.exit(1);
  }

  company = newCompany;
  console.log('Compagnie creee:', company.name);
}

console.log('Compagnie creee:', company.name, '(ID:', company.id, ')');

// 2. Insert 2 production records for October 2025
console.log('\n2. Insertion enregistrements octobre 2025...');

const productionRecords = [
  {
    production_date: '2025-10-15',
    total_weight_oz: 1234.56,
    gold_weight_oz: 1200.00,
    silver_weight_oz: 34.56,
    mining_company_id: company.id,
    site_id: 'guinea',
    status: 'prepared'
  },
  {
    production_date: '2025-10-20',
    total_weight_oz: 2345.67,
    gold_weight_oz: 2300.00,
    silver_weight_oz: 45.67,
    mining_company_id: company.id,
    site_id: 'guinea',
    status: 'prepared'
  }
];

const { data: prodData, error: prodError } = await supabase
  .from('daily_production')
  .insert(productionRecords)
  .select();

if (prodError) {
  console.error('Erreur insertion production:', prodError);
  process.exit(1);
}

console.log('Enregistrements crees:', prodData.length);
prodData.forEach((p, idx) => {
  console.log(`  ${idx + 1}. ${p.production_date}: ${p.total_weight_oz} oz`);
});

// 3. Verify
const { data: verifyData, error: verifyError } = await supabase
  .from('daily_production')
  .select('production_date, total_weight_oz')
  .eq('mining_company_id', company.id)
  .gte('production_date', '2025-10-01')
  .lte('production_date', '2025-10-31')
  .order('production_date');

console.log('\n3. Verification donnees octobre:');
const octoberTotal = verifyData?.reduce((sum, p) => sum + Number(p.total_weight_oz || 0), 0) || 0;
console.log('Total octobre 2025:', octoberTotal.toFixed(2), 'oz');
console.log('\nCe total devrait maintenant apparaitre dans Production Browser!');

process.exit(0);
