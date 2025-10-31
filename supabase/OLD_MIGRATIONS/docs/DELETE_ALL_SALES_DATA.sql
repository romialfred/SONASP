/*
  ============================================================================
  DELETE ALL SALES DATA - Fresh Start
  ============================================================================

  This script safely deletes all sales-related data to allow creating fresh
  sales entries through the interface.

  IMPORTANT: This will permanently delete all sales data!

  What gets deleted:
  - All sales records
  - All payment records
  - All virtual payment records
  - All sales approval requests
  - All sales line items
  - All sales commissions
  - Related audit logs for sales

  What is preserved:
  - Customers (so you can create sales for existing customers)
  - Sellers/Mining companies
  - Stakeholders
  - Gold inventory
  - Batches
  - System configuration
  - User accounts

  ============================================================================
*/

-- Start transaction for safety
BEGIN;

DO $$
DECLARE
  v_sales_count INTEGER;
  v_payments_count INTEGER;
  v_approvals_count INTEGER;
BEGIN
  -- Get counts before deletion
  SELECT COUNT(*) INTO v_sales_count FROM sales;
  SELECT COUNT(*) INTO v_payments_count FROM payments;
  SELECT COUNT(*) INTO v_approvals_count FROM approval_requests WHERE request_type IN ('sale_approval', 'payment_approval');

  RAISE NOTICE '
╔════════════════════════════════════════════════════════════════════════════════╗
║                      DELETING ALL SALES DATA                                   ║
╚════════════════════════════════════════════════════════════════════════════════╝

CURRENT DATA COUNTS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  • Sales:             % records
  • Payments:          % records
  • Sale Approvals:    % records
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Starting deletion process...
', v_sales_count, v_payments_count, v_approvals_count;

  -- Step 1: Delete sales approval requests
  RAISE NOTICE '→ Deleting sales approval requests...';
  DELETE FROM approval_requests
  WHERE request_type IN ('sale_approval', 'payment_approval');

  -- Step 2: Delete approval steps related to sales
  RAISE NOTICE '→ Deleting approval steps for sales...';
  DELETE FROM approval_steps
  WHERE approval_request_id IN (
    SELECT id FROM approval_requests WHERE request_type IN ('sale_approval', 'payment_approval')
  );

  -- Step 3: Delete virtual payments
  RAISE NOTICE '→ Deleting virtual payments...';
  DELETE FROM virtual_payments;

  -- Step 4: Delete payments
  RAISE NOTICE '→ Deleting all payments...';
  DELETE FROM payments;

  -- Step 5: Delete sales line items (if table exists)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales_line_items') THEN
    RAISE NOTICE '→ Deleting sales line items...';
    DELETE FROM sales_line_items;
  END IF;

  -- Step 6: Delete sales commissions (if table exists)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales_commissions') THEN
    RAISE NOTICE '→ Deleting sales commissions...';
    DELETE FROM sales_commissions;
  END IF;

  -- Step 7: Delete sales approvals (if table exists)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sales_approvals') THEN
    RAISE NOTICE '→ Deleting sales approvals...';
    DELETE FROM sales_approvals;
  END IF;

  -- Step 8: Delete FX rate analysis records related to sales
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'fx_rate_analysis') THEN
    RAISE NOTICE '→ Deleting FX rate analysis records...';
    DELETE FROM fx_rate_analysis WHERE sale_id IS NOT NULL;
  END IF;

  -- Step 9: Delete audit logs related to sales (optional - comment out if you want to keep audit trail)
  RAISE NOTICE '→ Deleting sales-related audit logs...';
  DELETE FROM audit_logs
  WHERE table_name IN ('sales', 'payments', 'virtual_payments');

  -- Step 10: Finally, delete all sales records
  RAISE NOTICE '→ Deleting all sales records...';
  DELETE FROM sales;

  RAISE NOTICE '
╔════════════════════════════════════════════════════════════════════════════════╗
║                      SALES DATA DELETED SUCCESSFULLY                           ║
╚════════════════════════════════════════════════════════════════════════════════╝

✓ All sales data has been deleted
✓ All related payment data removed
✓ All approval requests cleared
✓ Audit logs for sales cleared

PRESERVED DATA:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✓ Customers (ready for new sales)
  ✓ Sellers/Mining companies
  ✓ Gold inventory
  ✓ Batches
  ✓ User accounts
  ✓ System settings
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You can now create fresh sales through the interface!

NEXT STEPS:
  1. Navigate to: Sales → Create New Sale
  2. Select a seller (Mansa Resources for external sales)
  3. Select a customer
  4. Enter sale details
  5. Submit for approval
';

END $$;

-- Commit the transaction
COMMIT;

-- Verify deletion
SELECT
  'sales' as table_name,
  COUNT(*) as remaining_records
FROM sales
UNION ALL
SELECT
  'payments' as table_name,
  COUNT(*) as remaining_records
FROM payments
UNION ALL
SELECT
  'virtual_payments' as table_name,
  COUNT(*) as remaining_records
FROM virtual_payments
UNION ALL
SELECT
  'approval_requests (sales)' as table_name,
  COUNT(*) as remaining_records
FROM approval_requests
WHERE request_type IN ('sale_approval', 'payment_approval');
