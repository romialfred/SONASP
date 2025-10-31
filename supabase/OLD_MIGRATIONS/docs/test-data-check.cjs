/**
 * Test Data Check Script
 * Run this to verify test data in Supabase
 * Usage: node test-data-check.cjs
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read .env file
const envPath = path.join(__dirname, '.env');
const envFile = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    envVars[key.trim()] = valueParts.join('=').trim();
  }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseKey = envVars.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAndCreateTestData() {
  console.log('🔍 Checking database for test data...\n');

  // 1. Check batches
  const { data: batches, error: batchError } = await supabase
    .from('batches')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (batchError) {
    console.error('❌ Error fetching batches:', batchError.message);
  } else {
    console.log(`📦 Found ${batches.length} batches`);

    if (batches.length > 0) {
      console.log('\nBatch Statuses:');
      const statusCounts = {};
      batches.forEach(b => {
        statusCounts[b.status] = (statusCounts[b.status] || 0) + 1;
      });
      Object.entries(statusCounts).forEach(([status, count]) => {
        console.log(`  - ${status}: ${count}`);
      });

      console.log('\nRecent Batches:');
      batches.slice(0, 5).forEach(b => {
        console.log(`  • ${b.batch_number} - Status: ${b.status} - Weight: ${b.weight_grams}g`);
      });
    }
  }

  // 2. Check for receiving-related batches
  const { data: receivingBatches, error: receivingError } = await supabase
    .from('batches')
    .select('*')
    .in('status', [
      'validated_for_transport',
      'in_transit_to_airport',
      'received_airport',
      'customs_clearance',
      'ready_for_refinery'
    ]);

  if (!receivingError) {
    console.log(`\n🚢 Batches for Shipping/Receiving page: ${receivingBatches.length}`);
    if (receivingBatches.length > 0) {
      receivingBatches.forEach(b => {
        console.log(`  • ${b.batch_number} - ${b.status}`);
      });
    }
  }

  // 3. Check for refining-related batches
  const { data: refiningBatches, error: refiningError } = await supabase
    .from('batches')
    .select('*')
    .in('status', ['received_refinery', 'processing', 'ready_for_sale']);

  if (!refiningError) {
    console.log(`\n🔥 Batches for Refining page: ${refiningBatches.length}`);
    if (refiningBatches.length > 0) {
      refiningBatches.forEach(b => {
        console.log(`  • ${b.batch_number} - ${b.status}`);
      });
    }
  }

  // 4. Check refining records
  const { data: refiningRecords, error: refiningRecordsError } = await supabase
    .from('refining_records')
    .select('*');

  if (!refiningRecordsError) {
    console.log(`\n🔬 Refining records: ${refiningRecords.length}`);
  }

  // 5. Check customers
  const { data: customers, error: customersError } = await supabase
    .from('customers')
    .select('name, email, is_active')
    .eq('is_active', true);

  if (!customersError) {
    console.log(`\n👥 Active customers: ${customers.length}`);
    if (customers.length > 0) {
      customers.slice(0, 3).forEach(c => {
        console.log(`  • ${c.name} (${c.email})`);
      });
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Batches: ${batches?.length || 0}`);
  console.log(`Shipping/Receiving Batches: ${receivingBatches?.length || 0}`);
  console.log(`Refining Batches: ${refiningBatches?.length || 0}`);
  console.log(`Refining Records: ${refiningRecords?.length || 0}`);
  console.log(`Active Customers: ${customers?.length || 0}`);
  console.log('='.repeat(60));

  if (batches?.length === 0) {
    console.log('\n⚠️  No batches found!');
    console.log('📝 Please run the migration files in Supabase SQL Editor:');
    console.log('   1. First: 20251027180000_add_comprehensive_test_data_customers_fx.sql');
    console.log('   2. Then:  20251027190000_add_complete_platform_test_data.sql');
  } else if (receivingBatches?.length === 0 && refiningBatches?.length === 0) {
    console.log('\n⚠️  No batches with shipping/refining statuses found!');
    console.log('💡 The batches exist but may have different statuses.');
    console.log('   Run migration 20251027190000 to create batches with correct statuses.');
  } else {
    console.log('\n✅ Test data looks good! Pages should display data now.');
  }
}

checkAndCreateTestData().catch(console.error);
