const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  console.log('🚀 Starting Inventory Status Integrity Migration...\n');

  try {
    const migrationPath = path.join(__dirname, '../supabase/migrations/20251029030000_fix_inventory_status_integrity.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration file loaded successfully\n');
    console.log('=' .repeat(70));
    console.log('STEP 1: Checking current batch statuses');
    console.log('=' .repeat(70));

    const { data: beforeBatches, error: beforeError } = await supabase
      .from('batches')
      .select('id, batch_number, status')
      .in('status', ['processing', 'in_inventory']);

    if (beforeError) throw beforeError;

    console.log(`\n📊 Found ${beforeBatches.length} batches in processing or in_inventory status:`);
    beforeBatches.forEach(batch => {
      console.log(`   • ${batch.batch_number}: ${batch.status}`);
    });

    console.log('\n' + '=' .repeat(70));
    console.log('STEP 2: Checking inventory entries');
    console.log('=' .repeat(70));

    const { data: inventoryEntries, error: invError } = await supabase
      .from('gold_inventory')
      .select('id, batch_id');

    if (invError) throw invError;

    console.log(`\n📦 Found ${inventoryEntries.length} inventory entries`);

    const batchesWithInventory = new Set(inventoryEntries.map(inv => inv.batch_id));

    const inconsistentBatches = beforeBatches.filter(
      batch => batch.status === 'in_inventory' && !batchesWithInventory.has(batch.id)
    );

    if (inconsistentBatches.length > 0) {
      console.log(`\n⚠️  Found ${inconsistentBatches.length} inconsistent batch(es):`);
      inconsistentBatches.forEach(batch => {
        console.log(`   ❌ ${batch.batch_number}: status='in_inventory' but NO inventory entry`);
      });
    } else {
      console.log('\n✅ No inconsistent batches found - all in_inventory batches have entries');
    }

    const processingBatches = beforeBatches.filter(batch => batch.status === 'processing');
    console.log(`\n✅ Found ${processingBatches.length} batch(es) ready for inventory entry:`);
    processingBatches.forEach(batch => {
      console.log(`   • ${batch.batch_number}: status='processing'`);
    });

    console.log('\n' + '=' .repeat(70));
    console.log('STEP 3: Ready to apply migration');
    console.log('=' .repeat(70));
    console.log('\n⚠️  This migration must be applied via Supabase Dashboard SQL Editor');
    console.log('\nPlease:');
    console.log('1. Open: https://boolqagzdqbahqnpawpb.supabase.co/project/_/sql');
    console.log('2. Copy the SQL from: supabase/migrations/20251029030000_fix_inventory_status_integrity.sql');
    console.log('3. Paste and execute in SQL Editor');
    console.log('4. Run this script again to verify\n');

    console.log('=' .repeat(70));
    console.log('PRE-MIGRATION SUMMARY');
    console.log('=' .repeat(70));
    console.log(`\n📊 Current Status:`);
    console.log(`   • Processing batches: ${processingBatches.length}`);
    console.log(`   • In-inventory batches: ${beforeBatches.length - processingBatches.length}`);
    console.log(`   • Inconsistent batches: ${inconsistentBatches.length}`);
    console.log(`\n✅ After migration, all ${inconsistentBatches.length + processingBatches.length} batches will be available for inventory entry!\n`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

applyMigration();
