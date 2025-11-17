import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

console.log('=== VERIFICATION DAILY_PRODUCTION YANFOLILA ===\n');

// 1. List all companies first
const { data: allCompanies, error: allCompError } = await supabase
  .from('mining_companies')
  .select('id, name');

console.log('=== TOUTES LES COMPAGNIES ===');
if (allCompanies) {
  allCompanies.forEach((c, i) => {
    console.log(`${i + 1}. ${c.name} (ID: ${c.id})`);
  });
} else {
  console.log('Aucune compagnie trouvee');
}

// 2. Get Yanfolila ID
const { data: companies, error: compError } = await supabase
  .from('mining_companies')
  .select('id, name')
  .ilike('name', '%yanfolila%');

if (compError) {
  console.error('Error fetching companies:', compError);
  process.exit(1);
}

console.log('\n=== RECHERCHE YANFOLILA ===');
console.log('Companies found:', companies);

if (!companies || companies.length === 0) {
  console.log('No Yanfolila company found! Essayons avec les autres noms...\n');

  // Try with different names
  const testNames = ['yanfolila', 'kourousa', 'dubge', 'dugbe'];
  for (const testName of testNames) {
    const { data: testCompany } = await supabase
      .from('mining_companies')
      .select('id, name')
      .ilike('name', `%${testName}%`)
      .limit(1)
      .single();

    if (testCompany) {
      console.log(`Trouvé: ${testCompany.name}`);
      companies.push(testCompany);
      break;
    }
  }

  if (!companies || companies.length === 0) {
    console.log('Aucune compagnie trouvee. Arret.');
    process.exit(1);
  }
}

const yanfolilaId = companies[0].id;
console.log('\nYanfolila ID:', yanfolilaId);

// 2. Count total records
const { count, error: countError } = await supabase
  .from('daily_production')
  .select('*', { count: 'exact', head: true })
  .eq('mining_company_id', yanfolilaId);

console.log('\nTotal daily_production records for Yanfolila:', count);

// 3. Check October 2025 specifically
const { data: octoberData, error: octError } = await supabase
  .from('daily_production')
  .select('production_date, total_weight_oz')
  .eq('mining_company_id', yanfolilaId)
  .gte('production_date', '2025-10-01')
  .lte('production_date', '2025-10-31')
  .order('production_date');

console.log('\n=== OCTOBRE 2025 ===');
console.log('Nombre enregistrements:', octoberData?.length || 0);

if (octoberData && octoberData.length > 0) {
  console.log('\nDetails:');
  octoberData.forEach((record, i) => {
    console.log(`  ${i + 1}. ${record.production_date}: ${record.total_weight_oz} oz`);
  });

  const octoberTotal = octoberData.reduce((sum, p) => sum + Number(p.total_weight_oz || 0), 0);
  console.log(`\nTOTAL OCTOBRE: ${octoberTotal.toFixed(2)} oz`);
  console.log('ATTENDU DANS INTERFACE: Cette valeur devrait apparaitre pour Octobre\n');
} else {
  console.log('Aucun enregistrement trouve pour Octobre 2025\n');
}

// 4. Check all 2025 data
const { data: allData2025, error: allError } = await supabase
  .from('daily_production')
  .select('production_date, total_weight_oz')
  .eq('mining_company_id', yanfolilaId)
  .gte('production_date', '2025-01-01')
  .lte('production_date', '2025-12-31')
  .order('production_date');

console.log('=== TOUTES DONNEES 2025 ===');
console.log('Total enregistrements 2025:', allData2025?.length || 0);

if (allData2025 && allData2025.length > 0) {
  const monthlyTotals = {};
  const monthNames = ['', 'Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin',
                      'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre'];

  allData2025.forEach(record => {
    const date = new Date(record.production_date);
    const month = date.getMonth() + 1;
    const weight = Number(record.total_weight_oz) || 0;

    if (!monthlyTotals[month]) {
      monthlyTotals[month] = 0;
    }
    monthlyTotals[month] += weight;
  });

  console.log('\nAgregation par mois:');
  Object.entries(monthlyTotals).forEach(([month, total]) => {
    console.log(`  ${monthNames[month]}: ${total.toFixed(2)} oz`);
  });
}

process.exit(0);
