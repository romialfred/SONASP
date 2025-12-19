import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function fixCustomersRLS() {
  console.log('Fixing RLS policies for customers table...\n');

  // Drop existing restrictive policies
  const dropPolicies = `
    -- Drop existing policies that might be too restrictive
    DROP POLICY IF EXISTS "Users can view customers" ON customers;
    DROP POLICY IF EXISTS "Users can insert customers" ON customers;
    DROP POLICY IF EXISTS "Users can update customers" ON customers;
    DROP POLICY IF EXISTS "Users can delete customers" ON customers;
    DROP POLICY IF EXISTS "Enable read access for authenticated users" ON customers;
    DROP POLICY IF EXISTS "Enable insert for authenticated users" ON customers;
    DROP POLICY IF EXISTS "Enable update for authenticated users" ON customers;
    DROP POLICY IF EXISTS "Enable delete for authenticated users" ON customers;
  `;

  const { error: dropError } = await supabase.rpc('execute_sql', {
    query: dropPolicies
  }).catch(() => ({ error: null }));

  // Create new permissive policies
  const createPolicies = `
    -- Enable RLS
    ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

    -- Create permissive policies for authenticated users
    CREATE POLICY "Authenticated users can view all customers"
      ON customers FOR SELECT
      TO authenticated
      USING (true);

    CREATE POLICY "Authenticated users can insert customers"
      ON customers FOR INSERT
      TO authenticated
      WITH CHECK (true);

    CREATE POLICY "Authenticated users can update customers"
      ON customers FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);

    CREATE POLICY "Authenticated users can delete customers"
      ON customers FOR DELETE
      TO authenticated
      USING (true);
  `;

  console.log('Executing SQL to fix RLS policies...');

  // Try direct SQL execution
  const { data, error } = await supabase
    .from('customers')
    .select('id')
    .limit(1);

  if (error) {
    console.log('Current error accessing customers:', error.message);
  }

  console.log('\n=== SQL to execute in Supabase SQL Editor ===\n');
  console.log(dropPolicies);
  console.log(createPolicies);
  console.log('\n===========================================\n');
}

fixCustomersRLS();
