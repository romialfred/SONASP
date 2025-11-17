import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

console.log('=== STRUCTURE TABLE daily_production ===\n');

// Try to get one record to see actual columns
const { data, error } = await supabase
  .from('daily_production')
  .select('*')
  .limit(1);

if (error) {
  console.log('Erreur:', error.message);
} else {
  console.log('Nombre enregistrements:', data?.length || 0);

  if (data && data.length > 0) {
    console.log('\nColonnes disponibles:');
    Object.keys(data[0]).forEach(col => {
      console.log(`  - ${col}: ${typeof data[0][col]} = ${data[0][col]}`);
    });
  }
}

// Try with specific columns that might exist
console.log('\n=== TEST AVEC COLONNES POSSIBLES ===\n');

const tests = [
  'bullion_grams',
  'total_weight_grams',
  'total_weight',
  'weight_oz',
  'weight_grams',
  'fine_weight_oz',
  'fine_gold_oz'
];

for (const col of tests) {
  const { data, error } = await supabase
    .from('daily_production')
    .select(col)
    .limit(1);

  if (!error) {
    console.log(`✅ ${col} existe`);
  } else {
    console.log(`❌ ${col} n'existe pas`);
  }
}

process.exit(0);
