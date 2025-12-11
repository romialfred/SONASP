import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Test avec SERVICE_ROLE_KEY (bypass RLS)
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Test avec ANON_KEY (avec RLS)
const supabaseAnon = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function testRLSIssue() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('TEST: RLS POLICY vs SERVICE ROLE');
  console.log('═══════════════════════════════════════════════════════\n');

  // Récupérer les données nécessaires
  const { data: customer } = await supabaseAdmin
    .from('customers')
    .select('id')
    .limit(1)
    .maybeSingle();

  const { data: miningCompany } = await supabaseAdmin
    .from('mining_companies')
    .select('id')
    .limit(1)
    .maybeSingle();

  if (!customer || !miningCompany) {
    console.error('❌ Pas de données de test');
    return;
  }

  const testData = {
    sale_number: 'RLS-TEST-001',
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
    status: 'pending_management_approval',
    mechanism_type: null,
    created_by: null
  };

  console.log('📊 DATA À TESTER:');
  console.log('Status envoyé:', testData.status);
  console.log();

  // Test 1: Avec SERVICE_ROLE (bypass RLS)
  console.log('🧪 Test 1: Insertion avec SERVICE_ROLE_KEY (bypass RLS)\n');
  const { data: result1, error: error1 } = await supabaseAdmin
    .from('sales')
    .insert([testData])
    .select()
    .single();

  if (error1) {
    console.error('❌ ERREUR avec SERVICE_ROLE:');
    console.error('Message:', error1.message);
    console.error('Code:', error1.code);
  } else {
    console.log('✅ Insertion RÉUSSIE avec SERVICE_ROLE!');
    console.log('Status dans DB:', result1.status);

    // Nettoyer
    await supabaseAdmin.from('sales').delete().eq('id', result1.id);
    console.log('Test nettoyé\n');
  }

  // Test 2: Avec ANON_KEY (avec RLS)
  console.log('🧪 Test 2: Insertion avec ANON_KEY (avec RLS)\n');

  // D'abord, s'authentifier
  const { data: authData, error: authError } = await supabaseAnon.auth.signInWithPassword({
    email: 'test@example.com',
    password: 'test123'
  });

  if (authError) {
    console.log('⚠️  Pas de compte test, on skip ce test');
    console.log('(Pour tester avec RLS, créer un user test@example.com)');
  } else {
    console.log('✅ Authentifié comme:', authData.user.email);

    const testData2 = {
      ...testData,
      sale_number: 'RLS-TEST-002',
      created_by: authData.user.id
    };

    const { data: result2, error: error2 } = await supabaseAnon
      .from('sales')
      .insert([testData2])
      .select()
      .single();

    if (error2) {
      console.error('❌ ERREUR avec ANON_KEY (RLS actif):');
      console.error('Message:', error2.message);
      console.error('Code:', error2.code);
      console.error('\n🔍 DIAGNOSTIC: Le problème vient probablement des RLS POLICIES!');
    } else {
      console.log('✅ Insertion réussie avec ANON_KEY');
      console.log('Status dans DB:', result2.status);

      await supabaseAdmin.from('sales').delete().eq('id', result2.id);
      console.log('Test nettoyé');
    }

    await supabaseAnon.auth.signOut();
  }

  // Test 3: Vérifier si le status est bien enregistré
  console.log('\n🧪 Test 3: Lecture après insertion\n');

  const testData3 = {
    ...testData,
    sale_number: 'RLS-TEST-003'
  };

  const { data: insertResult, error: insertError } = await supabaseAdmin
    .from('sales')
    .insert([testData3])
    .select('id, sale_number, status')
    .single();

  if (insertError) {
    console.error('❌ Erreur insertion:', insertError.message);
  } else {
    console.log('✅ Insertion OK');
    console.log('ID:', insertResult.id);
    console.log('Status retourné par INSERT:', insertResult.status);

    // Relire depuis la DB
    const { data: readResult } = await supabaseAdmin
      .from('sales')
      .select('id, sale_number, status')
      .eq('id', insertResult.id)
      .single();

    console.log('Status relu depuis DB:', readResult?.status);

    if (insertResult.status !== readResult?.status) {
      console.error('⚠️  WARNING: Status différent entre INSERT et SELECT!');
    }

    // Nettoyer
    await supabaseAdmin.from('sales').delete().eq('id', insertResult.id);
    console.log('Test nettoyé');
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('CONCLUSION');
  console.log('═══════════════════════════════════════════════════════');
  console.log('Si le Test 1 (SERVICE_ROLE) fonctionne mais pas Test 2 (ANON):');
  console.log('  → Le problème vient des RLS POLICIES');
  console.log('  → Il faut corriger les policies WITH CHECK sur la table sales');
  console.log('\nSi aucun test ne fonctionne:');
  console.log('  → Le problème vient d\'une contrainte ou DEFAULT sur status');
  console.log('═══════════════════════════════════════════════════════');
}

testRLSIssue().catch(console.error);
