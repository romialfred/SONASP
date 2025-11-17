import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkProductions() {
  console.log('\n=== DIAGNOSTIC FREIGHT & CUSTOMS ===\n');

  // 1. Vérifier les tables freight
  console.log('1. Vérification des tables freight...');
  const { data: tables, error: tablesError } = await supabase
    .from('freight_shipments')
    .select('id')
    .limit(1);

  if (tablesError) {
    console.error('❌ Erreur: Tables freight non trouvées');
    console.error(tablesError);
    return;
  }
  console.log('✅ Tables freight existent\n');

  // 2. Compter les productions par statut
  console.log('2. Productions par statut:');
  const { data: statusCounts, error: statusError } = await supabase
    .from('daily_production')
    .select('status');

  if (statusError) {
    console.error('❌ Erreur lors de la lecture des productions:', statusError);
    return;
  }

  const counts = {};
  statusCounts.forEach(row => {
    counts[row.status] = (counts[row.status] || 0) + 1;
  });

  Object.entries(counts).forEach(([status, count]) => {
    console.log(`  - ${status}: ${count}`);
  });

  // 3. Lister les productions ready_for_customs
  console.log('\n3. Productions avec statut "ready_for_customs":');
  const { data: readyProductions, error: readyError } = await supabase
    .from('daily_production')
    .select(`
      id,
      bar_reference,
      status,
      production_date,
      bullion_grams,
      estimated_oz,
      mining_companies:mining_company_id(name)
    `)
    .eq('status', 'ready_for_customs')
    .limit(10);

  if (readyError) {
    console.error('❌ Erreur:', readyError);
    return;
  }

  if (!readyProductions || readyProductions.length === 0) {
    console.log('  ⚠️ Aucune production avec statut "ready_for_customs"');
    console.log('     Les productions doivent passer au statut "ready_for_customs"');
    console.log('     depuis le module Shipping Preparation');
  } else {
    console.log(`  ✅ ${readyProductions.length} production(s) trouvée(s):\n`);
    readyProductions.forEach(prod => {
      console.log(`  - ${prod.bar_reference}`);
      console.log(`    Date: ${new Date(prod.production_date).toLocaleDateString('fr-FR')}`);
      console.log(`    Compagnie: ${prod.mining_companies?.name || 'N/A'}`);
      console.log(`    Poids: ${prod.bullion_grams} g / ${prod.estimated_oz} oz`);
      console.log(`    ID: ${prod.id}\n`);
    });
  }

  // 4. Vérifier les productions déjà assignées
  console.log('4. Productions déjà assignées à une expédition freight:');
  const { data: assignedProductions, error: assignedError } = await supabase
    .from('freight_shipment_productions')
    .select('production_id');

  if (assignedError) {
    console.log('  ℹ️ Table vide ou erreur:', assignedError.message);
  } else {
    console.log(`  ${assignedProductions?.length || 0} production(s) déjà assignée(s)\n`);
  }

  // 5. Proposer une solution
  console.log('=== SOLUTION ===\n');
  if (!readyProductions || readyProductions.length === 0) {
    console.log('Pour avoir des productions disponibles dans Freight & Customs:');
    console.log('1. Allez dans le module "Shipping Preparation"');
    console.log('2. Sélectionnez une expédition avec des productions');
    console.log('3. Changez le statut vers "Prêt pour Expédition" (ready_for_expedition)');
    console.log('4. Cela mettra automatiquement les productions à "ready_for_customs"');
    console.log('5. Retournez dans Freight & Customs pour les voir\n');
  } else {
    console.log('✅ Des productions sont disponibles!');
    console.log('   Actualisez la page Freight & Customs pour les voir.\n');
  }
}

checkProductions().catch(console.error);
