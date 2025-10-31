/*
  # Clean Transactional Data - Fresh Database for Registration

  ## Purpose
  This migration cleans all transactional data (batches, inventory, sales, payments, customers)
  while preserving:
  - Stakeholders (mining companies, refineries, freight companies)
  - FX Rates (exchange rate data)
  - Gold Prices (gold price history)
  - System configuration (users, roles, permissions, parameters)
  - Site information

  ## Tables to Clean (in order to respect foreign key constraints)

  ### 1. Sales Related
  - sales_notifications_log
  - sales_audit_trail
  - sales_documents
  - sales_commissions
  - sales_payment_schedules
  - sales_approvals
  - sales_line_items
  - sales_allocations
  - sale_pricing_details
  - sale_quantity_recommendations
  - sales

  ### 2. Payment Related
  - payment_documents
  - payment_history
  - payment_reminders
  - payments

  ### 3. Customer Related
  - customer_contracts
  - customer_fx_rates
  - customers

  ### 4. Batch Related
  - batch_alerts
  - batch_analytics_snapshots
  - batch_approvals
  - batch_documents
  - batch_escalations
  - batch_merges
  - batch_quality_checks
  - batch_reservations
  - batch_splits
  - batch_status_history
  - batch_status_transitions
  - batch_tags
  - batch_workflow_instances
  - batch_workflow_definitions
  - batches

  ### 5. Inventory Related
  - inventory_transactions
  - gold_inventory

  ### 6. Processing Related
  - variance_investigations
  - refining_records
  - receiving_records
  - transportation_details

  ### 7. Other Transactional
  - approval_requests
  - email_logs
  - commission_rules
  - saved_batch_searches

  ## Preserved Tables
  - mining_companies
  - refineries
  - freight_companies
  - fx_rates
  - fx_rate_sources
  - gold_prices
  - user_profiles
  - roles
  - permissions
  - system_parameters
  - sites
*/

-- ============================================================================
-- DISABLE TRIGGERS TEMPORARILY FOR FASTER DELETION
-- ============================================================================

SET session_replication_role = 'replica';

-- ============================================================================
-- 1. SALES RELATED TABLES (Delete in dependency order)
-- ============================================================================

DO $$
BEGIN
  -- Sales notifications and audit
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'sales_notifications_log') THEN
    DELETE FROM sales_notifications_log;
    RAISE NOTICE 'Cleaned: sales_notifications_log';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'sales_audit_trail') THEN
    DELETE FROM sales_audit_trail;
    RAISE NOTICE 'Cleaned: sales_audit_trail';
  END IF;

  -- Sales documents
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'sales_documents') THEN
    DELETE FROM sales_documents;
    RAISE NOTICE 'Cleaned: sales_documents';
  END IF;

  -- Sales commissions
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'sales_commissions') THEN
    DELETE FROM sales_commissions;
    RAISE NOTICE 'Cleaned: sales_commissions';
  END IF;

  -- Sales payment schedules
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'sales_payment_schedules') THEN
    DELETE FROM sales_payment_schedules;
    RAISE NOTICE 'Cleaned: sales_payment_schedules';
  END IF;

  -- Sales approvals
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'sales_approvals') THEN
    DELETE FROM sales_approvals;
    RAISE NOTICE 'Cleaned: sales_approvals';
  END IF;

  -- Sales line items
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'sales_line_items') THEN
    DELETE FROM sales_line_items;
    RAISE NOTICE 'Cleaned: sales_line_items';
  END IF;

  -- Sales allocations
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'sales_allocations') THEN
    DELETE FROM sales_allocations;
    RAISE NOTICE 'Cleaned: sales_allocations';
  END IF;

  -- Sale pricing details
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'sale_pricing_details') THEN
    DELETE FROM sale_pricing_details;
    RAISE NOTICE 'Cleaned: sale_pricing_details';
  END IF;

  -- Sale quantity recommendations
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'sale_quantity_recommendations') THEN
    DELETE FROM sale_quantity_recommendations;
    RAISE NOTICE 'Cleaned: sale_quantity_recommendations';
  END IF;

  -- Main sales table
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'sales') THEN
    DELETE FROM sales;
    RAISE NOTICE 'Cleaned: sales';
  END IF;
END $$;

-- ============================================================================
-- 2. PAYMENT RELATED TABLES
-- ============================================================================

DO $$
BEGIN
  -- Payment documents
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'payment_documents') THEN
    DELETE FROM payment_documents;
    RAISE NOTICE 'Cleaned: payment_documents';
  END IF;

  -- Payment history
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'payment_history') THEN
    DELETE FROM payment_history;
    RAISE NOTICE 'Cleaned: payment_history';
  END IF;

  -- Payment reminders
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'payment_reminders') THEN
    DELETE FROM payment_reminders;
    RAISE NOTICE 'Cleaned: payment_reminders';
  END IF;

  -- Main payments table
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'payments') THEN
    DELETE FROM payments;
    RAISE NOTICE 'Cleaned: payments';
  END IF;
END $$;

-- ============================================================================
-- 3. CUSTOMER RELATED TABLES
-- ============================================================================

DO $$
BEGIN
  -- Customer contracts
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'customer_contracts') THEN
    DELETE FROM customer_contracts;
    RAISE NOTICE 'Cleaned: customer_contracts';
  END IF;

  -- Customer FX rates
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'customer_fx_rates') THEN
    DELETE FROM customer_fx_rates;
    RAISE NOTICE 'Cleaned: customer_fx_rates';
  END IF;

  -- Main customers table
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'customers') THEN
    DELETE FROM customers;
    RAISE NOTICE 'Cleaned: customers';
  END IF;
END $$;

-- ============================================================================
-- 4. BATCH RELATED TABLES (Delete in dependency order)
-- ============================================================================

DO $$
BEGIN
  -- Batch alerts
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'batch_alerts') THEN
    DELETE FROM batch_alerts;
    RAISE NOTICE 'Cleaned: batch_alerts';
  END IF;

  -- Batch analytics snapshots
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'batch_analytics_snapshots') THEN
    DELETE FROM batch_analytics_snapshots;
    RAISE NOTICE 'Cleaned: batch_analytics_snapshots';
  END IF;

  -- Batch approvals
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'batch_approvals') THEN
    DELETE FROM batch_approvals;
    RAISE NOTICE 'Cleaned: batch_approvals';
  END IF;

  -- Batch documents
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'batch_documents') THEN
    DELETE FROM batch_documents;
    RAISE NOTICE 'Cleaned: batch_documents';
  END IF;

  -- Batch escalations
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'batch_escalations') THEN
    DELETE FROM batch_escalations;
    RAISE NOTICE 'Cleaned: batch_escalations';
  END IF;

  -- Batch merges
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'batch_merges') THEN
    DELETE FROM batch_merges;
    RAISE NOTICE 'Cleaned: batch_merges';
  END IF;

  -- Batch quality checks
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'batch_quality_checks') THEN
    DELETE FROM batch_quality_checks;
    RAISE NOTICE 'Cleaned: batch_quality_checks';
  END IF;

  -- Batch reservations
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'batch_reservations') THEN
    DELETE FROM batch_reservations;
    RAISE NOTICE 'Cleaned: batch_reservations';
  END IF;

  -- Batch splits
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'batch_splits') THEN
    DELETE FROM batch_splits;
    RAISE NOTICE 'Cleaned: batch_splits';
  END IF;

  -- Batch status history
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'batch_status_history') THEN
    DELETE FROM batch_status_history;
    RAISE NOTICE 'Cleaned: batch_status_history';
  END IF;

  -- Batch status transitions
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'batch_status_transitions') THEN
    DELETE FROM batch_status_transitions;
    RAISE NOTICE 'Cleaned: batch_status_transitions';
  END IF;

  -- Batch tags
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'batch_tags') THEN
    DELETE FROM batch_tags;
    RAISE NOTICE 'Cleaned: batch_tags';
  END IF;

  -- Batch workflow instances (before definitions)
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'batch_workflow_instances') THEN
    DELETE FROM batch_workflow_instances;
    RAISE NOTICE 'Cleaned: batch_workflow_instances';
  END IF;

  -- Batch workflow definitions
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'batch_workflow_definitions') THEN
    DELETE FROM batch_workflow_definitions;
    RAISE NOTICE 'Cleaned: batch_workflow_definitions';
  END IF;

  -- Main batches table
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'batches') THEN
    DELETE FROM batches;
    RAISE NOTICE 'Cleaned: batches';
  END IF;
END $$;

-- ============================================================================
-- 5. INVENTORY RELATED TABLES
-- ============================================================================

DO $$
BEGIN
  -- Inventory transactions (before main inventory)
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'inventory_transactions') THEN
    DELETE FROM inventory_transactions;
    RAISE NOTICE 'Cleaned: inventory_transactions';
  END IF;

  -- Main gold inventory table
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'gold_inventory') THEN
    DELETE FROM gold_inventory;
    RAISE NOTICE 'Cleaned: gold_inventory';
  END IF;
END $$;

-- ============================================================================
-- 6. PROCESSING RELATED TABLES
-- ============================================================================

DO $$
BEGIN
  -- Variance investigations
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'variance_investigations') THEN
    DELETE FROM variance_investigations;
    RAISE NOTICE 'Cleaned: variance_investigations';
  END IF;

  -- Refining records
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'refining_records') THEN
    DELETE FROM refining_records;
    RAISE NOTICE 'Cleaned: refining_records';
  END IF;

  -- Receiving records
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'receiving_records') THEN
    DELETE FROM receiving_records;
    RAISE NOTICE 'Cleaned: receiving_records';
  END IF;

  -- Transportation details
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'transportation_details') THEN
    DELETE FROM transportation_details;
    RAISE NOTICE 'Cleaned: transportation_details';
  END IF;
END $$;

-- ============================================================================
-- 7. OTHER TRANSACTIONAL TABLES
-- ============================================================================

DO $$
BEGIN
  -- Approval requests
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'approval_requests') THEN
    DELETE FROM approval_requests;
    RAISE NOTICE 'Cleaned: approval_requests';
  END IF;

  -- Email logs (optional - keep if you want email history)
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'email_logs') THEN
    DELETE FROM email_logs;
    RAISE NOTICE 'Cleaned: email_logs';
  END IF;

  -- Commission rules (optional - delete if customer-specific)
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'commission_rules') THEN
    DELETE FROM commission_rules;
    RAISE NOTICE 'Cleaned: commission_rules';
  END IF;

  -- Saved batch searches
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'saved_batch_searches') THEN
    DELETE FROM saved_batch_searches;
    RAISE NOTICE 'Cleaned: saved_batch_searches';
  END IF;

  -- Audit logs (optional - uncomment to clean audit history)
  -- IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
  --   DELETE FROM audit_logs;
  --   RAISE NOTICE 'Cleaned: audit_logs';
  -- END IF;
END $$;

-- ============================================================================
-- RE-ENABLE TRIGGERS
-- ============================================================================

SET session_replication_role = 'default';

-- ============================================================================
-- RESET SEQUENCES (Auto-increment counters)
-- ============================================================================

DO $$
DECLARE
  seq_record RECORD;
BEGIN
  -- Reset all sequences to 1
  FOR seq_record IN
    SELECT
      schemaname,
      sequencename
    FROM pg_sequences
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER SEQUENCE %I.%I RESTART WITH 1', seq_record.schemaname, seq_record.sequencename);
    RAISE NOTICE 'Reset sequence: %.%', seq_record.schemaname, seq_record.sequencename;
  END LOOP;
END $$;

-- ============================================================================
-- VACUUM AND ANALYZE (Optimize database after mass deletion)
-- ============================================================================

VACUUM ANALYZE;

-- ============================================================================
-- SUMMARY
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE 'DATABASE CLEANUP COMPLETED SUCCESSFULLY';
  RAISE NOTICE '=============================================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'CLEANED TABLES:';
  RAISE NOTICE '  ✓ All Sales data (sales, line items, approvals, documents, etc.)';
  RAISE NOTICE '  ✓ All Payment data (payments, history, documents, reminders)';
  RAISE NOTICE '  ✓ All Customer data (customers, contracts, fx rates)';
  RAISE NOTICE '  ✓ All Batch data (batches, approvals, documents, history, etc.)';
  RAISE NOTICE '  ✓ All Inventory data (gold_inventory, transactions)';
  RAISE NOTICE '  ✓ All Processing data (receiving, refining, transportation)';
  RAISE NOTICE '  ✓ All Transactional support data';
  RAISE NOTICE '';
  RAISE NOTICE 'PRESERVED TABLES:';
  RAISE NOTICE '  ✓ Stakeholders (mining_companies, refineries, freight_companies)';
  RAISE NOTICE '  ✓ FX Rates (fx_rates, fx_rate_sources)';
  RAISE NOTICE '  ✓ Gold Prices (gold_prices)';
  RAISE NOTICE '  ✓ System Config (users, roles, permissions, parameters)';
  RAISE NOTICE '  ✓ Site Information (sites)';
  RAISE NOTICE '';
  RAISE NOTICE 'DATABASE IS NOW READY FOR FRESH REGISTRATION!';
  RAISE NOTICE '=============================================================================';
END $$;
