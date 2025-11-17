import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkShipping() {
  console.log('\n=== DIAGNOSTIC SHIPPING PREPARATIONS ===\n');

  // 1. Compter par statut
  const { data: allPreps, error: error1 } = await supabase
    .from('shipping_preparations')
    .select('id, expedition_lot_number, status, shipped_at');

  if (error1) {
    console.error('Erreur shipping_preparations:', error1);
    return;
  }

  console.log('1. Shipping preparations par statut:');
  const counts = {};
  allPreps?.forEach(prep => {
    counts[prep.status] = (counts[prep.status] || 0) + 1;
  });
  Object.entries(counts).forEach(([status, count]) => {
    console.log(`  - ${status}: ${count}`);
  });

  // 2. Ready for expedition avec détails
  console.log('\n2. Shipping avec statut "ready_for_expedition":');
  const { data: readyPreps, error: error2 } = await supabase
    .from('shipping_preparations')
    .select(`
      id,
      expedition_lot_number,
      status,
      shipped_at,
      total_net_weight_grams,
      total_gross_weight_grams,
      shipped_to_company,
      shipped_to_country,
      items:shipping_production_items(
        id,
        daily_production_id,
        ingot_box_number,
        daily_production:daily_production_id(
          production_date,
          bar_reference,
          bullion_grams,
          estimated_fineness_pct,
          pure_gold_grams,
          estimated_oz
        )
      )
    `)
    .eq('status', 'ready_for_expedition');

  if (error2) {
    console.error('Erreur:', error2);
  } else {
    console.log(`Trouvé: ${readyPreps?.length || 0} shipping preparation(s)\n`);
    readyPreps?.forEach(prep => {
      console.log(`\n📦 ${prep.expedition_lot_number}`);
      console.log(`   Statut: ${prep.status}`);
      console.log(`   Date: ${prep.shipped_at ? new Date(prep.shipped_at).toLocaleDateString('fr-FR') : 'N/A'}`);
      console.log(`   Poids net total: ${prep.total_net_weight_grams} g`);
      console.log(`   Destination: ${prep.shipped_to_company}, ${prep.shipped_to_country}`);
      console.log(`   Productions incluses: ${prep.items?.length || 0}`);
      prep.items?.forEach((item, idx) => {
        const prod = item.daily_production;
        if (prod) {
          console.log(`     ${idx + 1}. ${prod.bar_reference} - ${prod.bullion_grams} g / ${prod.estimated_oz} oz`);
        }
      });
    });
  }

  console.log('\n=== SOLUTION ===');
  if (readyPreps && readyPreps.length > 0) {
    console.log('\n✅ Des shipping preparations sont prêtes!');
    console.log('   Le module Freight & Customs doit charger ces données.\n');
  } else {
    console.log('\n⚠️ Aucune shipping preparation avec statut "ready_for_expedition"');
  }
}

checkShipping().catch(console.error);
