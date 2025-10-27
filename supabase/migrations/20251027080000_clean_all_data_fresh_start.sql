/*
  # Clean All Data - Fresh Start

  1. Purpose
     - Remove ALL existing operational data from all tables
     - Preserve user accounts, permissions, and system configuration
     - Provide detailed logging of what was deleted

  2. What Gets Cleaned
     - All sales, payments, customers
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

  -- Sales related child tables first
  DELETE FROM sales_commissions; GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN RAISE NOTICE '  ✓ Deleted % sales_commissions', v_count; v_total_deleted := v_total_deleted + v_count; END IF;

  DELETE FROM sales_notifications_log; GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN RAISE NOTICE '  ✓ Deleted % sales_notifications_log', v_count; v_total_deleted := v_total_deleted + v_count; END IF;

  DELETE FROM sales_documents; GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN RAISE NOTICE '  ✓ Deleted % sales_documents', v_count; v_total_deleted := v_total_deleted + v_count; END IF;

  DELETE FROM sales_payment_schedules; GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN RAISE NOTICE '  ✓ Deleted % sales_payment_schedules', v_count; v_total_deleted := v_total_deleted + v_count; END IF;

  DELETE FROM sales_allocations; GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN RAISE NOTICE '  ✓ Deleted % sales_allocations', v_count; v_total_deleted := v_total_deleted + v_count; END IF;

  DELETE FROM sales_line_items; GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN RAISE NOTICE '  ✓ Deleted % sales_line_items', v_count; v_total_deleted := v_total_deleted + v_count; END IF;

  DELETE FROM sales_audit_trail; GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN RAISE NOTICE '  ✓ Deleted % sales_audit_trail', v_count; v_total_deleted := v_total_deleted + v_count; END IF;

  DELETE FROM sales_approvals; GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN RAISE NOTICE '  ✓ Deleted % sales_approvals', v_count; v_total_deleted := v_total_deleted + v_count; END IF;

  -- Main sales table
  DELETE FROM sales; GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE '  ✓ Deleted % sales', v_count; v_total_deleted := v_total_deleted + v_count;

  -- Payment related tables
  DELETE FROM payment_reminders; GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN RAISE NOTICE '  ✓ Deleted % payment_reminders', v_count; v_total_deleted := v_total_deleted + v_count; END IF;

  DELETE FROM payment_documents; GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN RAISE NOTICE '  ✓ Deleted % payment_documents', v_count; v_total_deleted := v_total_deleted + v_count; END IF;

  DELETE FROM payment_history; GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN RAISE NOTICE '  ✓ Deleted % payment_history', v_count; v_total_deleted := v_total_deleted + v_count; END IF;

  -- Main payments table
  DELETE FROM payments; GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE '  ✓ Deleted % payments', v_count; v_total_deleted := v_total_deleted + v_count;

  -- Customer related
  DELETE FROM customer_contracts; GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN RAISE NOTICE '  ✓ Deleted % customer_contracts', v_count; v_total_deleted := v_total_deleted + v_count; END IF;

  DELETE FROM customers; GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE '  ✓ Deleted % customers', v_count; v_total_deleted := v_total_deleted + v_count;

  DELETE FROM commission_rules; GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN RAISE NOTICE '  ✓ Deleted % commission_rules', v_count; v_total_deleted := v_total_deleted + v_count; END IF;

  -- ============================================================================
  -- STEP 2: Batch and Processing Data
  -- ============================================================================
  RAISE NOTICE '';
  RAISE NOTICE 'STEP 2: Cleaning Batch and Processing Data';
  RAISE NOTICE '-------------------------------------------';

  DELETE FROM batch_tags; GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN RAISE NOTICE '  ✓ Deleted % batch_tags', v_count; v_total_deleted := v_total_deleted + v_count; END IF;

  DELETE FROM batch_documents; GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN RAISE NOTICE '  ✓ Deleted % batch_documents', v_count; v_total_deleted := v_total_deleted + v_count; END IF;

  DELETE FROM batch_quality_checks; GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN RAISE NOTICE '  ✓ Deleted % batch_quality_checks', v_count; v_total_deleted := v_total_deleted + v_count; END IF;

  DELETE FROM batch_reservations; GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN RAISE NOTICE '  ✓ Deleted % batch_reservations', v_count; v_total_deleted := v_total_deleted + v_count; END IF;

  DELETE FROM batch_splits; GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN RAISE NOTICE '  ✓ Deleted % batch_splits', v_count; v_total_deleted := v_total_deleted + v_count; END IF;

  DELETE FROM batch_merges; GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN RAISE NOTICE '  ✓ Deleted % batch_merges', v_count; v_total_deleted := v_total_deleted + v_count; END IF;

  DELETE FROM batch_escalations; GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN RAISE NOTICE '  ✓ Deleted % batch_escalations', v_count; v_total_deleted := v_total_deleted + v_count; END IF;

  DELETE FROM batch_alerts; GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN RAISE NOTICE '  ✓ Deleted % batch_alerts', v_count; v_total_deleted := v_total_deleted + v_count; END IF;

  DELETE FROM batch_approvals; GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN RAISE NOTICE '  ✓ Deleted % batch_approvals', v_count; v_total_deleted := v_total_deleted + v_count; END IF;

  DELETE FROM variance_investigations; GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN RAISE NOTICE '  ✓ Deleted % variance_investigations', v_count; v_total_deleted := v_total_deleted + v_count; END IF;

  DELETE FROM refining_records; GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN RAISE NOTICE '  ✓ Deleted % refining_records', v_count; v_total_deleted := v_total_deleted + v_count; END IF;

  DELETE FROM receiving_records; GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN RAISE NOTICE '  ✓ Deleted % receiving_records', v_count; v_total_deleted := v_total_deleted + v_count; END IF;

  DELETE FROM transportation_details; GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN RAISE NOTICE '  ✓ Deleted % transportation_details', v_count; v_total_deleted := v_total_deleted + v_count; END IF;

  DELETE FROM batch_status_history; GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN RAISE NOTICE '  ✓ Deleted % batch_status_history', v_count; v_total_deleted := v_total_deleted + v_count; END IF;

  -- Main batches table
  DELETE FROM batches; GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE '  ✓ Deleted % batches', v_count; v_total_deleted := v_total_deleted + v_count;

  DELETE FROM saved_batch_searches; GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN RAISE NOTICE '  ✓ Deleted % saved_batch_searches', v_count; v_total_deleted := v_total_deleted + v_count; END IF;

  -- ============================================================================
  -- STEP 3: Workflow and Approval Data
  -- ============================================================================
  RAISE NOTICE '';
  RAISE NOTICE 'STEP 3: Cleaning Workflow and Approval Data';
  RAISE NOTICE '--------------------------------------------';

  DELETE FROM batch_workflow_instances; GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN RAISE NOTICE '  ✓ Deleted % batch_workflow_instances', v_count; v_total_deleted := v_total_deleted + v_count; END IF;

  DELETE FROM workflow_instances; GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN RAISE NOTICE '  ✓ Deleted % workflow_instances', v_count; v_total_deleted := v_total_deleted + v_count; END IF;

  DELETE FROM approval_requests; GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN RAISE NOTICE '  ✓ Deleted % approval_requests', v_count; v_total_deleted := v_total_deleted + v_count; END IF;

  -- ============================================================================
  -- STEP 4: Pricing and Reference Data
  -- ============================================================================
  RAISE NOTICE '';
  RAISE NOTICE 'STEP 4: Cleaning Pricing and Reference Data';
  RAISE NOTICE '--------------------------------------------';

  DELETE FROM gold_prices; GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN RAISE NOTICE '  ✓ Deleted % gold_prices', v_count; v_total_deleted := v_total_deleted + v_count; END IF;

  DELETE FROM gold_prices_daily; GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN RAISE NOTICE '  ✓ Deleted % gold_prices_daily', v_count; v_total_deleted := v_total_deleted + v_count; END IF;

  DELETE FROM gold_prices_monthly; GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN RAISE NOTICE '  ✓ Deleted % gold_prices_monthly', v_count; v_total_deleted := v_total_deleted + v_count; END IF;

  DELETE FROM exchange_rates; GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN RAISE NOTICE '  ✓ Deleted % exchange_rates', v_count; v_total_deleted := v_total_deleted + v_count; END IF;

  -- ============================================================================
  -- STEP 5: Analytics and Reporting Data
  -- ============================================================================
  RAISE NOTICE '';
  RAISE NOTICE 'STEP 5: Cleaning Analytics Data';
  RAISE NOTICE '--------------------------------';

  DELETE FROM batch_analytics_snapshots; GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN RAISE NOTICE '  ✓ Deleted % batch_analytics_snapshots', v_count; v_total_deleted := v_total_deleted + v_count; END IF;

  DELETE FROM analytics_cache; GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN RAISE NOTICE '  ✓ Deleted % analytics_cache', v_count; v_total_deleted := v_total_deleted + v_count; END IF;

  DELETE FROM business_rules; GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN RAISE NOTICE '  ✓ Deleted % business_rules', v_count; v_total_deleted := v_total_deleted + v_count; END IF;

  -- ============================================================================
  -- STEP 6: Notifications and System Logs
  -- ============================================================================
  RAISE NOTICE '';
  RAISE NOTICE 'STEP 6: Cleaning Notifications and Logs';
  RAISE NOTICE '---------------------------------------';

  DELETE FROM email_queue; GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN RAISE NOTICE '  ✓ Deleted % email_queue', v_count; v_total_deleted := v_total_deleted + v_count; END IF;

  DELETE FROM email_logs; GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN RAISE NOTICE '  ✓ Deleted % email_logs', v_count; v_total_deleted := v_total_deleted + v_count; END IF;

  DELETE FROM notifications; GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN RAISE NOTICE '  ✓ Deleted % notifications', v_count; v_total_deleted := v_total_deleted + v_count; END IF;

  DELETE FROM scheduled_tasks; GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN RAISE NOTICE '  ✓ Deleted % scheduled_tasks', v_count; v_total_deleted := v_total_deleted + v_count; END IF;

  DELETE FROM audit_logs WHERE action NOT LIKE 'user_%' AND action NOT LIKE 'role_%';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN RAISE NOTICE '  ✓ Deleted % operational audit_logs', v_count; v_total_deleted := v_total_deleted + v_count; END IF;

  DELETE FROM security_events; GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN RAISE NOTICE '  ✓ Deleted % security_events', v_count; v_total_deleted := v_total_deleted + v_count; END IF;

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
