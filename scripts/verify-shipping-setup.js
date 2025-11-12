import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifySetup() {
  console.log('🔍 Vérification de la configuration du système de shipping...\n');

  let allChecks = true;

  // 1. Check tables existence
  console.log('📋 Vérification des tables...');
  const tables = [
    'shipping_preparations',
    'shipping_production_items',
    'shipping_signatories',
    'shipping_ingots',
    'shipping_documents'
  ];

  for (const table of tables) {
    try {
      const { error } = await supabase.from(table).select('id').limit(1);
      if (error) {
        console.log(`   ❌ Table "${table}" - ERREUR: ${error.message}`);
        allChecks = false;
      } else {
        console.log(`   ✅ Table "${table}" - OK`);
      }
    } catch (error) {
      console.log(`   ❌ Table "${table}" - EXCEPTION: ${error.message}`);
      allChecks = false;
    }
  }

  // 2. Check storage bucket
  console.log('\n📦 Vérification du bucket de stockage...');
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    if (error) {
      console.log(`   ❌ Impossible de lister les buckets: ${error.message}`);
      allChecks = false;
    } else {
      const shippingBucket = buckets?.find(b => b.name === 'shipping-documents');
      if (shippingBucket) {
        console.log(`   ✅ Bucket "shipping-documents" - OK`);
        console.log(`      - Public: ${shippingBucket.public ? 'Oui' : 'Non'}`);
      } else {
        console.log(`   ❌ Bucket "shipping-documents" - NON TROUVÉ`);
        allChecks = false;
      }
    }
  } catch (error) {
    console.log(`   ❌ Erreur lors de la vérification du bucket: ${error.message}`);
    allChecks = false;
  }

  // 3. Test insert permissions
  console.log('\n🔐 Test des permissions (RLS)...');
  try {
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) {
      console.log('   ⚠️  Aucun utilisateur authentifié - Test de permissions ignoré');
    } else {
      console.log(`   ℹ️  Utilisateur authentifié: ${user.user.email}`);

      // Test insert on shipping_preparations
      const testData = {
        expedition_lot_number: `TEST-${Date.now()}`,
        status: 'pending'
      };

      const { data, error } = await supabase
        .from('shipping_preparations')
        .insert(testData)
        .select()
        .single();

      if (error) {
        console.log(`   ❌ Impossible d'insérer des données de test: ${error.message}`);
        allChecks = false;
      } else {
        console.log(`   ✅ Permissions INSERT - OK`);

        // Clean up test data
        await supabase.from('shipping_preparations').delete().eq('id', data.id);
        console.log(`   ✅ Permissions DELETE - OK`);
      }
    }
  } catch (error) {
    console.log(`   ❌ Erreur lors du test des permissions: ${error.message}`);
    allChecks = false;
  }

  // 4. Check for daily_production table (dependency)
  console.log('\n🔗 Vérification des dépendances...');
  try {
    const { error } = await supabase.from('daily_production').select('id').limit(1);
    if (error) {
      console.log(`   ❌ Table "daily_production" - ${error.message}`);
      console.log('      Note: Cette table est requise pour le système de shipping');
      allChecks = false;
    } else {
      console.log(`   ✅ Table "daily_production" - OK`);
    }
  } catch (error) {
    console.log(`   ❌ Table "daily_production" - ${error.message}`);
    allChecks = false;
  }

  // Final summary
  console.log('\n' + '='.repeat(60));
  if (allChecks) {
    console.log('✅ CONFIGURATION COMPLÈTE - Le système de shipping est prêt!');
    console.log('\n🎉 Vous pouvez maintenant utiliser la fonctionnalité de');
    console.log('   préparation des expéditions sans erreur.');
  } else {
    console.log('❌ CONFIGURATION INCOMPLÈTE - Actions requises:');
    console.log('\n📖 Consultez le fichier: SHIPPING_SETUP_INSTRUCTIONS.md');
    console.log('   pour les instructions détaillées de configuration.');
  }
  console.log('='.repeat(60));

  process.exit(allChecks ? 0 : 1);
}

verifySetup();
