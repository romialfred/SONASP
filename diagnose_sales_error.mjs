import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function diagnoseSalesError() {
  console.log('\n=== DIAGNOSING SALES CREATION ERROR ===\n');

  // Step 1: Check if we can query the sales table at all
  console.log('Step 1: Checking sales table accessibility...');
  const { data: salesData, error: salesError } = await supabase
    .from('sales')
    .select('*')
    .limit(1);

  if (salesError) {
    console.error('❌ Cannot query sales table:', salesError);
  } else {
    console.log('✓ Sales table is accessible');
    if (salesData && salesData.length > 0) {
      console.log('Sample sale columns:', Object.keys(salesData[0]));
    } else {
      console.log('No existing sales found');
    }
  }

  // Step 2: Get valid IDs for testing
  console.log('\nStep 2: Getting valid test data...');

  const { data: customers, error: customersError } = await supabase
    .from('customers')
    .select('id, name')
    .limit(5);

  if (customersError) {
    console.error('❌ Cannot query customers:', customersError);
  } else {
    console.log(`✓ Found ${customers?.length || 0} customers`);
    if (customers && customers.length > 0) {
      console.log('Sample customer:', customers[0]);
    }
  }

  const { data: miningCompanies, error: mcError } = await supabase
    .from('mining_companies')
    .select('id, name')
    .limit(5);

  if (mcError) {
    console.error('❌ Cannot query mining companies:', mcError);
  } else {
    console.log(`✓ Found ${miningCompanies?.length || 0} mining companies`);
    if (miningCompanies && miningCompanies.length > 0) {
      console.log('Sample mining company:', miningCompanies[0]);
    }
  }

  if (!customers?.[0] || !miningCompanies?.[0]) {
    console.error('\n❌ Missing required data for testing');
    return;
  }

  // Step 3: Try to insert with minimal data first
  console.log('\n=== Step 3: Testing INSERT with minimal data ===\n');

  const minimalSale = {
    sale_number: `TEST-MIN-${Date.now()}`,
    customer_id: customers[0].id,
    seller_id: miningCompanies[0].id,
    seller_type: 'mining_company',
    quantity_oz: 10,
    london_am_rate: 2000,
    status: 'pending_approval'
  };

  console.log('Attempting minimal insert:', minimalSale);
  const { data: minResult, error: minError } = await supabase
    .from('sales')
    .insert([minimalSale])
    .select();

  if (minError) {
    console.error('❌ Minimal insert FAILED:', minError);
    console.error('Error code:', minError.code);
    console.error('Error message:', minError.message);
    console.error('Error details:', minError.details);
    console.error('Error hint:', minError.hint);
  } else {
    console.log('✓ Minimal insert SUCCESS!');
    // Clean up
    if (minResult?.[0]?.id) {
      await supabase.from('sales').delete().eq('id', minResult[0].id);
    }
  }

  // Step 4: Try full insert like in the app
  console.log('\n=== Step 4: Testing INSERT with full data (like app) ===\n');

  const fullSale = {
    sale_number: `TEST-FULL-${Date.now()}`,
    sale_date: new Date().toISOString().split('T')[0],
    customer_id: customers[0].id,
    seller_id: miningCompanies[0].id,
    seller_type: 'mining_company',
    is_internal_sale: false,
    quantity_oz: 10.5,
    london_am_rate: 2000,
    freight_cost: 100,
    other_costs: 50,
    gross_proceeds: 21000,
    net_proceeds: 20850,
    royalty_amount: 625.50,
    final_proceeds: 20224.50,
    total_amount: 20224.50,
    currency: 'USD',
    status: 'pending_approval',
    mechanism_type: null
  };

  console.log('Attempting full insert...');
  const { data: fullResult, error: fullError } = await supabase
    .from('sales')
    .insert([fullSale])
    .select();

  if (fullError) {
    console.error('❌ Full insert FAILED:', fullError);
    console.error('Error code:', fullError.code);
    console.error('Error message:', fullError.message);
    console.error('Error details:', fullError.details);
    console.error('Error hint:', fullError.hint);

    // Check which field is causing the problem
    console.log('\n=== Testing each field individually ===\n');
    const fields = Object.keys(fullSale);
    for (const field of fields) {
      if (field === 'sale_number' || field === 'customer_id' || field === 'seller_id' || field === 'status') {
        continue; // Skip required fields
      }

      const testData = {
        sale_number: `TEST-FIELD-${field}-${Date.now()}`,
        customer_id: customers[0].id,
        seller_id: miningCompanies[0].id,
        seller_type: 'mining_company',
        quantity_oz: 10,
        london_am_rate: 2000,
        status: 'pending_approval',
        [field]: fullSale[field]
      };

      const { error: fieldError } = await supabase
        .from('sales')
        .insert([testData])
        .select();

      if (fieldError) {
        console.log(`❌ Field "${field}" causes error:`, fieldError.message);
      } else {
        console.log(`✓ Field "${field}" is OK`);
        // Clean up
        await supabase.from('sales').delete().eq('sale_number', testData.sale_number);
      }
    }

  } else {
    console.log('✓ Full insert SUCCESS!');
    console.log('Result:', fullResult);
    // Clean up
    if (fullResult?.[0]?.id) {
      await supabase.from('sales').delete().eq('id', fullResult[0].id);
    }
  }

  // Step 5: Check RLS policies
  console.log('\n=== Step 5: Checking authentication ===\n');
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    console.log('✓ User is authenticated:', user.id);
    console.log('User email:', user.email);
  } else {
    console.log('❌ No authenticated user (using anon key)');
  }
}

diagnoseSalesError().catch(console.error);
