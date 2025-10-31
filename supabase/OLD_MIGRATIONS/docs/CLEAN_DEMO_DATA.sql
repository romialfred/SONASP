-- ============================================================================
-- CLEAN DEMO/HARDCODED DATA - Gold Shipper
-- ============================================================================
--
-- PURPOSE: This script identifies and removes any demo/test data from database
--
-- IMPORTANT DISCOVERY:
-- The Sales dashboard shows HARDCODED data in the frontend code (lines 162-214)
-- NOT from the database! The values you see are:
--   - Available Inventory: 1250.5 oz (hardcoded at line 163)
--   - Pending Sales: 8 (hardcoded at line 178)
--   - Monthly Revenue: $456,780 (hardcoded at line 186)
--   - Completed Sales: 23 (hardcoded at line 194)
--   - Monthly chart data (lines 203-214)
--   - Customer info: "Premium Gold Ltd." (line 304)
--
-- These are static values in /src/pages/sales/SalesDashboard.tsx
-- To remove them, the frontend code needs to be updated to fetch real data.
--
-- This script will:
-- 1. Check what REAL data exists in your database
-- 2. Clean any test/demo data that may have been seeded
-- 3. Show you the difference between DB data and displayed data
--
-- ============================================================================

-- ============================================================================
-- STEP 1: CHECK WHAT'S IN THE DATABASE
-- ============================================================================

DO $$
DECLARE
  sales_count INTEGER;
  customers_count INTEGER;
  batches_count INTEGER;
  inventory_count INTEGER;
  payments_count INTEGER;
  demo_customers_count INTEGER;
  demo_batches_count INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE 'CHECKING DATABASE FOR DEMO/TEST DATA';
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE '';

  -- Count current records
  SELECT COUNT(*) INTO sales_count FROM sales;
  SELECT COUNT(*) INTO customers_count FROM customers;
  SELECT COUNT(*) INTO batches_count FROM batches;
  SELECT COUNT(*) INTO inventory_count FROM gold_inventory;
  SELECT COUNT(*) INTO payments_count FROM payments;

  RAISE NOTICE 'CURRENT DATABASE STATE:';
  RAISE NOTICE '  • Sales: %', sales_count;
  RAISE NOTICE '  • Customers: %', customers_count;
  RAISE NOTICE '  • Batches: %', batches_count;
  RAISE NOTICE '  • Inventory: %', inventory_count;
  RAISE NOTICE '  • Payments: %', payments_count;
  RAISE NOTICE '';

  -- Check for common demo data patterns
  SELECT COUNT(*) INTO demo_customers_count
  FROM customers
  WHERE name ILIKE '%premium gold%'
     OR name ILIKE '%test%'
     OR name ILIKE '%demo%'
     OR email ILIKE '%test%'
     OR email ILIKE '%demo%'
     OR email ILIKE '%example%';

  SELECT COUNT(*) INTO demo_batches_count
  FROM batches
  WHERE batch_number ILIKE '%test%'
     OR batch_number ILIKE '%demo%';

  RAISE NOTICE 'POTENTIAL DEMO DATA DETECTED:';
  RAISE NOTICE '  • Demo customers (test/demo/example in name/email): %', demo_customers_count;
  RAISE NOTICE '  • Demo batches (test/demo in batch number): %', demo_batches_count;
  RAISE NOTICE '';

  -- Show the discrepancy
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE 'FRONTEND vs DATABASE COMPARISON:';
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'What the FRONTEND SHOWS (hardcoded in code):';
  RAISE NOTICE '  • Available Inventory: 1250.50 oz';
  RAISE NOTICE '  • Pending Sales: 8';
  RAISE NOTICE '  • Monthly Revenue: $456,780';
  RAISE NOTICE '  • Completed Sales: 23';
  RAISE NOTICE '  • Top Customer: Premium Gold Ltd.';
  RAISE NOTICE '';
  RAISE NOTICE 'What is ACTUALLY IN DATABASE:';
  RAISE NOTICE '  • Sales records: %', sales_count;
  RAISE NOTICE '  • Customers records: %', customers_count;
  RAISE NOTICE '  • Inventory records: %', inventory_count;
  RAISE NOTICE '';

  IF sales_count = 0 AND customers_count = 0 AND inventory_count = 0 THEN
    RAISE NOTICE '⚠ IMPORTANT: Your database is EMPTY!';
    RAISE NOTICE '   The data you see on the Sales page is HARDCODED in the frontend code.';
    RAISE NOTICE '   Location: /src/pages/sales/SalesDashboard.tsx (lines 162-214)';
    RAISE NOTICE '';
    RAISE NOTICE '   To fix this, the frontend code needs to be updated to:';
    RAISE NOTICE '   1. Fetch real inventory from gold_inventory table';
    RAISE NOTICE '   2. Count real pending sales from sales table';
    RAISE NOTICE '   3. Calculate real monthly revenue from sales table';
    RAISE NOTICE '   4. Get real customer data from customers table';
  ELSIF sales_count > 0 OR customers_count > 0 THEN
    RAISE NOTICE '✓ You have some data in the database.';
    RAISE NOTICE '  However, the Sales dashboard may not be displaying it correctly.';
    RAISE NOTICE '  Check if the frontend is fetching and displaying database data.';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '=============================================================================';

END $$;

-- ============================================================================
-- STEP 2: CLEAN DEMO DATA (if any exists)
-- ============================================================================

DO $$
DECLARE
  deleted_customers INTEGER := 0;
  deleted_batches INTEGER := 0;
  deleted_sales INTEGER := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE 'CLEANING DEMO/TEST DATA';
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE '';

  -- Delete demo customers and related data
  WITH deleted AS (
    DELETE FROM customers
    WHERE name ILIKE '%premium gold%'
       OR name ILIKE '%test%'
       OR name ILIKE '%demo%'
       OR email ILIKE '%test%'
       OR email ILIKE '%demo%'
       OR email ILIKE '%example%'
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_customers FROM deleted;

  IF deleted_customers > 0 THEN
    RAISE NOTICE '  ✓ Deleted % demo customers', deleted_customers;
  END IF;

  -- Delete demo batches
  WITH deleted AS (
    DELETE FROM batches
    WHERE batch_number ILIKE '%test%'
       OR batch_number ILIKE '%demo%'
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_batches FROM deleted;

  IF deleted_batches > 0 THEN
    RAISE NOTICE '  ✓ Deleted % demo batches', deleted_batches;
  END IF;

  -- Delete orphaned sales (sales without valid customers)
  WITH deleted AS (
    DELETE FROM sales
    WHERE customer_id NOT IN (SELECT id FROM customers)
    RETURNING id
  )
  SELECT COUNT(*) INTO deleted_sales FROM deleted;

  IF deleted_sales > 0 THEN
    RAISE NOTICE '  ✓ Deleted % orphaned sales', deleted_sales;
  END IF;

  IF deleted_customers = 0 AND deleted_batches = 0 AND deleted_sales = 0 THEN
    RAISE NOTICE '  ✓ No demo data found to clean';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '=============================================================================';

END $$;

-- ============================================================================
-- STEP 3: LIST REMAINING DATA (if any)
-- ============================================================================

DO $$
DECLARE
  rec RECORD;
  has_data BOOLEAN := FALSE;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE 'REMAINING DATA IN DATABASE';
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE '';

  -- List customers
  RAISE NOTICE 'CUSTOMERS:';
  FOR rec IN
    SELECT id, name, email, country
    FROM customers
    ORDER BY created_at DESC
    LIMIT 10
  LOOP
    has_data := TRUE;
    RAISE NOTICE '  • % - % (%)', rec.name, rec.email, rec.country;
  END LOOP;

  IF NOT has_data THEN
    RAISE NOTICE '  (No customers in database)';
  END IF;
  RAISE NOTICE '';

  has_data := FALSE;

  -- List batches
  RAISE NOTICE 'BATCHES:';
  FOR rec IN
    SELECT batch_number, status, weight_grams
    FROM batches
    ORDER BY created_at DESC
    LIMIT 10
  LOOP
    has_data := TRUE;
    RAISE NOTICE '  • % - % - %g', rec.batch_number, rec.status, rec.weight_grams;
  END LOOP;

  IF NOT has_data THEN
    RAISE NOTICE '  (No batches in database)';
  END IF;
  RAISE NOTICE '';

  has_data := FALSE;

  -- List sales
  RAISE NOTICE 'SALES:';
  FOR rec IN
    SELECT sale_number, status, quantity_oz, final_proceeds
    FROM sales
    ORDER BY created_at DESC
    LIMIT 10
  LOOP
    has_data := TRUE;
    RAISE NOTICE '  • % - % - % oz - $%', rec.sale_number, rec.status, rec.quantity_oz, rec.final_proceeds;
  END LOOP;

  IF NOT has_data THEN
    RAISE NOTICE '  (No sales in database)';
  END IF;
  RAISE NOTICE '';

  RAISE NOTICE '=============================================================================';

END $$;

-- ============================================================================
-- STEP 4: RECOMMENDATIONS
-- ============================================================================

DO $$
DECLARE
  sales_count INTEGER;
  customers_count INTEGER;
  inventory_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO sales_count FROM sales;
  SELECT COUNT(*) INTO customers_count FROM customers;
  SELECT COUNT(*) INTO inventory_count FROM gold_inventory;

  RAISE NOTICE '';
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE 'RECOMMENDATIONS';
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE '';

  IF sales_count = 0 AND customers_count = 0 AND inventory_count = 0 THEN
    RAISE NOTICE '📋 YOUR DATABASE IS CLEAN AND EMPTY';
    RAISE NOTICE '';
    RAISE NOTICE 'The data you see on the Sales page is HARDCODED in the frontend.';
    RAISE NOTICE 'To fix this, you need to update the frontend code:';
    RAISE NOTICE '';
    RAISE NOTICE '1. File: src/pages/sales/SalesDashboard.tsx';
    RAISE NOTICE '   Lines 162-165: Replace hardcoded inventory with DB query';
    RAISE NOTICE '   Lines 167-200: Replace hardcoded metrics with real calculations';
    RAISE NOTICE '   Lines 203-214: Replace hardcoded chart data with real sales data';
    RAISE NOTICE '   Line 304: Replace "Premium Gold Ltd." with real top customer';
    RAISE NOTICE '';
    RAISE NOTICE '2. The sales list (lines 359-426) already uses database data correctly!';
    RAISE NOTICE '   When you create real sales, they will appear in the "Active Sales" section.';
    RAISE NOTICE '';
    RAISE NOTICE '3. Next steps:';
    RAISE NOTICE '   • Start creating real batches';
    RAISE NOTICE '   • Register real customers';
    RAISE NOTICE '   • Create real sales';
    RAISE NOTICE '   • Update frontend to fetch metrics from database';
  ELSE
    RAISE NOTICE '📊 YOUR DATABASE HAS DATA';
    RAISE NOTICE '';
    RAISE NOTICE 'Records found:';
    RAISE NOTICE '  • Sales: %', sales_count;
    RAISE NOTICE '  • Customers: %', customers_count;
    RAISE NOTICE '  • Inventory: %', inventory_count;
    RAISE NOTICE '';
    RAISE NOTICE 'If you dont see this data on the Sales page, the issue is:';
    RAISE NOTICE '  → The frontend is showing hardcoded values instead of database data';
    RAISE NOTICE '  → Update src/pages/sales/SalesDashboard.tsx to fetch real data';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE '';

END $$;
