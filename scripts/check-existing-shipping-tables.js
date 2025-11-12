import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkExistingTables() {
  console.log('🔍 Vérification des tables shipping existantes...\n');

  const tables = [
    'shipping_preparations',
    'shipping_production_items',
    'shipping_signatories',
    'shipping_ingots',
    'shipping_documents'
  ];

  let existingTables = [];
  let missingTables = [];

  for (const table of tables) {
    try {
      // Try to query the table
      const { data, error } = await supabase.from(table).select('*').limit(1);

      if (error) {
        if (error.message.includes('does not exist')) {
          console.log(`❌ Table "${table}" - N'EXISTE PAS`);
          missingTables.push(table);
        } else {
          console.log(`⚠️  Table "${table}" - Erreur: ${error.message}`);
        }
      } else {
        console.log(`✅ Table "${table}" - EXISTE`);
        existingTables.push(table);

        // Count rows
        const { count } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });
        console.log(`   └─ Nombre d'enregistrements: ${count || 0}`);
      }
    } catch (error) {
      console.log(`❌ Table "${table}" - Exception: ${error.message}`);
      missingTables.push(table);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 RÉSUMÉ:');
  console.log('='.repeat(60));
  console.log(`✅ Tables existantes: ${existingTables.length}/5`);
  console.log(`❌ Tables manquantes: ${missingTables.length}/5`);

  if (existingTables.length > 0) {
    console.log('\n✅ Tables trouvées:');
    existingTables.forEach(t => console.log(`   - ${t}`));
  }

  if (missingTables.length > 0) {
    console.log('\n❌ Tables manquantes:');
    missingTables.forEach(t => console.log(`   - ${t}`));
  }

  // Check storage bucket
  console.log('\n' + '='.repeat(60));
  console.log('📦 VÉRIFICATION DU BUCKET DE STOCKAGE:');
  console.log('='.repeat(60));

  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    if (error) {
      console.log(`❌ Erreur: ${error.message}`);
    } else {
      const shippingBucket = buckets?.find(b => b.name === 'shipping-documents');
      if (shippingBucket) {
        console.log(`✅ Bucket "shipping-documents" - EXISTE`);
        console.log(`   - Public: ${shippingBucket.public ? 'Oui' : 'Non'}`);
        console.log(`   - ID: ${shippingBucket.id}`);
      } else {
        console.log(`❌ Bucket "shipping-documents" - N'EXISTE PAS`);
      }
    }
  } catch (error) {
    console.log(`❌ Erreur: ${error.message}`);
  }

  console.log('\n' + '='.repeat(60));
  console.log('💡 RECOMMANDATIONS:');
  console.log('='.repeat(60));

  if (existingTables.length === 5 && missingTables.length === 0) {
    console.log('✅ Toutes les tables existent déjà!');
    console.log('\n⚠️  La migration est SÉCURISÉE car elle utilise:');
    console.log('   - CREATE TABLE IF NOT EXISTS (ne créera pas de doublon)');
    console.log('   - DROP POLICY IF EXISTS (remplacera les politiques)');
    console.log('   - CREATE INDEX IF NOT EXISTS (ne créera pas de doublon)');
    console.log('\n🎯 ACTIONS RECOMMANDÉES:');
    console.log('   1. Vérifier si l\'erreur persiste dans l\'application');
    console.log('   2. Si l\'erreur persiste, c\'est probablement un problème de RLS');
    console.log('   3. Vous pouvez appliquer la migration pour mettre à jour les politiques RLS');
    console.log('   4. Aucune donnée ne sera perdue (tables ne seront pas recréées)');
  } else if (existingTables.length > 0 && missingTables.length > 0) {
    console.log('⚠️  Configuration PARTIELLE détectée!');
    console.log('\n🎯 ACTIONS RECOMMANDÉES:');
    console.log('   1. Appliquer la migration complète pour créer les tables manquantes');
    console.log('   2. La migration est sécurisée (IF NOT EXISTS)');
    console.log('   3. Les tables existantes ne seront pas affectées');
  } else {
    console.log('❌ Aucune table shipping n\'existe!');
    console.log('\n🎯 ACTIONS REQUISES:');
    console.log('   1. Appliquer la migration add_shipping_system.sql');
    console.log('   2. Créer le bucket shipping-documents');
  }

  console.log('='.repeat(60));
}

checkExistingTables();
