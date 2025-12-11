import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function investigateKGM() {
  console.log('\n=== INVESTIGATION COMPLÈTE KGM ===\n');

  // 1. Get all mining companies first
  const { data: allCompanies } = await supabase
    .from('mining_companies')
    .select('*')
    .order('name');

  console.log('Mining companies dans la DB:');
  if (allCompanies) {
    allCompanies.forEach(c => {
      console.log('  -', c.name, '(code:', c.code + ', id:', c.id.substring(0, 8) + '...)');
    });
  }

  // 2. Get KGM - try by code first, then by name
  let { data: kgm } = await supabase
    .from('mining_companies')
    .select('*')
    .eq('code', 'KGM')
    .maybeSingle();

  if (!kgm) {
    // Try by name
    const result = await supabase
      .from('mining_companies')
      .select('*')
      .ilike('name', '%kourousa%')
      .maybeSingle();
    kgm = result.data;
  }

  if (!kgm) {
    console.log('❌ KGM non trouvé');
    return;
  }

  console.log('✅ KGM trouvé:');
  console.log('   ID:', kgm.id);
  console.log('   Name:', kgm.name);
  console.log('   Code:', kgm.code);

  // 2. Check production for KGM
  console.log('\n--- ÉTAPE 1: Production ---');
  const { data: productions, error: prodError } = await supabase
    .from('production')
    .select('*')
    .eq('mining_company_id', kgm.id);

  if (prodError) {
    console.log('❌ Erreur production:', prodError.message);
    return;
  }

  if (!productions || productions.length === 0) {
    console.log('❌ Aucune production pour KGM');
    console.log('   CAUSE DU PROBLÈME: Il n\'y a pas de productions enregistrées pour KGM');
    console.log('\n💡 SOLUTION: Créer des productions pour KGM dans la table production');
    return;
  }

  console.log('✅ ' + productions.length + ' production(s) trouvée(s)');
  const prodIds = productions.map(p => p.id);
  console.log('   IDs:', prodIds.slice(0, 3).map(id => id.substring(0, 8) + '...').join(', '));

  // 3. Check freight_shipments
  console.log('\n--- ÉTAPE 2: Freight Shipments ---');
  const { data: shipments, error: shipError } = await supabase
    .from('freight_shipments')
    .select('*')
    .in('production_id', prodIds);

  if (shipError) {
    console.log('❌ Erreur freight:', shipError.message);
    return;
  }

  if (!shipments || shipments.length === 0) {
    console.log('❌ Aucun freight shipment pour ces productions');
    console.log('   CAUSE DU PROBLÈME: Les productions KGM n\'ont pas de freight shipments associés');
    console.log('\n💡 SOLUTION: Créer des freight shipments pour les productions KGM');
    return;
  }

  console.log('✅ ' + shipments.length + ' freight shipment(s) trouvé(s)');
  const shipmentIds = shipments.map(s => s.id);

  // 4. Check inventory
  console.log('\n--- ÉTAPE 3: Gold Inventory ---');
  const { data: inventory, error: invError } = await supabase
    .from('gold_inventory')
    .select('*')
    .in('freight_shipment_id', shipmentIds);

  if (invError) {
    console.log('❌ Erreur inventory:', invError.message);
    return;
  }

  if (!inventory || inventory.length === 0) {
    console.log('❌ Aucun inventaire pour ces shipments');
    console.log('   CAUSE DU PROBLÈME: Les freight shipments KGM n\'ont pas d\'entrées d\'inventaire');
    console.log('\n💡 SOLUTION: Créer des entrées d\'inventaire pour ces shipments');
    return;
  }

  console.log('✅ ' + inventory.length + ' entrée(s) d\'inventaire trouvée(s)');

  const totalAvailable = inventory.reduce((sum, inv) =>
    sum + (parseFloat(inv.quantity_available_oz) || 0), 0);
  const totalAllocated = inventory.reduce((sum, inv) =>
    sum + (parseFloat(inv.quantity_allocated_oz) || 0), 0);
  const totalSold = inventory.reduce((sum, inv) =>
    sum + (parseFloat(inv.quantity_sold_oz) || 0), 0);

  console.log('\n📊 TOTAUX POUR KGM:');
  console.log('   Disponible: ' + totalAvailable.toFixed(3) + ' oz');
  console.log('   Alloué: ' + totalAllocated.toFixed(3) + ' oz');
  console.log('   Vendu: ' + totalSold.toFixed(3) + ' oz');

  if (totalAvailable === 0) {
    console.log('\n⚠️  Le stock disponible est à 0.000 oz');
    console.log('   CAUSE: Tout le stock a été alloué ou vendu, OU les quantités ne sont pas correctes');
    console.log('\n   Détail des entrées:');
    inventory.forEach((inv, i) => {
      console.log('   Inventaire ' + (i+1) + ':');
      console.log('     - Disponible:', inv.quantity_available_oz, 'oz');
      console.log('     - Alloué:', inv.quantity_allocated_oz, 'oz');
      console.log('     - Vendu:', inv.quantity_sold_oz, 'oz');
      console.log('     - Type:', inv.transaction_type);
      console.log('     - Final fine oz:', inv.final_fine_oz);
    });
  } else {
    console.log('\n✅ KGM a du stock disponible!');
    console.log('   Le système devrait afficher ' + totalAvailable.toFixed(3) + ' oz');
  }

  // 5. Check all inventory regardless of links
  console.log('\n--- VÉRIFICATION GLOBALE: Tout l\'inventaire ---');
  const { data: allInv } = await supabase
    .from('gold_inventory')
    .select('id, quantity_available_oz, freight_shipment_id, transaction_type')
    .gt('quantity_available_oz', 0);

  if (allInv && allInv.length > 0) {
    console.log('✅ ' + allInv.length + ' entrée(s) d\'inventaire avec stock dans la DB');
    const total = allInv.reduce((sum, inv) => sum + parseFloat(inv.quantity_available_oz), 0);
    console.log('   Total global: ' + total.toFixed(3) + ' oz');

    console.log('\n   Détail:');
    allInv.forEach(inv => {
      const shipmentId = inv.freight_shipment_id ? inv.freight_shipment_id.substring(0, 8) + '...' : 'NULL';
      console.log('   - ' + inv.quantity_available_oz + ' oz (type: ' + inv.transaction_type + ', shipment: ' + shipmentId + ')');
    });

    // Check if any are from KGM
    if (shipmentIds.length > 0) {
      const kgmInv = allInv.filter(inv => shipmentIds.includes(inv.freight_shipment_id));
      if (kgmInv.length > 0) {
        console.log('\n   ✅ ' + kgmInv.length + ' de ces entrées sont liées à KGM');
      } else {
        console.log('\n   ⚠️  Aucune de ces entrées n\'est liée à KGM');
      }
    }
  } else {
    console.log('❌ Aucun inventaire avec stock dans toute la DB');
  }

  console.log('\n=================================\n');
}

investigateKGM().catch(console.error);
