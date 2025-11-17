import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

console.log('=== VERIFICATION TABLES PRODUCTION ===\n');

// Check different possible tables
const tablesToCheck = [
  'production',
  'daily_production',
  'batches',
  'production_batches',
  'monthly_production'
];

for (const tableName of tablesToCheck) {
  const { count, error } = await supabase
    .from(tableName)
    .select('*', { count: 'exact', head: true });

  console.log(`${tableName}:`);
  if (error) {
    console.log(`  Erreur: ${error.message}`);
  } else {
    console.log(`  Count: ${count}`);

    if (count && count > 0) {
      // Get sample record
      const { data, error: dataError } = await supabase
        .from(tableName)
        .select('*')
        .limit(1);

      if (data && data.length > 0) {
        console.log(`  Colonnes:`, Object.keys(data[0]).join(', '));
      }
    }
  }
  console.log('');
}

// Check if there's a production table with data
const { data: prodData, error: prodError } = await supabase
  .from('production')
  .select('*')
  .limit(5);

if (!prodError && prodData && prodData.length > 0) {
  console.log('=== PRODUCTION TABLE (5 premiers) ===');
  prodData.forEach((p, idx) => {
    console.log(`\nRecord ${idx + 1}:`);
    Object.entries(p).forEach(([key, value]) => {
      console.log(`  ${key}: ${value}`);
    });
  });
}

process.exit(0);
