-- ============================================================================
-- GOLD SHIPPER - DATABASE CLEANUP SCRIPT
-- ============================================================================
--
-- PURPOSE: Clean all transactional data for fresh registration
--
-- WHAT THIS SCRIPT DOES:
-- ✓ Deletes ALL batches and related data
-- ✓ Deletes ALL inventory records
-- ✓ Deletes ALL sales and payment data
-- ✓ Deletes ALL customers
-- ✓ Resets all auto-increment sequences
--
-- WHAT THIS SCRIPT PRESERVES:
-- ✓ Stakeholders (Mining Companies, Refineries, Freight Companies)
-- ✓ FX Rates (All exchange rate data)
-- ✓ Gold Prices (All price history)
-- ✓ Users and Permissions
-- ✓ System Parameters and Configuration
-- ✓ Sites
--
-- HOW TO USE:
-- 1. Open Supabase SQL Editor
-- 2. Copy and paste this entire script
-- 3. Click "Run" to execute
-- 4. Check the output messages for confirmation
--
-- WARNING: THIS ACTION CANNOT BE UNDONE!
-- Make sure you have a backup if needed before running this script.
--
-- ============================================================================

-- ============================================================================
-- MAIN CLEANUP PROCEDURE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE 'Starting Database Cleanup...';
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE '';

  -- ============================================================================
  -- SALES DATA CLEANUP
  -- ============================================================================

  RAISE NOTICE 'Cleaning Sales Data...';

  DELETE FROM sales_notifications_log;
  DELETE FROM sales_audit_trail;
  DELETE FROM sales_documents;
  DELETE FROM sales_commissions;
  DELETE FROM sales_payment_schedules;
  DELETE FROM sales_approvals;
  DELETE FROM sales_line_items;
  DELETE FROM sales_allocations;
  DELETE FROM sale_pricing_details;
  DELETE FROM sale_quantity_recommendations;
  DELETE FROM sales;

  RAISE NOTICE '✓ Sales data cleaned';

  -- ============================================================================
  -- PAYMENT DATA CLEANUP
  -- ============================================================================

  RAISE NOTICE 'Cleaning Payment Data...';

  DELETE FROM payment_documents;
  DELETE FROM payment_history;
  DELETE FROM payment_reminders;
  DELETE FROM payments;

  RAISE NOTICE '✓ Payment data cleaned';

  -- ============================================================================
  -- CUSTOMER DATA CLEANUP
  -- ============================================================================

  RAISE NOTICE 'Cleaning Customer Data...';

  DELETE FROM customer_contracts;
  DELETE FROM customer_fx_rates;
  DELETE FROM customers;

  RAISE NOTICE '✓ Customer data cleaned';

  -- ============================================================================
  -- BATCH DATA CLEANUP
  -- ============================================================================

  RAISE NOTICE 'Cleaning Batch Data...';

  DELETE FROM batch_alerts;
  DELETE FROM batch_analytics_snapshots;
  DELETE FROM batch_approvals;
  DELETE FROM batch_documents;
  DELETE FROM batch_escalations;
  DELETE FROM batch_merges;
  DELETE FROM batch_quality_checks;
  DELETE FROM batch_reservations;
  DELETE FROM batch_splits;
  DELETE FROM batch_status_history;
  DELETE FROM batch_status_transitions;
  DELETE FROM batch_tags;
  DELETE FROM batch_workflow_instances;
  DELETE FROM batch_workflow_definitions;
  DELETE FROM batches;

  RAISE NOTICE '✓ Batch data cleaned';

  -- ============================================================================
  -- INVENTORY DATA CLEANUP
  -- ============================================================================

  RAISE NOTICE 'Cleaning Inventory Data...';

  DELETE FROM inventory_transactions;
  DELETE FROM gold_inventory;

  RAISE NOTICE '✓ Inventory data cleaned';

  -- ============================================================================
  -- PROCESSING DATA CLEANUP
  -- ============================================================================

  RAISE NOTICE 'Cleaning Processing Data...';

  DELETE FROM variance_investigations;
  DELETE FROM refining_records;
  DELETE FROM receiving_records;
  DELETE FROM transportation_details;

  RAISE NOTICE '✓ Processing data cleaned';

  -- ============================================================================
  -- OTHER TRANSACTIONAL DATA CLEANUP
  -- ============================================================================

  RAISE NOTICE 'Cleaning Other Transactional Data...';

  DELETE FROM approval_requests;
  DELETE FROM email_logs;
  DELETE FROM commission_rules;
  DELETE FROM saved_batch_searches;

  RAISE NOTICE '✓ Other transactional data cleaned';

  RAISE NOTICE '';
  RAISE NOTICE 'Resetting Auto-Increment Sequences...';

END $$;

-- ============================================================================
-- RESET AUTO-INCREMENT SEQUENCES
-- ============================================================================

DO $$
DECLARE
  seq_record RECORD;
  reset_count INTEGER := 0;
BEGIN
  FOR seq_record IN
    SELECT schemaname, sequencename
    FROM pg_sequences
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER SEQUENCE %I.%I RESTART WITH 1', seq_record.schemaname, seq_record.sequencename);
    reset_count := reset_count + 1;
  END LOOP;

  RAISE NOTICE '✓ Reset % sequences', reset_count;
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- VERIFICATION AND SUMMARY
-- ============================================================================

DO $$
DECLARE
  batch_count INTEGER;
  customer_count INTEGER;
  sales_count INTEGER;
  payment_count INTEGER;
  inventory_count INTEGER;
  mining_count INTEGER;
  refinery_count INTEGER;
  fx_rate_count INTEGER;
  gold_price_count INTEGER;
BEGIN
  -- Count cleaned tables
  SELECT COUNT(*) INTO batch_count FROM batches;
  SELECT COUNT(*) INTO customer_count FROM customers;
  SELECT COUNT(*) INTO sales_count FROM sales;
  SELECT COUNT(*) INTO payment_count FROM payments;
  SELECT COUNT(*) INTO inventory_count FROM gold_inventory;

  -- Count preserved tables
  SELECT COUNT(*) INTO mining_count FROM mining_companies;
  SELECT COUNT(*) INTO refinery_count FROM refineries;
  SELECT COUNT(*) INTO fx_rate_count FROM fx_rates;
  SELECT COUNT(*) INTO gold_price_count FROM gold_prices;

  RAISE NOTICE '';
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE 'DATABASE CLEANUP COMPLETED SUCCESSFULLY!';
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'CLEANED TABLES (should be 0):';
  RAISE NOTICE '  • Batches: %', batch_count;
  RAISE NOTICE '  • Customers: %', customer_count;
  RAISE NOTICE '  • Sales: %', sales_count;
  RAISE NOTICE '  • Payments: %', payment_count;
  RAISE NOTICE '  • Inventory: %', inventory_count;
  RAISE NOTICE '';
  RAISE NOTICE 'PRESERVED TABLES (should have data):';
  RAISE NOTICE '  • Mining Companies: %', mining_count;
  RAISE NOTICE '  • Refineries: %', refinery_count;
  RAISE NOTICE '  • FX Rates: %', fx_rate_count;
  RAISE NOTICE '  • Gold Prices: %', gold_price_count;
  RAISE NOTICE '';

  IF batch_count = 0 AND customer_count = 0 AND sales_count = 0 THEN
    RAISE NOTICE '✓✓✓ DATABASE IS CLEAN AND READY FOR FRESH REGISTRATION! ✓✓✓';
  ELSE
    RAISE WARNING '⚠ Some tables still have data. Please review.';
  END IF;

  RAISE NOTICE '=============================================================================';
  RAISE NOTICE '';

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '';
    RAISE NOTICE '=============================================================================';
    RAISE WARNING 'ERROR DURING CLEANUP: %', SQLERRM;
    RAISE NOTICE '=============================================================================';
    RAISE NOTICE '';
    RAISE;
END $$;
