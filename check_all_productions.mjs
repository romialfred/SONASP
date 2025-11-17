import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

console.log('=== TOUTES LES PRODUCTIONS (dernières 10) ===\n');

const { data: allProds, error } = await supabase
  .from('daily_production')
  .select('id, production_date, bar_reference, bullion_grams, status, created_at, updated_at')
  .order('updated_at', { ascending: false })
  .limit(10);

if (error) {
  console.log('❌ Erreur:', error.message);
} else {
  console.log(`Trouvé ${allProds?.length || 0} production(s):\n`);
  allProds?.forEach((p, i) => {
    console.log(`${i+1}. Production ID: ${p.id}`);
    console.log(`   Date: ${p.production_date}`);
    console.log(`   Bar: ${p.bar_reference || 'N/A'}`);
    console.log(`   Poids: ${p.bullion_grams}g`);
    console.log(`   STATUS: "${p.status}"`);
    console.log(`   Créé: ${p.created_at}`);
    console.log(`   MAJ: ${p.updated_at}`);
    console.log('');
  });
}

// Vérifier aussi les shipping_preparations
console.log('\n=== TOUS LES SHIPPING_PREPARATIONS (derniers 10) ===\n');

const { data: allShips, error: shipError } = await supabase
  .from('shipping_preparations')
  .select('id, production_id, status, total_weight_oz, created_at')
  .order('created_at', { ascending: false })
  .limit(10);

if (shipError) {
  console.log('❌ Erreur:', shipError.message);
} else {
  console.log(`Trouvé ${allShips?.length || 0} shipping(s):\n`);
  allShips?.forEach((s, i) => {
    console.log(`${i+1}. Shipping ID: ${s.id}`);
    console.log(`   Production ID: ${s.production_id}`);
    console.log(`   STATUS: "${s.status}"`);
    console.log(`   Poids: ${s.total_weight_oz}oz`);
    console.log(`   Créé: ${s.created_at}`);
    console.log('');
  });
}

process.exit(0);
