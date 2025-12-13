import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkSalesSchema() {
  console.log('\n=== CHECKING SALES TABLE SCHEMA ===\n');

  // Query the information schema to get column details
  const { data, error } = await supabase
    .rpc('exec_sql', {
      sql_query: `
        SELECT
          column_name,
          data_type,
          is_nullable,
          column_default,
          character_maximum_length
        FROM information_schema.columns
        WHERE table_name = 'sales'
        ORDER BY ordinal_position;
      `
    });

  if (error) {
    console.error('Error fetching schema:', error);

    // Try alternative method
    console.log('\nTrying direct query...');
    const { data: testData, error: testError } = await supabase
      .from('sales')
      .select('*')
      .limit(1);

    if (testError) {
      console.error('Error querying sales:', testError);
    } else {
      console.log('Sample sale structure:', testData?.[0] ? Object.keys(testData[0]) : 'No sales found');
    }
    return;
  }

  console.log('Sales table columns:');
  console.log('====================');
  data.forEach(col => {
    console.log(`${col.column_name.padEnd(30)} | ${col.data_type.padEnd(20)} | ${col.is_nullable} | ${col.column_default || 'NULL'}`);
  });

  // Check for specific columns we need
  const columnNames = data.map(col => col.column_name);
  const requiredColumns = [
    'seller_id',
    'seller_type',
    'is_internal_sale',
    'royalty_amount',
    'customer_id',
    'quantity_oz',
    'london_am_rate',
    'gross_proceeds',
    'net_proceeds',
    'final_proceeds',
    'sale_number',
    'status'
  ];

  console.log('\n=== REQUIRED COLUMNS CHECK ===\n');
  requiredColumns.forEach(col => {
    const exists = columnNames.includes(col);
    console.log(`${col.padEnd(30)} ${exists ? '✓ EXISTS' : '✗ MISSING'}`);
  });

  // Try to insert a test sale to see what error we get
  console.log('\n=== TESTING INSERT ===\n');

  // First, get a valid customer_id and mining_company_id
  const { data: customers } = await supabase
    .from('customers')
    .select('id')
    .limit(1);

  const { data: miningCompanies } = await supabase
    .from('mining_companies')
    .select('id')
    .limit(1);

  if (!customers?.[0] || !miningCompanies?.[0]) {
    console.log('Cannot test insert: No customer or mining company found');
    return;
  }

  const testSale = {
    sale_number: 'TEST-2024-999',
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
    status: 'pending_approval'
  };

  console.log('Attempting to insert test sale...');
  const { data: insertResult, error: insertError } = await supabase
    .from('sales')
    .insert([testSale])
    .select();

  if (insertError) {
    console.error('INSERT FAILED:', insertError);
    console.error('Error details:', JSON.stringify(insertError, null, 2));
  } else {
    console.log('INSERT SUCCESS:', insertResult);

    // Clean up test data
    if (insertResult?.[0]?.id) {
      await supabase
        .from('sales')
        .delete()
        .eq('id', insertResult[0].id);
      console.log('Test sale cleaned up');
    }
  }
}

checkSalesSchema().catch(console.error);
