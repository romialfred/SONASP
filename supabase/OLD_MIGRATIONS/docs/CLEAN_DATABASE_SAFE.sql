-- ============================================================================
-- GOLD SHIPPER - DATABASE CLEANUP SCRIPT (SAFE VERSION - No Permissions Required)
-- ============================================================================
--
-- This version works with standard Supabase permissions
-- No session_replication_role changes required
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

DO $$
DECLARE
  table_list TEXT[] := ARRAY[
    -- Sales related (in dependency order)
    'sales_notifications_log',
    'sales_audit_trail',
    'sales_documents',
    'sales_commissions',
    'sales_payment_schedules',
    'sales_approvals',
    'sales_line_items',
    'sales_allocations',
    'sale_pricing_details',
    'sale_quantity_recommendations',
    'sales',
    -- Payment related
    'payment_documents',
    'payment_history',
    'payment_reminders',
    'payments',
    -- Customer related
    'customer_contracts',
    'customer_fx_rates',
    'customers',
    -- Batch related (in dependency order)
    'batch_alerts',
    'batch_analytics_snapshots',
    'batch_approvals',
    'batch_documents',
    'batch_escalations',
    'batch_merges',
    'batch_quality_checks',
    'batch_reservations',
    'batch_splits',
    'batch_status_history',
    'batch_status_transitions',
    'batch_tags',
    'batch_workflow_instances',
    'batch_workflow_definitions',
    'batches',
    -- Inventory related
    'inventory_transactions',
    'gold_inventory',
    -- Processing related
    'variance_investigations',
    'refining_records',
    'receiving_records',
    'transportation_details',
    -- Other transactional
    'approval_requests',
    'email_logs',
    'commission_rules',
    'saved_batch_searches'
  ];
  table_name TEXT;
  tables_deleted INTEGER := 0;
  rows_deleted INTEGER;
  total_rows_deleted INTEGER := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE 'Starting Database Cleanup...';
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE '';

  -- Delete from each table
  FOREACH table_name IN ARRAY table_list
  LOOP
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = table_name AND table_schema = 'public') THEN
      BEGIN
        EXECUTE format('DELETE FROM %I', table_name);
        GET DIAGNOSTICS rows_deleted = ROW_COUNT;
        total_rows_deleted := total_rows_deleted + rows_deleted;
        tables_deleted := tables_deleted + 1;

        IF rows_deleted > 0 THEN
          RAISE NOTICE '  ✓ Deleted % rows from %', rows_deleted, table_name;
        END IF;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE NOTICE '  ⚠ Error deleting from %: %', table_name, SQLERRM;
      END;
    END IF;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '✓ Deleted % total rows from % tables', total_rows_deleted, tables_deleted;
  RAISE NOTICE '';

END $$;

-- ============================================================================
-- RESET AUTO-INCREMENT SEQUENCES
-- ============================================================================

DO $$
DECLARE
  seq_record RECORD;
  reset_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'Resetting Auto-Increment Sequences...';

  FOR seq_record IN
    SELECT schemaname, sequencename
    FROM pg_sequences
    WHERE schemaname = 'public'
  LOOP
    BEGIN
      EXECUTE format('ALTER SEQUENCE %I.%I RESTART WITH 1', seq_record.schemaname, seq_record.sequencename);
      reset_count := reset_count + 1;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE '  ⚠ Could not reset sequence %: %', seq_record.sequencename, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE '✓ Reset % sequences', reset_count;
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- VERIFICATION AND SUMMARY
-- ============================================================================

DO $$
DECLARE
  batch_count INTEGER := 0;
  customer_count INTEGER := 0;
  sales_count INTEGER := 0;
  payment_count INTEGER := 0;
  inventory_count INTEGER := 0;
  mining_count INTEGER := 0;
  refinery_count INTEGER := 0;
  freight_count INTEGER := 0;
  fx_rate_count INTEGER := 0;
  gold_price_count INTEGER := 0;
  user_count INTEGER := 0;
BEGIN
  -- Count cleaned tables (with error handling)
  BEGIN
    SELECT COUNT(*) INTO batch_count FROM batches;
  EXCEPTION WHEN OTHERS THEN
    batch_count := -1;
  END;

  BEGIN
    SELECT COUNT(*) INTO customer_count FROM customers;
  EXCEPTION WHEN OTHERS THEN
    customer_count := -1;
  END;

  BEGIN
    SELECT COUNT(*) INTO sales_count FROM sales;
  EXCEPTION WHEN OTHERS THEN
    sales_count := -1;
  END;

  BEGIN
    SELECT COUNT(*) INTO payment_count FROM payments;
  EXCEPTION WHEN OTHERS THEN
    payment_count := -1;
  END;

  BEGIN
    SELECT COUNT(*) INTO inventory_count FROM gold_inventory;
  EXCEPTION WHEN OTHERS THEN
    inventory_count := -1;
  END;

  -- Count preserved tables (with error handling)
  BEGIN
    SELECT COUNT(*) INTO mining_count FROM mining_companies;
  EXCEPTION WHEN OTHERS THEN
    mining_count := -1;
  END;

  BEGIN
    SELECT COUNT(*) INTO refinery_count FROM refineries;
  EXCEPTION WHEN OTHERS THEN
    refinery_count := -1;
  END;

  BEGIN
    SELECT COUNT(*) INTO freight_count FROM freight_companies;
  EXCEPTION WHEN OTHERS THEN
    freight_count := -1;
  END;

  BEGIN
    SELECT COUNT(*) INTO fx_rate_count FROM fx_rates;
  EXCEPTION WHEN OTHERS THEN
    fx_rate_count := -1;
  END;

  BEGIN
    SELECT COUNT(*) INTO gold_price_count FROM gold_prices;
  EXCEPTION WHEN OTHERS THEN
    gold_price_count := -1;
  END;

  BEGIN
    SELECT COUNT(*) INTO user_count FROM user_profiles;
  EXCEPTION WHEN OTHERS THEN
    user_count := -1;
  END;

  -- Display results
  RAISE NOTICE '';
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE 'DATABASE CLEANUP COMPLETED SUCCESSFULLY!';
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'CLEANED TABLES (should be 0):';

  IF batch_count >= 0 THEN
    RAISE NOTICE '  • Batches: %', batch_count;
  END IF;

  IF customer_count >= 0 THEN
    RAISE NOTICE '  • Customers: %', customer_count;
  END IF;

  IF sales_count >= 0 THEN
    RAISE NOTICE '  • Sales: %', sales_count;
  END IF;

  IF payment_count >= 0 THEN
    RAISE NOTICE '  • Payments: %', payment_count;
  END IF;

  IF inventory_count >= 0 THEN
    RAISE NOTICE '  • Inventory: %', inventory_count;
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE 'PRESERVED TABLES (should have data):';

  IF mining_count >= 0 THEN
    RAISE NOTICE '  • Mining Companies: %', mining_count;
  END IF;

  IF refinery_count >= 0 THEN
    RAISE NOTICE '  • Refineries: %', refinery_count;
  END IF;

  IF freight_count >= 0 THEN
    RAISE NOTICE '  • Freight Companies: %', freight_count;
  END IF;

  IF fx_rate_count >= 0 THEN
    RAISE NOTICE '  • FX Rates: %', fx_rate_count;
  END IF;

  IF gold_price_count >= 0 THEN
    RAISE NOTICE '  • Gold Prices: %', gold_price_count;
  END IF;

  IF user_count >= 0 THEN
    RAISE NOTICE '  • Users: %', user_count;
  END IF;

  RAISE NOTICE '';

  -- Final status
  IF batch_count = 0 AND customer_count = 0 AND sales_count = 0 THEN
    RAISE NOTICE '✓✓✓ DATABASE IS CLEAN AND READY FOR FRESH REGISTRATION! ✓✓✓';
  ELSIF batch_count > 0 OR customer_count > 0 OR sales_count > 0 THEN
    RAISE WARNING '⚠ Some tables still have data. Please review.';
  END IF;

  RAISE NOTICE '=============================================================================';
  RAISE NOTICE '';

END $$;
