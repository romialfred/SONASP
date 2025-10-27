/*
  # Clean All Data - Fresh Start

  1. Purpose
     - Remove all existing data from all tables
     - Keep table structures and RLS policies intact
     - Preserve user accounts and permissions
     - Allow user to create their own data from scratch

  2. Tables Cleaned
     - All batch-related tables
     - Sales and customer data
     - Payment records
     - Gold prices and FX rates
     - Workflow and approval data
     - Analytics and audit logs
     - EXCEPT: users, user_profiles, user_permissions, modules, sites

  3. What's Preserved
     - User accounts and authentication
     - User roles and permissions
     - System modules configuration
     - Site/location definitions
     - RLS policies and functions
     - Table structures
*/

-- Delete data in correct order to respect foreign key constraints

DO $$
DECLARE
  v_count INT;
BEGIN
  RAISE NOTICE 'Starting data cleanup...';

  -- Sales and payment data
  RAISE NOTICE 'Cleaning sales and payment data...';
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sales_line_items') THEN
    DELETE FROM sales_line_items;
    RAISE NOTICE '  Deleted sales_line_items';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'sales') THEN
    DELETE FROM sales;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '  Deleted % sales records', v_count;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payments') THEN
    DELETE FROM payments;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '  Deleted % payment records', v_count;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'customers') THEN
    DELETE FROM customers;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '  Deleted % customer records', v_count;
  END IF;

  -- Batch and process data
  RAISE NOTICE 'Cleaning batch and processing data...';
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'batch_documents') THEN
    DELETE FROM batch_documents;
    RAISE NOTICE '  Deleted batch_documents';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'refining_records') THEN
    DELETE FROM refining_records;
    RAISE NOTICE '  Deleted refining_records';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'receiving_records') THEN
    DELETE FROM receiving_records;
    RAISE NOTICE '  Deleted receiving_records';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'batch_status_history') THEN
    DELETE FROM batch_status_history;
    RAISE NOTICE '  Deleted batch_status_history';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'batches') THEN
    DELETE FROM batches;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '  Deleted % batch records', v_count;
  END IF;

  -- Workflow and approval data
  RAISE NOTICE 'Cleaning workflow and approval data...';
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'workflow_instances') THEN
    DELETE FROM workflow_instances;
    RAISE NOTICE '  Deleted workflow_instances';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'approval_requests') THEN
    DELETE FROM approval_requests;
    RAISE NOTICE '  Deleted approval_requests';
  END IF;

  -- Pricing data
  RAISE NOTICE 'Cleaning pricing data...';
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'gold_prices') THEN
    DELETE FROM gold_prices;
    RAISE NOTICE '  Deleted gold_prices';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'exchange_rates') THEN
    DELETE FROM exchange_rates;
    RAISE NOTICE '  Deleted exchange_rates';
  END IF;

  -- Notifications and logs
  RAISE NOTICE 'Cleaning notifications and logs...';
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN
    DELETE FROM notifications;
    RAISE NOTICE '  Deleted notifications';
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_logs') THEN
    DELETE FROM audit_logs WHERE action NOT LIKE 'user_%' AND action NOT LIKE 'role_%';
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE '  Deleted % operational audit_logs', v_count;
  END IF;

  -- Verification
  RAISE NOTICE '';
  RAISE NOTICE '======================================';
  RAISE NOTICE 'Data cleanup completed!';
  RAISE NOTICE '======================================';
  RAISE NOTICE '';
  RAISE NOTICE 'PRESERVED:';

  SELECT COUNT(*) INTO v_count FROM user_profiles;
  RAISE NOTICE '  User accounts: % users', v_count;

  SELECT COUNT(*) INTO v_count FROM user_permissions;
  RAISE NOTICE '  User permissions: % records', v_count;

  SELECT COUNT(*) INTO v_count FROM modules;
  RAISE NOTICE '  Modules: % modules', v_count;

  SELECT COUNT(*) INTO v_count FROM sites;
  RAISE NOTICE '  Sites: % sites', v_count;

  RAISE NOTICE '';
  RAISE NOTICE 'CLEANED (now empty):';

  SELECT COUNT(*) INTO v_count FROM batches;
  RAISE NOTICE '  Batches: % records', v_count;

  SELECT COUNT(*) INTO v_count FROM sales;
  RAISE NOTICE '  Sales: % records', v_count;

  SELECT COUNT(*) INTO v_count FROM payments;
  RAISE NOTICE '  Payments: % records', v_count;

  SELECT COUNT(*) INTO v_count FROM customers;
  RAISE NOTICE '  Customers: % records', v_count;

  RAISE NOTICE '';
  RAISE NOTICE 'Ready for your own data!';
  RAISE NOTICE '======================================';

END $$;
