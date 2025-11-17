import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

console.log('=== ANALYSE STRUCTURE shipping_preparations ===\n');

// Test: Essayer d'insérer avec 'pending'
console.log('TEST: Insertion avec status="pending"');
const { data: testData, error: testError } = await supabase
  .from('shipping_preparations')
  .insert({
    expedition_lot_number: `TEST-${Date.now()}`,
    status: 'pending',
    total_net_weight_grams: 100
  })
  .select();

if (testError) {
  console.log(`❌ ERREUR: ${testError.message}`);
  console.log(`   Hint: ${testError.hint || 'N/A'}`);
} else {
  console.log(`✅ SUCCESS`);
  // Supprimer le test
  await supabase.from('shipping_preparations').delete().eq('id', testData[0].id);
}

process.exit(0);
