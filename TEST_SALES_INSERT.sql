/*
  # Test Sales Insert

  This script tests if you can insert a sale record.
  Run this in Supabase SQL Editor to verify database permissions.
*/

-- Step 1: Check if required tables exist and have data
SELECT 'Checking customers...' AS step;
SELECT COUNT(*) as customer_count FROM customers;

SELECT 'Checking mining_companies...' AS step;
SELECT COUNT(*) as mining_company_count FROM mining_companies;

SELECT 'Checking auth.users...' AS step;
SELECT COUNT(*) as user_count FROM auth.users;

-- Step 2: Get sample IDs for testing
SELECT 'Getting sample IDs...' AS step;

-- Get first customer
SELECT id, customer_name FROM customers LIMIT 1;

-- Get first mining company
SELECT id, name FROM mining_companies LIMIT 1;

-- Get current user
SELECT auth.uid() as current_user_id;

-- Step 3: Test INSERT with actual values
-- IMPORTANT: Replace the UUIDs below with actual values from step 2

/*
DO $$
DECLARE
  v_customer_id uuid;
  v_seller_id uuid;
  v_user_id uuid;
  v_sale_number text;
BEGIN
  -- Get IDs
  SELECT id INTO v_customer_id FROM customers LIMIT 1;
  SELECT id INTO v_seller_id FROM mining_companies LIMIT 1;
  v_user_id := auth.uid();

  -- Generate sale number
  v_sale_number := 'TEST-' || EXTRACT(YEAR FROM CURRENT_DATE) || '-' || LPAD(FLOOR(RANDOM() * 1000)::text, 3, '0');

  -- Test insert
  INSERT INTO sales (
    sale_number,
    sale_date,
    customer_id,
    seller_id,
    seller_type,
    quantity_oz,
    london_am_rate,
    freight_cost,
    other_costs,
    gross_proceeds,
    net_proceeds,
    royalties,
    final_proceeds,
    total_amount,
    currency,
    status,
    mechanism_type,
    created_by
  ) VALUES (
    v_sale_number,
    CURRENT_DATE,
    v_customer_id,
    v_seller_id,
    'mining_company',
    100.0,
    2700.0,
    500.0,
    100.0,
    270000.0,
    269400.0,
    8082.0,
    261318.0,
    261318.0,
    'USD',
    'draft',
    'spot',
    v_user_id
  );

  RAISE NOTICE 'Test sale % created successfully!', v_sale_number;

  -- Cleanup test data
  DELETE FROM sales WHERE sale_number LIKE 'TEST-%';
  RAISE NOTICE 'Test data cleaned up';

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error: %', SQLERRM;
  RAISE NOTICE 'Detail: %', SQLSTATE;
END $$;
*/

-- Step 4: Alternative manual test (uncomment and fill in the IDs)
/*
INSERT INTO sales (
  sale_number,
  sale_date,
  customer_id,  -- REPLACE WITH ACTUAL CUSTOMER ID
  seller_id,    -- REPLACE WITH ACTUAL MINING COMPANY ID
  seller_type,
  quantity_oz,
  london_am_rate,
  freight_cost,
  other_costs,
  gross_proceeds,
  net_proceeds,
  royalties,
  final_proceeds,
  total_amount,
  currency,
  status,
  created_by    -- REPLACE WITH YOUR USER ID or use auth.uid()
) VALUES (
  'TEST-2025-999',
  CURRENT_DATE,
  '00000000-0000-0000-0000-000000000000',  -- REPLACE
  '00000000-0000-0000-0000-000000000000',  -- REPLACE
  'mining_company',
  100.0,
  2700.0,
  500.0,
  100.0,
  270000.0,
  269400.0,
  8082.0,
  261318.0,
  261318.0,
  'USD',
  'draft',
  auth.uid()  -- or REPLACE with your user ID
) RETURNING *;
*/

-- Step 5: Check if the test sale was created
-- SELECT * FROM sales WHERE sale_number LIKE 'TEST-%' ORDER BY created_at DESC LIMIT 1;

-- Step 6: Cleanup (optional)
-- DELETE FROM sales WHERE sale_number LIKE 'TEST-%';
