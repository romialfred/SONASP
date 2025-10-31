/*
  # Clean Batch-Related Data

  ## Purpose
  Remove all operational data from batch-related tables while preserving:
  - User accounts and profiles
  - System configuration (sites, transport companies, refineries)
  - Permission structures
  - Customer records (if needed)

  ## Tables Cleaned
  - batches and all related tables
  - receiving_records
  - refining_records
  - batch_documents
  - batch_status_history
  - batch_quality_checks
  - batch_splits
  - batch_merges
  - transportation_details
  - batch_alerts
  - variance_investigations
  - batch_reservations
  - batch_tags
  - sales_allocations
  - sales_line_items

  ## What is Preserved
  - User profiles and authentication
  - Sites configuration
  - Transport companies
  - Refineries
  - Customers (optional - can be cleaned too)
  - System settings
*/

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'CLEANING BATCH-RELATED DATA';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
END $$;

-- ============================================================================
-- STEP 1: Clean Sales-Related Data (depends on batches)
-- ============================================================================
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  RAISE NOTICE 'STEP 1: Cleaning sales-related data...';

  -- Sales allocations
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales_allocations') THEN
    SELECT COUNT(*) INTO v_count FROM sales_allocations;
    DELETE FROM sales_allocations;
    RAISE NOTICE '  ✓ Deleted % sales allocations', v_count;
  END IF;

  -- Sales line items
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales_line_items') THEN
    SELECT COUNT(*) INTO v_count FROM sales_line_items;
    DELETE FROM sales_line_items;
    RAISE NOTICE '  ✓ Deleted % sales line items', v_count;
  END IF;

  -- Sales commissions
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales_commissions') THEN
    SELECT COUNT(*) INTO v_count FROM sales_commissions;
    DELETE FROM sales_commissions;
    RAISE NOTICE '  ✓ Deleted % sales commissions', v_count;
  END IF;

  -- Sales approvals
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales_approvals') THEN
    SELECT COUNT(*) INTO v_count FROM sales_approvals;
    DELETE FROM sales_approvals;
    RAISE NOTICE '  ✓ Deleted % sales approvals', v_count;
  END IF;

  -- Sales audit trail
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales_audit_trail') THEN
    SELECT COUNT(*) INTO v_count FROM sales_audit_trail;
    DELETE FROM sales_audit_trail;
    RAISE NOTICE '  ✓ Deleted % sales audit records', v_count;
  END IF;

  -- Sales payment schedules
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales_payment_schedules') THEN
    SELECT COUNT(*) INTO v_count FROM sales_payment_schedules;
    DELETE FROM sales_payment_schedules;
    RAISE NOTICE '  ✓ Deleted % payment schedules', v_count;
  END IF;

  -- Sales documents
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales_documents') THEN
    SELECT COUNT(*) INTO v_count FROM sales_documents;
    DELETE FROM sales_documents;
    RAISE NOTICE '  ✓ Deleted % sales documents', v_count;
  END IF;

  -- Sales notifications
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales_notifications_log') THEN
    SELECT COUNT(*) INTO v_count FROM sales_notifications_log;
    DELETE FROM sales_notifications_log;
    RAISE NOTICE '  ✓ Deleted % sales notifications', v_count;
  END IF;

END $$;

-- ============================================================================
-- STEP 2: Clean Payment Data
-- ============================================================================
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'STEP 2: Cleaning payment data...';

  -- Payment reminders
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payment_reminders') THEN
    SELECT COUNT(*) INTO v_count FROM payment_reminders;
    DELETE FROM payment_reminders;
    RAISE NOTICE '  ✓ Deleted % payment reminders', v_count;
  END IF;

  -- Payment documents
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payment_documents') THEN
    SELECT COUNT(*) INTO v_count FROM payment_documents;
    DELETE FROM payment_documents;
    RAISE NOTICE '  ✓ Deleted % payment documents', v_count;
  END IF;

  -- Payment history
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payment_history') THEN
    SELECT COUNT(*) INTO v_count FROM payment_history;
    DELETE FROM payment_history;
    RAISE NOTICE '  ✓ Deleted % payment history records', v_count;
  END IF;

  -- Payments (main table)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments') THEN
    SELECT COUNT(*) INTO v_count FROM payments;
    DELETE FROM payments;
    RAISE NOTICE '  ✓ Deleted % payments', v_count;
  END IF;

  -- Email logs
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'email_logs') THEN
    SELECT COUNT(*) INTO v_count FROM email_logs;
    DELETE FROM email_logs;
    RAISE NOTICE '  ✓ Deleted % email logs', v_count;
  END IF;

END $$;

-- ============================================================================
-- STEP 3: Clean Sales Data
-- ============================================================================
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'STEP 3: Cleaning sales data...';

  -- Sales (main table) - CASCADE will clean related records
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales') THEN
    SELECT COUNT(*) INTO v_count FROM sales;
    DELETE FROM sales;
    RAISE NOTICE '  ✓ Deleted % sales records', v_count;
  END IF;

END $$;

-- ============================================================================
-- STEP 4: Clean Batch Enhancement Tables
-- ============================================================================
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'STEP 4: Cleaning batch enhancement data...';

  -- Batch tags
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'batch_tags') THEN
    SELECT COUNT(*) INTO v_count FROM batch_tags;
    DELETE FROM batch_tags;
    RAISE NOTICE '  ✓ Deleted % batch tags', v_count;
  END IF;

  -- Batch reservations
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'batch_reservations') THEN
    SELECT COUNT(*) INTO v_count FROM batch_reservations;
    DELETE FROM batch_reservations;
    RAISE NOTICE '  ✓ Deleted % batch reservations', v_count;
  END IF;

  -- Variance investigations
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'variance_investigations') THEN
    SELECT COUNT(*) INTO v_count FROM variance_investigations;
    DELETE FROM variance_investigations;
    RAISE NOTICE '  ✓ Deleted % variance investigations', v_count;
  END IF;

  -- Batch alerts
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'batch_alerts') THEN
    SELECT COUNT(*) INTO v_count FROM batch_alerts;
    DELETE FROM batch_alerts;
    RAISE NOTICE '  ✓ Deleted % batch alerts', v_count;
  END IF;

  -- Transportation details
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transportation_details') THEN
    SELECT COUNT(*) INTO v_count FROM transportation_details;
    DELETE FROM transportation_details;
    RAISE NOTICE '  ✓ Deleted % transportation details', v_count;
  END IF;

  -- Batch merges
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'batch_merges') THEN
    SELECT COUNT(*) INTO v_count FROM batch_merges;
    DELETE FROM batch_merges;
    RAISE NOTICE '  ✓ Deleted % batch merges', v_count;
  END IF;

  -- Batch splits
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'batch_splits') THEN
    SELECT COUNT(*) INTO v_count FROM batch_splits;
    DELETE FROM batch_splits;
    RAISE NOTICE '  ✓ Deleted % batch splits', v_count;
  END IF;

  -- Batch quality checks
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'batch_quality_checks') THEN
    SELECT COUNT(*) INTO v_count FROM batch_quality_checks;
    DELETE FROM batch_quality_checks;
    RAISE NOTICE '  ✓ Deleted % batch quality checks', v_count;
  END IF;

END $$;

-- ============================================================================
-- STEP 5: Clean Core Batch-Related Tables
-- ============================================================================
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'STEP 5: Cleaning core batch data...';

  -- Batch documents
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'batch_documents') THEN
    SELECT COUNT(*) INTO v_count FROM batch_documents;
    DELETE FROM batch_documents;
    RAISE NOTICE '  ✓ Deleted % batch documents', v_count;
  END IF;

  -- Refining records
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'refining_records') THEN
    SELECT COUNT(*) INTO v_count FROM refining_records;
    DELETE FROM refining_records;
    RAISE NOTICE '  ✓ Deleted % refining records', v_count;
  END IF;

  -- Receiving records
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'receiving_records') THEN
    SELECT COUNT(*) INTO v_count FROM receiving_records;
    DELETE FROM receiving_records;
    RAISE NOTICE '  ✓ Deleted % receiving records', v_count;
  END IF;

  -- Batch status history
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'batch_status_history') THEN
    SELECT COUNT(*) INTO v_count FROM batch_status_history;
    DELETE FROM batch_status_history;
    RAISE NOTICE '  ✓ Deleted % batch status history records', v_count;
  END IF;

  -- Batches (main table) - CASCADE will clean any remaining related records
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'batches') THEN
    SELECT COUNT(*) INTO v_count FROM batches;
    DELETE FROM batches;
    RAISE NOTICE '  ✓ Deleted % batches', v_count;
  END IF;

END $$;

-- ============================================================================
-- STEP 6: Clean Audit and System Logs
-- ============================================================================
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'STEP 6: Cleaning audit and system logs...';

  -- Audit logs (operational data only, not security events)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
    SELECT COUNT(*) INTO v_count FROM audit_logs WHERE module IN ('batches', 'sales', 'payments', 'refining', 'receiving');
    DELETE FROM audit_logs WHERE module IN ('batches', 'sales', 'payments', 'refining', 'receiving');
    RAISE NOTICE '  ✓ Deleted % operational audit log entries', v_count;
  END IF;

END $$;

-- ============================================================================
-- OPTIONAL: Clean Customer Data (uncomment if you want to remove customers)
-- ============================================================================
-- DO $$
-- DECLARE
--   v_count INTEGER;
-- BEGIN
--   RAISE NOTICE '';
--   RAISE NOTICE 'OPTIONAL: Cleaning customer data...';
--
--   -- Customer contracts
--   IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customer_contracts') THEN
--     SELECT COUNT(*) INTO v_count FROM customer_contracts;
--     DELETE FROM customer_contracts;
--     RAISE NOTICE '  ✓ Deleted % customer contracts', v_count;
--   END IF;
--
--   -- Customers
--   IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customers') THEN
--     SELECT COUNT(*) INTO v_count FROM customers;
--     DELETE FROM customers;
--     RAISE NOTICE '  ✓ Deleted % customers', v_count;
--   END IF;
--
-- END $$;

-- ============================================================================
-- FINAL SUMMARY
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'BATCH DATA CLEANUP COMPLETED!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'What was cleaned:';
  RAISE NOTICE '-----------------';
  RAISE NOTICE '✓ All batches and batch history';
  RAISE NOTICE '✓ All receiving records';
  RAISE NOTICE '✓ All refining records';
  RAISE NOTICE '✓ All sales and related data';
  RAISE NOTICE '✓ All payments and related data';
  RAISE NOTICE '✓ All batch documents and attachments';
  RAISE NOTICE '✓ All quality checks and alerts';
  RAISE NOTICE '✓ All operational audit logs';
  RAISE NOTICE '';
  RAISE NOTICE 'What was preserved:';
  RAISE NOTICE '-------------------';
  RAISE NOTICE '✓ User accounts and profiles';
  RAISE NOTICE '✓ Sites configuration';
  RAISE NOTICE '✓ Transport companies';
  RAISE NOTICE '✓ Refineries';
  RAISE NOTICE '✓ Customers (uncomment optional section to clean)';
  RAISE NOTICE '✓ User permissions and roles';
  RAISE NOTICE '✓ System settings';
  RAISE NOTICE '';
  RAISE NOTICE 'Your database is now clean and ready for fresh data!';
  RAISE NOTICE '========================================';
END $$;
