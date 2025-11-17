import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

console.log('=== INVESTIGATION WORKFLOW PRODUCTION → SHIPPING ===\n');

// 1. Vérifier les productions avec status "ready_for_customs"
console.log('1️⃣ PRODUCTIONS "ready_for_customs":');
const { data: readyProds, error: readyError } = await supabase
  .from('daily_production')
  .select('id, production_date, bullion_grams, status, bar_reference, created_at')
  .eq('status', 'ready_for_customs')
  .order('created_at', { ascending: false })
  .limit(5);

if (readyError) {
  console.log('❌ Erreur:', readyError.message);
} else {
  console.log(`✅ Trouvé ${readyProds?.length || 0} production(s)`);
  readyProds?.forEach(p => {
    console.log(`  - ID: ${p.id}`);
    console.log(`    Date: ${p.production_date}`);
    console.log(`    Bar: ${p.bar_reference || 'N/A'}`);
    console.log(`    Poids: ${p.bullion_grams}g`);
    console.log(`    Status: ${p.status}`);
    console.log(`    Créé: ${p.created_at}`);
    console.log('');
  });
}

// 2. Vérifier si des shipping_preparations existent pour ces productions
console.log('\n2️⃣ SHIPPING_PREPARATIONS correspondants:');
if (readyProds && readyProds.length > 0) {
  const productionIds = readyProds.map(p => p.id);

  const { data: shippings, error: shipError } = await supabase
    .from('shipping_preparations')
    .select('id, production_id, status, created_at')
    .in('production_id', productionIds);

  if (shipError) {
    console.log('❌ Erreur:', shipError.message);
  } else {
    console.log(`✅ Trouvé ${shippings?.length || 0} shipping(s)`);
    if (shippings && shippings.length > 0) {
      shippings.forEach(s => {
        console.log(`  - Shipping ID: ${s.id}`);
        console.log(`    Production ID: ${s.production_id}`);
        console.log(`    Status: ${s.status}`);
        console.log(`    Créé: ${s.created_at}`);
        console.log('');
      });
    } else {
      console.log('  ⚠️ AUCUN shipping créé pour ces productions !');
    }
  }
}

// 3. Vérifier l'historique des status
console.log('\n3️⃣ HISTORIQUE DES STATUS (derniers changements):');
const { data: history, error: histError } = await supabase
  .from('unified_status_history')
  .select('*')
  .order('changed_at', { ascending: false })
  .limit(10);

if (histError) {
  console.log('❌ Erreur:', histError.message);
} else {
  console.log(`✅ ${history?.length || 0} entrées trouvées`);
  history?.forEach(h => {
    console.log(`  - ${h.entity_type} #${h.entity_id}: ${h.old_status} → ${h.new_status}`);
    console.log(`    Par: ${h.changed_by}, Le: ${h.changed_at}`);
    console.log('');
  });
}

// 4. Vérifier les triggers existants
console.log('\n4️⃣ VÉRIFICATION DES TRIGGERS:');
const { data: triggers, error: trigError } = await supabase.rpc('execute_sql', {
  query: `
    SELECT
      t.tgname as trigger_name,
      t.tgenabled as enabled,
      p.proname as function_name
    FROM pg_trigger t
    JOIN pg_proc p ON t.tgfoid = p.oid
    WHERE t.tgrelid = 'daily_production'::regclass
    AND t.tgname LIKE '%shipping%'
  `
}).catch(() => null);

console.log('Note: RPC non disponible, vérification manuelle requise');

process.exit(0);
