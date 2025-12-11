import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testExactInsert() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('TEST INSERTION EXACTE COMME DANS SALECREATE.TSX');
  console.log('═══════════════════════════════════════════════════════\n');

  // Récupérer les données nécessaires
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

  const { data: authUser } = await supabase.auth.getUser();

  if (!customer || !miningCompany) {
    console.error('❌ Pas de données de test (customer ou mining_company manquant)');
    return;
  }

  console.log('Customer ID:', customer.id);
  console.log('Mining Company ID:', miningCompany.id);
  console.log('Auth User ID:', authUser.user?.id || 'undefined');
  console.log();

  // EXACT DATA STRUCTURE FROM SaleCreate.tsx line 459-478
  const exactData = {
    sale_number: 'SL-2025-999',
    sale_date: new Date().toISOString().split('T')[0],
    customer_id: customer.id,
    seller_id: miningCompany.id,
    seller_type: 'mining_company',
    quantity_oz: 390,
    london_am_rate: 4007,
    freight_cost: 0,
    other_costs: 0,
    gross_proceeds: 1562664,
    net_proceeds: 1562664,
    royalties: 46880,
    final_proceeds: 1515784,
    total_amount: 1515784,
    currency: 'USD',
    status: 'pending_management_approval',
    mechanism_type: null,
    created_by: authUser.user?.id || null
  };

  console.log('📊 DATA À INSÉRER:');
  console.log(JSON.stringify(exactData, null, 2));
  console.log();

  // Test avec toutes les colonnes
  console.log('🧪 Test 1: Insertion complète\n');
  const { data: result1, error: error1 } = await supabase
    .from('sales')
    .insert([exactData])
    .select()
    .single();

  if (error1) {
    console.error('❌ ERREUR D\'INSERTION:');
    console.error('Message:', error1.message);
    console.error('Code:', error1.code);
    console.error('Details:', error1.details);
    console.error('Hint:', error1.hint);
    console.error('\nErreur complète:', JSON.stringify(error1, null, 2));
  } else {
    console.log('✅ Insertion RÉUSSIE!');
    console.log('Sale créée:', result1);

    // Nettoyer
    await supabase.from('sales').delete().eq('id', result1.id);
    console.log('Test nettoyé');
  }

  // Test sans created_by
  console.log('\n🧪 Test 2: Sans created_by\n');
  const dataWithoutCreatedBy = { ...exactData, sale_number: 'SL-2025-998' };
  delete dataWithoutCreatedBy.created_by;

  const { data: result2, error: error2 } = await supabase
    .from('sales')
    .insert([dataWithoutCreatedBy])
    .select()
    .single();

  if (error2) {
    console.error('❌ ERREUR:', error2.message);
  } else {
    console.log('✅ Insertion réussie sans created_by');
    await supabase.from('sales').delete().eq('id', result2.id);
    console.log('Test nettoyé');
  }

  // Test avec mechanism_type undefined
  console.log('\n🧪 Test 3: mechanism_type undefined\n');
  const dataWithUndefinedMechanism = {
    ...exactData,
    sale_number: 'SL-2025-997',
    mechanism_type: undefined
  };

  const { data: result3, error: error3 } = await supabase
    .from('sales')
    .insert([dataWithUndefinedMechanism])
    .select()
    .single();

  if (error3) {
    console.error('❌ ERREUR:', error3.message);
  } else {
    console.log('✅ Insertion réussie avec mechanism_type undefined');
    await supabase.from('sales').delete().eq('id', result3.id);
    console.log('Test nettoyé');
  }

  // Vérifier les triggers sur la table
  console.log('\n🔍 VÉRIFICATION DES TRIGGERS SUR LA TABLE SALES\n');

  const { data: triggers, error: trigError } = await supabase
    .rpc('exec_sql', {
      sql_query: `
        SELECT tgname, tgtype, proname
        FROM pg_trigger t
        JOIN pg_proc p ON t.tgfoid = p.oid
        WHERE tgrelid = 'sales'::regclass
        AND tgisinternal = false;
      `
    })
    .single();

  if (trigError && trigError.code !== 'PGRST202') {
    console.log('❌ Erreur triggers:', trigError.message);
  } else if (triggers) {
    console.log('Triggers trouvés:', triggers);
  } else {
    console.log('✅ Pas de triggers personnalisés sur sales');
  }

  console.log('\n═══════════════════════════════════════════════════════');
}

testExactInsert().catch(console.error);
