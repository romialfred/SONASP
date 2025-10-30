-- ========================================
-- ANALYZE SALES STATUS VALUES
-- ========================================

-- 1. Check all distinct status values currently in sales table
SELECT 
  status,
  COUNT(*) as count,
  MIN(created_at) as first_occurrence,
  MAX(created_at) as last_occurrence
FROM sales
GROUP BY status
ORDER BY count DESC;

-- 2. Check for NULL status values
SELECT 
  COUNT(*) as null_status_count
FROM sales
WHERE status IS NULL;

-- 3. Find specific rows with potentially invalid status
SELECT 
  id,
  sale_number,
  status,
  created_at,
  updated_at
FROM sales
WHERE status NOT IN (
  'pending_approval',
  'approved',
  'customer_approved',
  'customer_rejected',
  'waiting_for_payment',
  'payment_received',
  'completed',
  'rejected',
  'cancelled'
)
ORDER BY created_at DESC;

-- 4. Sample of each status value to understand the data
SELECT DISTINCT ON (status)
  status,
  id,
  sale_number,
  created_at
FROM sales
ORDER BY status, created_at DESC;

-- 5. Check current constraint on sales.status
SELECT
  con.conname as constraint_name,
  pg_get_constraintdef(con.oid) as constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'sales'
  AND con.contype = 'c'
  AND con.conname LIKE '%status%';

-- 6. Count of sales that would be affected by the new constraint
SELECT 
  'Valid statuses' as category,
  COUNT(*) as count
FROM sales
WHERE status IN (
  'pending_approval',
  'approved',
  'customer_approved',
  'customer_rejected',
  'waiting_for_payment',
  'payment_received',
  'completed',
  'rejected',
  'cancelled'
)
UNION ALL
SELECT 
  'Invalid/Need update' as category,
  COUNT(*) as count
FROM sales
WHERE status NOT IN (
  'pending_approval',
  'approved',
  'customer_approved',
  'customer_rejected',
  'waiting_for_payment',
  'payment_received',
  'completed',
  'rejected',
  'cancelled'
) OR status IS NULL;

-- 7. Detailed view of problematic rows
SELECT 
  id,
  sale_number,
  status,
  customer_id,
  quantity_oz,
  final_proceeds,
  created_at,
  updated_at,
  approval_date
FROM sales
WHERE status NOT IN (
  'pending_approval',
  'approved',
  'customer_approved',
  'customer_rejected',
  'waiting_for_payment',
  'payment_received',
  'completed',
  'rejected',
  'cancelled'
) OR status IS NULL
ORDER BY created_at DESC
LIMIT 20;
