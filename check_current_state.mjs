import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkCurrentState() {
  console.log('\n🔍 VÉRIFICATION DE L\'ÉTAT ACTUEL\n');
  console.log('='.repeat(60));

  try {
    // Check if batch_id column exists
    const { data: columns, error: colError } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'inventory_transactions'
        ORDER BY ordinal_position;
      `
    });

    if (colError) {
      console.error('❌ Erreur lors de la vérification des colonnes:', colError);
      return;
    }

    console.log('\n📋 Colonnes de inventory_transactions:');
    console.log('-'.repeat(60));
    columns.forEach(col => {
      const marker = col.column_name === 'batch_id' ? '❌' :
                     col.column_name === 'freight_shipment_id' ? '✅' : '  ';
      console.log(`${marker} ${col.column_name.padEnd(30)} ${col.data_type.padEnd(15)} ${col.is_nullable}`);
    });

    const hasBatchId = columns.some(col => col.column_name === 'batch_id');
    const hasFreightId = columns.some(col => col.column_name === 'freight_shipment_id');

    console.log('\n' + '='.repeat(60));
    console.log('\n🎯 RÉSULTAT:');
    console.log(`   batch_id existe: ${hasBatchId ? '❌ OUI (PROBLÈME!)' : '✅ NON (BON)'}`);
    console.log(`   freight_shipment_id existe: ${hasFreightId ? '✅ OUI (BON)' : '❌ NON (PROBLÈME!)'}`);

    if (hasBatchId) {
      console.log('\n⚠️  LA MIGRATION N\'A PAS ÉTÉ APPLIQUÉE CORRECTEMENT!');
      console.log('   La colonne batch_id existe toujours dans la base de données.');
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

checkCurrentState();
