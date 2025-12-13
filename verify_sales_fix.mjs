import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function verifySalesFix() {
  console.log('\n=== VERIFYING SALES STATUS ENUM FIX ===\n');

  // Step 1: Check if we can query sales table
  console.log('Step 1: Checking sales table...');
  const { data: sales, error: salesError } = await supabase
    .from('sales')
    .select('id, sale_number, status')
    .limit(5);

  if (salesError) {
    console.error('❌ Error querying sales:', salesError.message);
  } else {
    console.log(`✅ Sales table accessible (${sales.length} sales found)`);
    if (sales.length > 0) {
      console.log('Sample statuses:', sales.map(s => s.status).join(', '));
    }
  }

  // Step 2: Try to create a test sale with the correct status
  console.log('\nStep 2: Testing sale creation with workflow status...');

  // Get test data
  const { data: customers } = await supabase
    .from('customers')
    .select('id')
    .limit(1);

  const { data: miningCompanies } = await supabase
    .from('mining_companies')
    .select('id')
    .limit(1);

  if (!customers || customers.length === 0) {
    console.error('❌ No customers found. Please create customers first.');
    console.log('\nTo create test customers, run:');
    console.log('  node seed_customers_for_testing.mjs');
    console.log('\nOr create customers through the application UI.');
    return;
  }

  if (!miningCompanies || miningCompanies.length === 0) {
    console.error('❌ No mining companies found.');
    return;
  }

  const testSale = {
    sale_number: `TEST-VERIFY-${Date.now()}`,
    sale_date: new Date().toISOString().split('T')[0],
    customer_id: customers[0].id,
    seller_id: miningCompanies[0].id,
    seller_type: 'mining_company',
    is_internal_sale: false,
    quantity_oz: 10,
    london_am_rate: 2000,
    freight_cost: 100,
    other_costs: 50,
    gross_proceeds: 20000,
    net_proceeds: 19850,
    royalty_amount: 595.50,
    final_proceeds: 19254.50,
    total_amount: 19254.50,
    currency: 'USD',
    status: 'pending_management_approval', // THIS IS THE KEY TEST
    mechanism_type: null
  };

  console.log('Attempting to create test sale with status="pending_management_approval"...');
  const { data: result, error } = await supabase
    .from('sales')
    .insert([testSale])
    .select();

  if (error) {
    console.error('\n❌ SALE CREATION FAILED');
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);

    if (error.message.includes('invalid input value for enum') ||
        error.message.includes('sale_status')) {
      console.error('\n🔴 THE FIX HAS NOT BEEN APPLIED YET!');
      console.error('\nPlease apply the SQL from CRITICAL_FIX_SALES_STATUS_ENUM.md');
      console.error('in your Supabase SQL Editor.');
    } else if (error.code === '42501') {
      console.error('\n⚠️  RLS Policy Issue: You need to be authenticated to create sales.');
      console.error('This is expected when using the anon key.');
      console.error('The fix IS applied if you don\'t see enum errors.');
    } else {
      console.error('\n⚠️  Different error:', error.message);
    }
  } else {
    console.log('\n✅ SUCCESS! Sale created with workflow status!');
    console.log('Sale number:', result[0].sale_number);
    console.log('Status:', result[0].status);
    console.log('\n🎉 THE FIX IS WORKING CORRECTLY!');

    // Clean up test data
    console.log('\nCleaning up test sale...');
    await supabase.from('sales').delete().eq('id', result[0].id);
    console.log('Test sale removed.');
  }

  console.log('\n=== VERIFICATION COMPLETE ===\n');
}

verifySalesFix().catch(console.error);
