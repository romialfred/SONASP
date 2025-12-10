import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

console.log('🔍 Analysing batch_id issue in inventory tables...\n');

// Try to describe the gold_inventory table
console.log('='.repeat(60));
console.log('1. Testing INSERT on gold_inventory without batch_id');
console.log('='.repeat(60));

const testEntry = {
  entry_date: new Date().toISOString().split('T')[0],
  freight_shipment_id: '00000000-0000-0000-0000-000000000001', // Fake ID for testing
  weight_before_melting_grams: 100,
  weight_after_melting_grams: 95,
  fineness_percentage: 99.5,
  metal_retained_percentage: 95,
  transaction_type: 'entry'
};

const { data: insertTest, error: insertError } = await supabase
  .from('gold_inventory')
  .insert(testEntry)
  .select();

if (insertError) {
  console.log('\n❌ INSERT Error detected:');
  console.log('Code:', insertError.code);
  console.log('Message:', insertError.message);
  console.log('Details:', insertError.details);
  console.log('Hint:', insertError.hint);

  if (insertError.message.includes('batch_id')) {
    console.log('\n🔥 CONFIRMED: batch_id column is the problem!');
    console.log('The column likely has a NOT NULL constraint or a default value issue.');
  }
} else {
  console.log('✅ INSERT succeeded (test entry created):', insertTest);
  // Clean up test entry
  if (insertTest && insertTest[0]) {
    await supabase.from('gold_inventory').delete().eq('id', insertTest[0].id);
    console.log('🧹 Test entry cleaned up');
  }
}

// Check if the table has batch_id in its schema by attempting a select
console.log('\n' + '='.repeat(60));
console.log('2. Checking if batch_id column exists');
console.log('='.repeat(60));

const { data: selectTest, error: selectError } = await supabase
  .from('gold_inventory')
  .select('id, batch_id')
  .limit(1);

if (selectError) {
  if (selectError.message.includes('batch_id') && selectError.code === '42703') {
    console.log('\n✅ GOOD: batch_id column does NOT exist in table');
  } else {
    console.log('\n❓ Unexpected error:', selectError.message);
  }
} else {
  console.log('\n⚠️  WARNING: batch_id column STILL EXISTS in table!');
  console.log('This is the root cause of the problem.');
}

// Check inventory_transactions table
console.log('\n' + '='.repeat(60));
console.log('3. Checking inventory_transactions for batch_id');
console.log('='.repeat(60));

const { data: transSelectTest, error: transSelectError } = await supabase
  .from('inventory_transactions')
  .select('id, batch_id')
  .limit(1);

if (transSelectError) {
  if (transSelectError.message.includes('batch_id') && transSelectError.code === '42703') {
    console.log('\n✅ GOOD: batch_id column does NOT exist in inventory_transactions');
  } else {
    console.log('\n❓ Unexpected error:', transSelectError.message);
  }
} else {
  console.log('\n⚠️  WARNING: batch_id column STILL EXISTS in inventory_transactions!');
}

console.log('\n' + '='.repeat(60));
console.log('Analysis complete!');
console.log('='.repeat(60));
