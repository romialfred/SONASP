/*
  # Verify Sales Workflow Statuses Migration

  This script verifies that all the sales workflow statuses have been added successfully.
*/

-- List all sale_status enum values
SELECT
  t.typname AS enum_name,
  e.enumlabel AS enum_value,
  e.enumsortorder AS sort_order
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname = 'sale_status'
ORDER BY e.enumsortorder;

-- Count total statuses (should be 14: 3 legacy + 11 new)
SELECT COUNT(*) as total_statuses
FROM pg_enum e
JOIN pg_type t ON e.enumtypid = t.oid
WHERE t.typname = 'sale_status';

-- Check for specific new statuses
SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'sale_status' AND e.enumlabel = 'create_sales') THEN 'YES'
    ELSE 'NO'
  END as create_sales_exists,
  CASE
    WHEN EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'sale_status' AND e.enumlabel = 'pending_management_approval') THEN 'YES'
    ELSE 'NO'
  END as pending_management_approval_exists,
  CASE
    WHEN EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'sale_status' AND e.enumlabel = 'management_approved') THEN 'YES'
    ELSE 'NO'
  END as management_approved_exists,
  CASE
    WHEN EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'sale_status' AND e.enumlabel = 'management_rejected') THEN 'YES'
    ELSE 'NO'
  END as management_rejected_exists,
  CASE
    WHEN EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'sale_status' AND e.enumlabel = 'pending_for_customer_approval') THEN 'YES'
    ELSE 'NO'
  END as pending_for_customer_approval_exists,
  CASE
    WHEN EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'sale_status' AND e.enumlabel = 'customer_approved') THEN 'YES'
    ELSE 'NO'
  END as customer_approved_exists,
  CASE
    WHEN EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'sale_status' AND e.enumlabel = 'customer_rejected') THEN 'YES'
    ELSE 'NO'
  END as customer_rejected_exists,
  CASE
    WHEN EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'sale_status' AND e.enumlabel = 'waiting_for_payment') THEN 'YES'
    ELSE 'NO'
  END as waiting_for_payment_exists,
  CASE
    WHEN EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'sale_status' AND e.enumlabel = 'virtual_payment') THEN 'YES'
    ELSE 'NO'
  END as virtual_payment_exists,
  CASE
    WHEN EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'sale_status' AND e.enumlabel = 'payment_received') THEN 'YES'
    ELSE 'NO'
  END as payment_received_exists,
  CASE
    WHEN EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'sale_status' AND e.enumlabel = 'completed') THEN 'YES'
    ELSE 'NO'
  END as completed_exists;
