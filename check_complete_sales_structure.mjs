import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkCompleteSalesStructure() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('ANALYSE COMPLÈTE DE LA TABLE SALES');
  console.log('═══════════════════════════════════════════════════════\n');

  // 1. Vérifier la table sales existe
  console.log('1️⃣ VÉRIFICATION TABLE SALES\n');
  const { data: tableCheck, error: tableError } = await supabase
    .from('sales')
    .select('id')
    .limit(1);

  if (tableError) {
    console.error('❌ Table sales n\'existe pas ou erreur:', tableError);
    return;
  }
  console.log('✅ Table sales existe\n');

  // 2. Tester les status possibles
  console.log('2️⃣ TEST DES STATUS ENUM\n');
  const statusesToTest = [
    'create_sales',
    'pending_management_approval',
    'management_approved',
    'management_rejected',
    'pending_for_customer_approval',
    'customer_approved',
    'customer_rejected',
    'waiting_for_payment',
    'virtual_payment',
    'payment_received',
    'completed',
    'in_sale',
    'sold',
    'cancelled'
  ];

  const validStatuses = [];
  const invalidStatuses = [];

  for (const status of statusesToTest) {
    const { error } = await supabase
      .from('sales')
      .select('id')
      .eq('status', status)
      .limit(1);

    if (!error) {
      validStatuses.push(status);
      console.log(`✅ Status "${status}" est valide`);
    } else {
      invalidStatuses.push(status);
      console.log(`❌ Status "${status}" est INVALIDE`);
    }
  }

  console.log('\n══════════════════════════════════════════════════════');
  console.log(`Status valides: ${validStatuses.length}/${statusesToTest.length}`);
  console.log(`Status invalides: ${invalidStatuses.length}/${statusesToTest.length}`);
  console.log('══════════════════════════════════════════════════════\n');

  // 3. Tester une insertion
  console.log('3️⃣ TEST D\'INSERTION DANS LA TABLE SALES\n');

  // Récupérer un customer et un mining_company pour le test
  const { data: customer } = await supabase
    .from('customers')
    .select('id')
    .limit(1)
    .maybeSingle();

  const { data: miningCompany } = await supabase
    .from('mining_companies')
    .select('id')
    .limit(1)
    .maybeSingle();

  if (!customer || !miningCompany) {
    console.log('⚠️  Pas de données de test disponibles (customer ou mining_company manquant)');
  } else {
    console.log('Customer ID:', customer.id);
    console.log('Mining Company ID:', miningCompany.id);

    // Test 1: Avec pending_management_approval
    console.log('\nTest 1: Insertion avec status "pending_management_approval"');
    const testData1 = {
      sale_number: 'TEST-001',
      sale_date: new Date().toISOString().split('T')[0],
      customer_id: customer.id,
      seller_id: miningCompany.id,
      seller_type: 'mining_company',
      quantity_oz: 100,
      london_am_rate: 2700,
      freight_cost: 0,
      other_costs: 0,
      gross_proceeds: 270000,
      net_proceeds: 270000,
      royalties: 8100,
      final_proceeds: 261900,
      total_amount: 261900,
      currency: 'USD',
      status: 'pending_management_approval'
    };

    const { data: result1, error: error1 } = await supabase
      .from('sales')
      .insert([testData1])
      .select();

    if (error1) {
      console.error('❌ ERREUR:', error1.message);
      console.error('Code:', error1.code);
      console.error('Details:', error1.details);
      console.error('Hint:', error1.hint);
    } else {
      console.log('✅ Insertion réussie avec pending_management_approval');
      // Supprimer le test
      await supabase.from('sales').delete().eq('sale_number', 'TEST-001');
      console.log('Test nettoyé');
    }

    // Test 2: Avec in_sale (ancien status)
    console.log('\nTest 2: Insertion avec status "in_sale"');
    const testData2 = {
      ...testData1,
      sale_number: 'TEST-002',
      status: 'in_sale'
    };

    const { data: result2, error: error2 } = await supabase
      .from('sales')
      .insert([testData2])
      .select();

    if (error2) {
      console.error('❌ ERREUR:', error2.message);
    } else {
      console.log('✅ Insertion réussie avec in_sale');
      await supabase.from('sales').delete().eq('sale_number', 'TEST-002');
      console.log('Test nettoyé');
    }
  }

  // 4. Vérifier les colonnes nécessaires
  console.log('\n4️⃣ VÉRIFICATION DES COLONNES REQUISES\n');

  const requiredColumns = [
    'id', 'sale_number', 'sale_date', 'customer_id', 'seller_id',
    'seller_type', 'quantity_oz', 'london_am_rate', 'freight_cost',
    'other_costs', 'gross_proceeds', 'net_proceeds', 'royalties',
    'final_proceeds', 'total_amount', 'currency', 'status', 'created_by',
    'created_at', 'updated_at'
  ];

  // On ne peut pas lister les colonnes directement avec Supabase client
  // donc on essaie un select avec toutes les colonnes
  const selectQuery = requiredColumns.join(', ');
  const { error: selectError } = await supabase
    .from('sales')
    .select(selectQuery)
    .limit(0);

  if (selectError) {
    console.error('❌ Certaines colonnes sont manquantes:', selectError.message);
  } else {
    console.log('✅ Toutes les colonnes requises existent');
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('RÉSUMÉ');
  console.log('═══════════════════════════════════════════════════════');
  console.log('Status valides:', validStatuses.join(', '));
  if (invalidStatuses.length > 0) {
    console.log('\n⚠️  Status MANQUANTS à ajouter:');
    console.log(invalidStatuses.join(', '));
    console.log('\n🔧 ACTION REQUISE:');
    console.log('   Exécuter ADD_SALES_WORKFLOW_STATUSES.sql dans Supabase');
  } else {
    console.log('\n✅ Tous les status sont configurés correctement!');
  }
  console.log('═══════════════════════════════════════════════════════');
}

checkCompleteSalesStructure().catch(console.error);
