/*
  # Clean All Data - Fresh Start

  1. Purpose
     - Remove all existing data from all tables
     - Keep table structures and RLS policies intact
     - Preserve user accounts and permissions
     - Reset sequences and auto-increment values
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

-- ============================================================================
-- IMPORTANT: Delete data in correct order to respect foreign key constraints
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Starting data cleanup...';

  -- ============================================================================
  -- STEP 1: Clean transaction and financial data
  -- ============================================================================

  RAISE NOTICE 'Cleaning payment and financial data...';

  -- Payment line items (references payments and batches)
  DELETE FROM payment_line_items;
  RAISE NOTICE 'Deleted payment_line_items';

  -- Payments (references sales, customers)
  DELETE FROM payments;
  RAISE NOTICE 'Deleted payments';

  -- Sale line items (references sales and batches)
  DELETE FROM sale_line_items;
  RAISE NOTICE 'Deleted sale_line_items';

  -- Sales (references customers, batches)
  DELETE FROM sales;
  RAISE NOTICE 'Deleted sales';

  -- Customer contacts
  DELETE FROM customer_contacts;
  RAISE NOTICE 'Deleted customer_contacts';

  -- Customers
  DELETE FROM customers;
  RAISE NOTICE 'Deleted customers';

  -- ============================================================================
  -- STEP 2: Clean batch and process data
  -- ============================================================================

  RAISE NOTICE 'Cleaning batch and processing data...';

  -- Batch documents
  DELETE FROM batch_documents;
  RAISE NOTICE 'Deleted batch_documents';

  -- Quality checks
  DELETE FROM quality_checks;
  RAISE NOTICE 'Deleted quality_checks';

  -- Refining records (references batches)
  DELETE FROM refining;
  RAISE NOTICE 'Deleted refining';

  -- Airport receiving records
  DELETE FROM airport_receiving;
  RAISE NOTICE 'Deleted airport_receiving';

  -- Batch status history
  DELETE FROM batch_status_history;
  RAISE NOTICE 'Deleted batch_status_history';

  -- Batch details (child table)
  DELETE FROM batch_details;
  RAISE NOTICE 'Deleted batch_details';

  -- Batches (parent table)
  DELETE FROM batches;
  RAISE NOTICE 'Deleted batches';

  -- ============================================================================
  -- STEP 3: Clean workflow and approval data
  -- ============================================================================

  RAISE NOTICE 'Cleaning workflow and approval data...';

  -- Approval request participants
  DELETE FROM approval_request_participants;
  RAISE NOTICE 'Deleted approval_request_participants';

  -- Approval requests
  DELETE FROM approval_requests;
  RAISE NOTICE 'Deleted approval_requests';

  -- Workflow state history
  DELETE FROM workflow_state_history;
  RAISE NOTICE 'Deleted workflow_state_history';

  -- Workflow states
  DELETE FROM workflow_states;
  RAISE NOTICE 'Deleted workflow_states';

  -- Workflow instances
  DELETE FROM workflow_instances;
  RAISE NOTICE 'Deleted workflow_instances';

  -- ============================================================================
  -- STEP 4: Clean reference and pricing data
  -- ============================================================================

  RAISE NOTICE 'Cleaning pricing and reference data...';

  -- Gold prices
  DELETE FROM gold_prices;
  RAISE NOTICE 'Deleted gold_prices';

  -- FX rates
  DELETE FROM fx_rates;
  RAISE NOTICE 'Deleted fx_rates';

  -- Transport companies (if any data exists)
  DELETE FROM transport_companies WHERE id IS NOT NULL;
  RAISE NOTICE 'Deleted transport_companies data';

  -- Refineries (if any data exists)
  DELETE FROM refineries WHERE id IS NOT NULL;
  RAISE NOTICE 'Deleted refineries data';

  -- ============================================================================
  -- STEP 5: Clean analytics and reporting data
  -- ============================================================================

  RAISE NOTICE 'Cleaning analytics data...';

  -- Saved searches
  DELETE FROM saved_searches;
  RAISE NOTICE 'Deleted saved_searches';

  -- Business rules
  DELETE FROM business_rules;
  RAISE NOTICE 'Deleted business_rules';

  -- ============================================================================
  -- STEP 6: Clean audit and notification data
  -- ============================================================================

  RAISE NOTICE 'Cleaning audit logs and notifications...';

  -- Audit logs (keep user management audits, delete operational audits)
  DELETE FROM audit_logs WHERE action NOT IN ('user_created', 'user_updated', 'role_assigned');
  RAISE NOTICE 'Deleted operational audit_logs';

  -- Notifications
  DELETE FROM notifications;
  RAISE NOTICE 'Deleted notifications';

  -- ============================================================================
  -- STEP 7: Reset sequences (if any)
  -- ============================================================================

  RAISE NOTICE 'Resetting any sequences...';

  -- Note: Most tables use UUID, but if any use sequences, they would be reset here
  -- Example: ALTER SEQUENCE some_sequence RESTART WITH 1;

  -- ============================================================================
  -- VERIFICATION
  -- ============================================================================

  RAISE NOTICE '======================================';
  RAISE NOTICE 'Data cleanup completed successfully!';
  RAISE NOTICE '======================================';
  RAISE NOTICE 'Preserved:';
  RAISE NOTICE '  - User accounts: % users', (SELECT COUNT(*) FROM user_profiles);
  RAISE NOTICE '  - User permissions: % permission records', (SELECT COUNT(*) FROM user_permissions);
  RAISE NOTICE '  - Modules: % modules', (SELECT COUNT(*) FROM modules);
  RAISE NOTICE '  - Sites: % sites', (SELECT COUNT(*) FROM sites);
  RAISE NOTICE '';
  RAISE NOTICE 'Cleaned (now empty):';
  RAISE NOTICE '  - Batches: % records', (SELECT COUNT(*) FROM batches);
  RAISE NOTICE '  - Sales: % records', (SELECT COUNT(*) FROM sales);
  RAISE NOTICE '  - Payments: % records', (SELECT COUNT(*) FROM payments);
  RAISE NOTICE '  - Customers: % records', (SELECT COUNT(*) FROM customers);
  RAISE NOTICE '';
  RAISE NOTICE 'You can now create your own data!';
  RAISE NOTICE '======================================';

END $$;

-- ============================================================================
-- Optional: Add helpful comment
-- ============================================================================

COMMENT ON TABLE batches IS 'Empty - Ready for user data. Create batches through the application.';
COMMENT ON TABLE customers IS 'Empty - Ready for user data. Add customers through the application.';
COMMENT ON TABLE sales IS 'Empty - Ready for user data. Create sales through the application.';
COMMENT ON TABLE payments IS 'Empty - Ready for user data. Process payments through the application.';
