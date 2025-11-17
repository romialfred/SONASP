import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkAll() {
  console.log('\n=== DIAGNOSTIC COMPLET ===\n');

  // 1. Toutes les shipping preparations
  const { data: allPreps, error: e1 } = await supabase
    .from('shipping_preparations')
    .select('*');

  console.log('1. Total shipping_preparations:', allPreps ? allPreps.length : 0);
  if (e1) console.error('Erreur:', e1);
  else if (allPreps && allPreps.length > 0) {
    console.log('\nShipping preparations trouvées:');
    allPreps.forEach(prep => {
      console.log(`  - ${prep.expedition_lot_number || prep.id} (${prep.status})`);
    });
  }

  // 2. Toutes les productions
  const { data: allProds, error: e2 } = await supabase
    .from('daily_production')
    .select('id, bar_reference, status, production_date')
    .limit(10);

  console.log('\n2. Productions (10 premières):');
  if (e2) {
    console.error('Erreur:', e2);
  } else {
    console.log(`Total: ${allProds ? allProds.length : 0}`);
    if (allProds) {
      allProds.forEach(p => {
        console.log(`  - ${p.bar_reference} (${p.status}) - ${new Date(p.production_date).toLocaleDateString('fr-FR')}`);
      });
    }
  }

  // 3. Tous les items de shipping
  const { data: items, error: e3 } = await supabase
    .from('shipping_production_items')
    .select('*');

  console.log('\n3. Total shipping_production_items:', items ? items.length : 0);
  if (e3) console.error('Erreur:', e3);
  else if (items && items.length > 0) {
    console.log('\nItems trouvés:');
    items.forEach(item => {
      console.log(`  - shipping_preparation_id: ${item.shipping_preparation_id}`);
      console.log(`    daily_production_id: ${item.daily_production_id}`);
      console.log(`    ingot_box_number: ${item.ingot_box_number}`);
    });
  }
}

checkAll().catch(console.error);
