/*
  Simple Sales Deletion Script

  Quick and clean deletion of all sales data.
  Use this in Supabase SQL Editor for a fresh start.
*/

-- Delete in correct order to respect foreign key constraints

-- 1. Delete approval steps first
DELETE FROM approval_steps
WHERE approval_request_id IN (
  SELECT id FROM approval_requests
  WHERE approval_type IN ('sale', 'sale_approval')
);

-- 2. Delete sales approval requests
DELETE FROM approval_requests
WHERE approval_type IN ('sale', 'sale_approval');

-- 3. Delete virtual payments
DELETE FROM virtual_payments;

-- 4. Delete FX rate analysis (if exists)
DELETE FROM fx_rate_analysis WHERE sale_id IS NOT NULL;

-- 5. Delete payments
DELETE FROM payments;

-- 6. Delete sales line items (if exists)
DELETE FROM sales_line_items WHERE TRUE;

-- 7. Delete sales commissions (if exists)
DELETE FROM sales_commissions WHERE TRUE;

-- 8. Delete sales approvals table (if exists)
DELETE FROM sales_approvals WHERE TRUE;

-- 9. Delete audit logs for sales (optional - comment out to keep history)
DELETE FROM audit_logs
WHERE table_name IN ('sales', 'payments', 'virtual_payments');

-- 10. Finally delete all sales
DELETE FROM sales;

-- Verify - should all show 0
SELECT
  'Sales' as item,
  COUNT(*) as count
FROM sales
UNION ALL
SELECT 'Payments', COUNT(*) FROM payments
UNION ALL
SELECT 'Virtual Payments', COUNT(*) FROM virtual_payments
UNION ALL
SELECT 'Sales Approvals', COUNT(*) FROM approval_requests
WHERE approval_type IN ('sale', 'sale_approval');
