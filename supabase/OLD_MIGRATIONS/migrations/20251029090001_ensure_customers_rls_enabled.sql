/*
  # Ensure RLS is enabled on customers table

  1. Changes
    - Enable RLS on customers table if not already enabled
    - Ensure proper policies exist for authenticated users
    - Verify customers can be read by all authenticated users

  2. Security
    - All authenticated users can read customers (needed for sales)
    - Only authorized users can modify customers
*/

-- Enable RLS on customers table
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate them
DROP POLICY IF EXISTS "Management can view all customers" ON customers;
DROP POLICY IF EXISTS "Authenticated users can view customers" ON customers;
DROP POLICY IF EXISTS "Everyone can read customers" ON customers;

-- Create a clear policy for reading customers
-- All authenticated users need to see customers to create sales
CREATE POLICY "Authenticated users can read customers"
  ON customers FOR SELECT
  TO authenticated
  USING (true);

-- Verify policy was created
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'customers'
    AND policyname = 'Authenticated users can read customers';

  IF policy_count > 0 THEN
    RAISE NOTICE 'RLS policy successfully created for customers table';
  ELSE
    RAISE WARNING 'Failed to create RLS policy for customers table';
  END IF;
END $$;

-- Show all customers for verification
DO $$
DECLARE
  total_customers INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_customers FROM customers;
  RAISE NOTICE 'Total customers in database: %', total_customers;
END $$;
