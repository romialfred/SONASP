/*
  ============================================================================
  DELETE ALL SALES DATA - CORRECTED VERSION
  ============================================================================

  This script safely deletes all sales-related data based on actual database
  structure. Only deletes tables that exist.

  IMPORTANT: This will permanently delete all sales data!

  ============================================================================
*/

-- Delete in correct order to respect foreign key constraints

-- 1. Delete sales approval requests
DELETE FROM approval_requests
WHERE request_type IN ('sale_approval', 'payment_approval');

-- 2. Delete virtual payments (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'virtual_payments') THEN
    DELETE FROM virtual_payments;
    RAISE NOTICE '✓ Deleted virtual_payments';
  END IF;
END $$;

-- 3. Delete FX rate analysis linked to sales (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fx_rate_analysis') THEN
    DELETE FROM fx_rate_analysis WHERE sale_id IS NOT NULL;
    RAISE NOTICE '✓ Deleted fx_rate_analysis records';
  END IF;
END $$;

-- 4. Delete sales documents (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales_documents') THEN
    DELETE FROM sales_documents;
    RAISE NOTICE '✓ Deleted sales_documents';
  END IF;
END $$;

-- 5. Delete sales notifications log (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales_notifications_log') THEN
    DELETE FROM sales_notifications_log;
    RAISE NOTICE '✓ Deleted sales_notifications_log';
  END IF;
END $$;

-- 6. Delete sales audit trail (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales_audit_trail') THEN
    DELETE FROM sales_audit_trail;
    RAISE NOTICE '✓ Deleted sales_audit_trail';
  END IF;
END $$;

-- 7. Delete sales payment schedules (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales_payment_schedules') THEN
    DELETE FROM sales_payment_schedules;
    RAISE NOTICE '✓ Deleted sales_payment_schedules';
  END IF;
END $$;

-- 8. Delete sales allocations (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales_allocations') THEN
    DELETE FROM sales_allocations;
    RAISE NOTICE '✓ Deleted sales_allocations';
  END IF;
END $$;

-- 9. Delete sales line items (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales_line_items') THEN
    DELETE FROM sales_line_items;
    RAISE NOTICE '✓ Deleted sales_line_items';
  END IF;
END $$;

-- 10. Delete sales commissions (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales_commissions') THEN
    DELETE FROM sales_commissions;
    RAISE NOTICE '✓ Deleted sales_commissions';
  END IF;
END $$;

-- 11. Delete sales approvals (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales_approvals') THEN
    DELETE FROM sales_approvals;
    RAISE NOTICE '✓ Deleted sales_approvals';
  END IF;
END $$;

-- 12. Delete payment history (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payment_history') THEN
    DELETE FROM payment_history;
    RAISE NOTICE '✓ Deleted payment_history';
  END IF;
END $$;

-- 13. Delete payment documents (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payment_documents') THEN
    DELETE FROM payment_documents;
    RAISE NOTICE '✓ Deleted payment_documents';
  END IF;
END $$;

-- 14. Delete payment reminders (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payment_reminders') THEN
    DELETE FROM payment_reminders;
    RAISE NOTICE '✓ Deleted payment_reminders';
  END IF;
END $$;

-- 15. Delete payments
DELETE FROM payments;
RAISE NOTICE '✓ Deleted payments';

-- 16. Delete audit logs for sales (optional - comment out to keep history)
DELETE FROM audit_logs
WHERE table_name IN ('sales', 'payments', 'virtual_payments');
RAISE NOTICE '✓ Deleted audit_logs for sales';

-- 17. Finally, delete all sales records
DELETE FROM sales;
RAISE NOTICE '✓ Deleted all sales';

-- Verification query
DO $$
DECLARE
  v_sales INTEGER;
  v_payments INTEGER;
  v_approvals INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_sales FROM sales;
  SELECT COUNT(*) INTO v_payments FROM payments;
  SELECT COUNT(*) INTO v_approvals FROM approval_requests
  WHERE request_type IN ('sale_approval', 'payment_approval');

  RAISE NOTICE '
╔════════════════════════════════════════════════════════════════════════════════╗
║                   SALES DATA DELETION COMPLETED                                ║
╚════════════════════════════════════════════════════════════════════════════════╝

VERIFICATION:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  • Sales:              % records (should be 0)
  • Payments:           % records (should be 0)
  • Approval Requests:  % records (should be 0)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ You can now create fresh sales through the interface!

NEXT STEPS:
  1. Navigate to: Sales → Create New Sale
  2. Select a seller (Mansa Resources)
  3. Select a customer
  4. Enter sale details
  5. Submit for approval
', v_sales, v_payments, v_approvals;
END $$;
