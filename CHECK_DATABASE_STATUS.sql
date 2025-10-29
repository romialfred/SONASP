-- ============================================================================
-- DATABASE STATUS CHECK - Gold Shipper
-- ============================================================================
--
-- PURPOSE: Check the current state of your database
-- Shows record counts for all major tables
--
-- HOW TO USE:
-- 1. Open Supabase SQL Editor
-- 2. Copy and paste this script
-- 3. Click "Run"
-- 4. Review the output to see what data exists
--
-- ============================================================================

DO $$
DECLARE
  -- Transactional Data (should be 0 after cleanup)
  batch_count INTEGER;
  customer_count INTEGER;
  sales_count INTEGER;
  payment_count INTEGER;
  inventory_count INTEGER;
  receiving_count INTEGER;
  refining_count INTEGER;

  -- Reference Data (should be preserved)
  mining_company_count INTEGER;
  refinery_count INTEGER;
  freight_company_count INTEGER;
  fx_rate_count INTEGER;
  gold_price_count INTEGER;
  user_count INTEGER;
  site_count INTEGER;

  -- Batch-related counts
  batch_approval_count INTEGER;
  batch_document_count INTEGER;
  batch_history_count INTEGER;

  -- Sales-related counts
  sales_line_count INTEGER;
  sales_approval_count INTEGER;
  sales_commission_count INTEGER;
BEGIN
  -- Count transactional data
  SELECT COUNT(*) INTO batch_count FROM batches;
  SELECT COUNT(*) INTO customer_count FROM customers;
  SELECT COUNT(*) INTO sales_count FROM sales;
  SELECT COUNT(*) INTO payment_count FROM payments;
  SELECT COUNT(*) INTO inventory_count FROM gold_inventory;
  SELECT COUNT(*) INTO receiving_count FROM receiving_records;
  SELECT COUNT(*) INTO refining_count FROM refining_records;

  -- Count reference data
  SELECT COUNT(*) INTO mining_company_count FROM mining_companies;
  SELECT COUNT(*) INTO refinery_count FROM refineries;
  SELECT COUNT(*) INTO freight_company_count FROM freight_companies;
  SELECT COUNT(*) INTO fx_rate_count FROM fx_rates;
  SELECT COUNT(*) INTO gold_price_count FROM gold_prices;
  SELECT COUNT(*) INTO user_count FROM user_profiles;
  SELECT COUNT(*) INTO site_count FROM sites;

  -- Count batch-related data
  SELECT COUNT(*) INTO batch_approval_count FROM batch_approvals;
  SELECT COUNT(*) INTO batch_document_count FROM batch_documents;
  SELECT COUNT(*) INTO batch_history_count FROM batch_status_history;

  -- Count sales-related data
  SELECT COUNT(*) INTO sales_line_count FROM sales_line_items;
  SELECT COUNT(*) INTO sales_approval_count FROM sales_approvals;
  SELECT COUNT(*) INTO sales_commission_count FROM sales_commissions;

  -- Display results
  RAISE NOTICE '';
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE 'GOLD SHIPPER - DATABASE STATUS REPORT';
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE '';

  RAISE NOTICE '--- TRANSACTIONAL DATA (Main Tables) ---';
  RAISE NOTICE 'Batches:                    %', batch_count;
  RAISE NOTICE 'Customers:                  %', customer_count;
  RAISE NOTICE 'Sales:                      %', sales_count;
  RAISE NOTICE 'Payments:                   %', payment_count;
  RAISE NOTICE 'Gold Inventory:             %', inventory_count;
  RAISE NOTICE 'Receiving Records:          %', receiving_count;
  RAISE NOTICE 'Refining Records:           %', refining_count;
  RAISE NOTICE '';

  RAISE NOTICE '--- BATCH RELATED DATA ---';
  RAISE NOTICE 'Batch Approvals:            %', batch_approval_count;
  RAISE NOTICE 'Batch Documents:            %', batch_document_count;
  RAISE NOTICE 'Batch Status History:       %', batch_history_count;
  RAISE NOTICE '';

  RAISE NOTICE '--- SALES RELATED DATA ---';
  RAISE NOTICE 'Sales Line Items:           %', sales_line_count;
  RAISE NOTICE 'Sales Approvals:            %', sales_approval_count;
  RAISE NOTICE 'Sales Commissions:          %', sales_commission_count;
  RAISE NOTICE '';

  RAISE NOTICE '--- REFERENCE DATA (Should Be Preserved) ---';
  RAISE NOTICE 'Mining Companies:           %', mining_company_count;
  RAISE NOTICE 'Refineries:                 %', refinery_count;
  RAISE NOTICE 'Freight Companies:          %', freight_company_count;
  RAISE NOTICE 'FX Rates:                   %', fx_rate_count;
  RAISE NOTICE 'Gold Prices:                %', gold_price_count;
  RAISE NOTICE 'Users:                      %', user_count;
  RAISE NOTICE 'Sites:                      %', site_count;
  RAISE NOTICE '';

  -- Calculate totals
  DECLARE
    total_transactional INTEGER;
    total_reference INTEGER;
  BEGIN
    total_transactional := batch_count + customer_count + sales_count +
                          payment_count + inventory_count + receiving_count +
                          refining_count;
    total_reference := mining_company_count + refinery_count +
                      freight_company_count + fx_rate_count + gold_price_count;

    RAISE NOTICE '--- SUMMARY ---';
    RAISE NOTICE 'Total Transactional Records: %', total_transactional;
    RAISE NOTICE 'Total Reference Records:     %', total_reference;
    RAISE NOTICE '';

    -- Provide status assessment
    IF total_transactional = 0 THEN
      RAISE NOTICE '✓ DATABASE IS CLEAN - Ready for fresh registration!';
    ELSIF total_transactional < 10 THEN
      RAISE NOTICE '⚠ DATABASE HAS MINIMAL DATA - Consider cleaning for fresh start';
    ELSE
      RAISE NOTICE '● DATABASE HAS ACTIVE DATA - % transactional records', total_transactional;
    END IF;

    IF total_reference = 0 THEN
      RAISE NOTICE '⚠ WARNING: No reference data found! You may need to add stakeholders.';
    ELSIF total_reference < 10 THEN
      RAISE NOTICE '⚠ NOTICE: Limited reference data. Consider adding more stakeholders.';
    ELSE
      RAISE NOTICE '✓ Reference data looks good - % records', total_reference;
    END IF;
  END;

  RAISE NOTICE '';
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE 'End of Database Status Report';
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE '';

END $$;

-- ============================================================================
-- ADDITIONAL CHECKS: Recent Activity
-- ============================================================================

DO $$
DECLARE
  latest_batch_date TIMESTAMP;
  latest_sale_date TIMESTAMP;
  latest_payment_date TIMESTAMP;
BEGIN
  -- Get latest dates
  SELECT MAX(created_at) INTO latest_batch_date FROM batches;
  SELECT MAX(sale_date) INTO latest_sale_date FROM sales;
  SELECT MAX(payment_date) INTO latest_payment_date FROM payments;

  RAISE NOTICE '';
  RAISE NOTICE '--- RECENT ACTIVITY ---';

  IF latest_batch_date IS NOT NULL THEN
    RAISE NOTICE 'Latest Batch Created:       %', latest_batch_date;
  ELSE
    RAISE NOTICE 'Latest Batch Created:       No batches found';
  END IF;

  IF latest_sale_date IS NOT NULL THEN
    RAISE NOTICE 'Latest Sale Date:           %', latest_sale_date;
  ELSE
    RAISE NOTICE 'Latest Sale Date:           No sales found';
  END IF;

  IF latest_payment_date IS NOT NULL THEN
    RAISE NOTICE 'Latest Payment Date:        %', latest_payment_date;
  ELSE
    RAISE NOTICE 'Latest Payment Date:        No payments found';
  END IF;

  RAISE NOTICE '';
END $$;

-- ============================================================================
-- TABLE SIZE INFORMATION
-- ============================================================================

SELECT
  schemaname as schema,
  tablename as table_name,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as data_size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as external_size
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'batches', 'customers', 'sales', 'payments', 'gold_inventory',
    'mining_companies', 'refineries', 'freight_companies',
    'fx_rates', 'gold_prices'
  )
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 20;
