-- QUICK SALES DELETION SCRIPT
-- Simple, no checks, just deletes what exists and ignores what doesn't

-- Approval requests
DELETE FROM approval_requests
WHERE request_type IN ('sale_approval', 'payment_approval');

-- Virtual payments (ignore if doesn't exist)
DELETE FROM virtual_payments WHERE TRUE;

-- FX analysis
DELETE FROM fx_rate_analysis WHERE sale_id IS NOT NULL;

-- Sales related tables
DELETE FROM sales_documents WHERE TRUE;
DELETE FROM sales_notifications_log WHERE TRUE;
DELETE FROM sales_audit_trail WHERE TRUE;
DELETE FROM sales_payment_schedules WHERE TRUE;
DELETE FROM sales_allocations WHERE TRUE;
DELETE FROM sales_line_items WHERE TRUE;
DELETE FROM sales_commissions WHERE TRUE;
DELETE FROM sales_approvals WHERE TRUE;

-- Payment related tables
DELETE FROM payment_history WHERE TRUE;
DELETE FROM payment_documents WHERE TRUE;
DELETE FROM payment_reminders WHERE TRUE;
DELETE FROM payments;

-- Audit logs (comment out if you want to keep)
DELETE FROM audit_logs
WHERE table_name IN ('sales', 'payments', 'virtual_payments');

-- Main sales table
DELETE FROM sales;

-- Verify
SELECT
  'Sales' as item,
  COUNT(*) as remaining
FROM sales
UNION ALL
SELECT 'Payments', COUNT(*) FROM payments
UNION ALL
SELECT 'Approvals', COUNT(*) FROM approval_requests
WHERE request_type IN ('sale_approval', 'payment_approval');
