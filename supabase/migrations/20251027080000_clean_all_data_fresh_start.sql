/*
  # Clean All Data - Fresh Start

  1. Purpose
     - Remove ALL existing operational data from tables that exist
     - Check for table existence before attempting deletion
     - Preserve user accounts, permissions, and system configuration
     - Provide detailed logging of what was deleted

  2. What Gets Cleaned
     - All sales, payments, customers (if tables exist)
     - All batches and processing data
     - All workflows and approvals  
     - All pricing and reference data
     - All notifications and operational logs

  3. What Gets Preserved
     - User accounts and authentication
     - User permissions and roles
     - System modules and sites
     - Table structures and RLS policies
*/

DO $$
DECLARE
  v_count INT;
  v_total_deleted INT := 0;
  v_table_exists BOOLEAN;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'STARTING COMPREHENSIVE DATA CLEANUP';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';

  -- ============================================================================
  -- STEP 1: Sales and Customer Data
  -- ============================================================================
  RAISE NOTICE 'STEP 1: Cleaning Sales and Customer Data';
  RAISE NOTICE '----------------------------------------';

  -- Check and delete from sales_line_items
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'sales_line_items'
  ) INTO v_table_exists;
  IF v_table_exists THEN
    DELETE FROM sales_line_items;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count > 0 THEN RAISE NOTICE '  ✓ Deleted % sales_line_items', v_count; END IF;
    v_total_deleted := v_total_deleted + v_count;
  END IF;

  -- Check and delete from sales
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'sales'
  ) INTO v_table_exists;
  IF v_table_exists THEN
    DELETE FROM sales;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '  ✓ Deleted % sales', v_count;
    v_total_deleted := v_total_deleted + v_count;
  END IF;

  -- Check and delete from payments
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'payments'
  ) INTO v_table_exists;
  IF v_table_exists THEN
    DELETE FROM payments;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '  ✓ Deleted % payments', v_count;
    v_total_deleted := v_total_deleted + v_count;
  END IF;

  -- Check and delete from customers
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'customers'
  ) INTO v_table_exists;
  IF v_table_exists THEN
    DELETE FROM customers;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '  ✓ Deleted % customers', v_count;
    v_total_deleted := v_total_deleted + v_count;
  END IF;

  -- ============================================================================
  -- STEP 2: Batch and Processing Data
  -- ============================================================================
  RAISE NOTICE '';
  RAISE NOTICE 'STEP 2: Cleaning Batch and Processing Data';
  RAISE NOTICE '-------------------------------------------';

  -- Check and delete from batch_documents
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'batch_documents'
  ) INTO v_table_exists;
  IF v_table_exists THEN
    DELETE FROM batch_documents;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count > 0 THEN RAISE NOTICE '  ✓ Deleted % batch_documents', v_count; END IF;
    v_total_deleted := v_total_deleted + v_count;
  END IF;

  -- Check and delete from refining_records
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'refining_records'
  ) INTO v_table_exists;
  IF v_table_exists THEN
    DELETE FROM refining_records;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count > 0 THEN RAISE NOTICE '  ✓ Deleted % refining_records', v_count; END IF;
    v_total_deleted := v_total_deleted + v_count;
  END IF;

  -- Check and delete from receiving_records
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'receiving_records'
  ) INTO v_table_exists;
  IF v_table_exists THEN
    DELETE FROM receiving_records;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count > 0 THEN RAISE NOTICE '  ✓ Deleted % receiving_records', v_count; END IF;
    v_total_deleted := v_total_deleted + v_count;
  END IF;

  -- Check and delete from batch_status_history
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'batch_status_history'
  ) INTO v_table_exists;
  IF v_table_exists THEN
    DELETE FROM batch_status_history;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count > 0 THEN RAISE NOTICE '  ✓ Deleted % batch_status_history', v_count; END IF;
    v_total_deleted := v_total_deleted + v_count;
  END IF;

  -- Check and delete from batches
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'batches'
  ) INTO v_table_exists;
  IF v_table_exists THEN
    DELETE FROM batches;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '  ✓ Deleted % batches', v_count;
    v_total_deleted := v_total_deleted + v_count;
  END IF;

  -- ============================================================================
  -- STEP 3: Workflow and Approval Data
  -- ============================================================================
  RAISE NOTICE '';
  RAISE NOTICE 'STEP 3: Cleaning Workflow and Approval Data';
  RAISE NOTICE '--------------------------------------------';

  -- Check and delete from workflow_instances
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'workflow_instances'
  ) INTO v_table_exists;
  IF v_table_exists THEN
    DELETE FROM workflow_instances;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count > 0 THEN RAISE NOTICE '  ✓ Deleted % workflow_instances', v_count; END IF;
    v_total_deleted := v_total_deleted + v_count;
  END IF;

  -- Check and delete from approval_requests
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'approval_requests'
  ) INTO v_table_exists;
  IF v_table_exists THEN
    DELETE FROM approval_requests;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count > 0 THEN RAISE NOTICE '  ✓ Deleted % approval_requests', v_count; END IF;
    v_total_deleted := v_total_deleted + v_count;
  END IF;

  -- ============================================================================
  -- STEP 4: Pricing and Reference Data
  -- ============================================================================
  RAISE NOTICE '';
  RAISE NOTICE 'STEP 4: Cleaning Pricing and Reference Data';
  RAISE NOTICE '--------------------------------------------';

  -- Check and delete from gold_prices
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'gold_prices'
  ) INTO v_table_exists;
  IF v_table_exists THEN
    DELETE FROM gold_prices;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count > 0 THEN RAISE NOTICE '  ✓ Deleted % gold_prices', v_count; END IF;
    v_total_deleted := v_total_deleted + v_count;
  END IF;

  -- Check and delete from exchange_rates
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'exchange_rates'
  ) INTO v_table_exists;
  IF v_table_exists THEN
    DELETE FROM exchange_rates;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count > 0 THEN RAISE NOTICE '  ✓ Deleted % exchange_rates', v_count; END IF;
    v_total_deleted := v_total_deleted + v_count;
  END IF;

  -- ============================================================================
  -- STEP 5: Notifications and System Logs
  -- ============================================================================
  RAISE NOTICE '';
  RAISE NOTICE 'STEP 5: Cleaning Notifications and Logs';
  RAISE NOTICE '---------------------------------------';

  -- Check and delete from notifications
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'notifications'
  ) INTO v_table_exists;
  IF v_table_exists THEN
    DELETE FROM notifications;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count > 0 THEN RAISE NOTICE '  ✓ Deleted % notifications', v_count; END IF;
    v_total_deleted := v_total_deleted + v_count;
  END IF;

  -- Check and delete operational audit_logs
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'audit_logs'
  ) INTO v_table_exists;
  IF v_table_exists THEN
    DELETE FROM audit_logs WHERE action NOT LIKE 'user_%' AND action NOT LIKE 'role_%';
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count > 0 THEN RAISE NOTICE '  ✓ Deleted % operational audit_logs', v_count; END IF;
    v_total_deleted := v_total_deleted + v_count;
  END IF;

  -- ============================================================================
  -- FINAL SUMMARY
  -- ============================================================================
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'DATA CLEANUP COMPLETED SUCCESSFULLY!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'TOTAL RECORDS DELETED: %', v_total_deleted;
  RAISE NOTICE '';
  RAISE NOTICE 'PRESERVED (Still Active):';
  RAISE NOTICE '-------------------------';
  
  SELECT COUNT(*) INTO v_count FROM user_profiles;
  RAISE NOTICE '  ✓ User accounts: % users', v_count;

  SELECT COUNT(*) INTO v_count FROM user_permissions;
  RAISE NOTICE '  ✓ User permissions: % records', v_count;

  SELECT COUNT(*) INTO v_count FROM modules;
  RAISE NOTICE '  ✓ Modules: % modules', v_count;

  SELECT COUNT(*) INTO v_count FROM sites;
  RAISE NOTICE '  ✓ Sites: % sites', v_count;

  RAISE NOTICE '';
  RAISE NOTICE 'VERIFIED EMPTY:';
  RAISE NOTICE '---------------';

  SELECT COUNT(*) INTO v_count FROM batches;
  RAISE NOTICE '  ✓ Batches: % (should be 0)', v_count;

  SELECT COUNT(*) INTO v_count FROM sales;
  RAISE NOTICE '  ✓ Sales: % (should be 0)', v_count;

  SELECT COUNT(*) INTO v_count FROM payments;
  RAISE NOTICE '  ✓ Payments: % (should be 0)', v_count;

  SELECT COUNT(*) INTO v_count FROM customers;
  RAISE NOTICE '  ✓ Customers: % (should be 0)', v_count;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'READY TO CREATE YOUR OWN DATA!';
  RAISE NOTICE 'Start by creating a batch at /batches/new';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';

END $$;
