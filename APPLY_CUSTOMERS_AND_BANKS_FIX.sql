/*
  ============================================
  COMPLETE FIX FOR CUSTOMERS AND CUSTOMER_BANKS TABLES
  ============================================

  This fixes RLS policies for both:
  - customers table
  - customer_banks table

  COPY AND PASTE THIS INTO SUPABASE SQL EDITOR AND RUN

  ============================================
*/

-- ====================================
-- FIX CUSTOMERS TABLE
-- ====================================

-- Drop all existing policies on customers table
DROP POLICY IF EXISTS "Users can view customers" ON customers;
DROP POLICY IF EXISTS "Users can insert customers" ON customers;
DROP POLICY IF EXISTS "Users can update customers" ON customers;
DROP POLICY IF EXISTS "Users can delete customers" ON customers;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON customers;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON customers;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON customers;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON customers;
DROP POLICY IF EXISTS "Authenticated users can view all customers" ON customers;
DROP POLICY IF EXISTS "Authenticated users can insert customers" ON customers;
DROP POLICY IF EXISTS "Authenticated users can update customers" ON customers;
DROP POLICY IF EXISTS "Authenticated users can delete customers" ON customers;

-- Ensure RLS is enabled on customers
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Create new permissive policies for customers
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

-- ====================================
-- FIX CUSTOMER_BANKS TABLE
-- ====================================

-- Drop all existing policies on customer_banks table
DROP POLICY IF EXISTS "Users can view customer banks" ON customer_banks;
DROP POLICY IF EXISTS "Users can insert customer banks" ON customer_banks;
DROP POLICY IF EXISTS "Users can update customer banks" ON customer_banks;
DROP POLICY IF EXISTS "Users can delete customer banks" ON customer_banks;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON customer_banks;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON customer_banks;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON customer_banks;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON customer_banks;
DROP POLICY IF EXISTS "Authenticated users can view all customer banks" ON customer_banks;
DROP POLICY IF EXISTS "Authenticated users can insert customer banks" ON customer_banks;
DROP POLICY IF EXISTS "Authenticated users can update customer banks" ON customer_banks;
DROP POLICY IF EXISTS "Authenticated users can delete customer banks" ON customer_banks;

-- Ensure RLS is enabled on customer_banks
ALTER TABLE customer_banks ENABLE ROW LEVEL SECURITY;

-- Create new permissive policies for customer_banks
CREATE POLICY "Authenticated users can view all customer banks"
  ON customer_banks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert customer banks"
  ON customer_banks FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update customer banks"
  ON customer_banks FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete customer banks"
  ON customer_banks FOR DELETE
  TO authenticated
  USING (true);

-- ====================================
-- VERIFICATION
-- ====================================

-- Show all policies created for customers
SELECT
  'customers' as table_name,
  policyname,
  cmd
FROM pg_policies
WHERE tablename = 'customers'
ORDER BY policyname;

-- Show all policies created for customer_banks
SELECT
  'customer_banks' as table_name,
  policyname,
  cmd
FROM pg_policies
WHERE tablename = 'customer_banks'
ORDER BY policyname;
