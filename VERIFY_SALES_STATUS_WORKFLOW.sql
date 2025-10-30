-- ========================================
-- VERIFY SALES STATUS WORKFLOW
-- ========================================

-- 1. Check sales status constraint
SELECT
  con.conname as constraint_name,
  pg_get_constraintdef(con.oid) as constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'sales'
AND con.contype = 'c'
AND conname LIKE '%status%'
ORDER BY con.conname;

-- 2. Check all distinct status values in sales table
SELECT 
  status,
  COUNT(*) as count,
  STRING_AGG(DISTINCT sale_number, ', ' ORDER BY sale_number) as sample_sales
FROM sales
GROUP BY status
ORDER BY count DESC;

-- 3. Check if gold_inventory table exists
SELECT 
  EXISTS (
    SELECT 1 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'gold_inventory'
  ) as gold_inventory_exists;

-- 4. If gold_inventory doesn't exist, check batches table for inventory
SELECT 
  status,
  COUNT(*) as batch_count,
  SUM(final_weight_oz) as total_oz
FROM batches
WHERE status LIKE '%available%' OR status LIKE '%ready%'
GROUP BY status
ORDER BY batch_count DESC;

-- 5. Check sales with pending_approval status (ready to approve)
SELECT 
  id,
  sale_number,
  status,
  quantity_oz,
  final_proceeds,
  created_at,
  EXTRACT(EPOCH FROM (now() - created_at))/3600 as hours_pending
FROM sales
WHERE status = 'pending_approval'
ORDER BY created_at DESC
LIMIT 10;

-- 6. Verify valid statuses according to constraint
SELECT 
  unnest(ARRAY[
    'pending_approval',
    'approved',
    'customer_approved',
    'customer_rejected',
    'waiting_for_payment',
    'payment_received',
    'completed',
    'rejected',
    'cancelled'
  ]) as valid_status;

-- 7. Check for any sales with invalid status
SELECT 
  id,
  sale_number,
  status,
  'INVALID - NOT IN CONSTRAINT' as issue
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
);

-- 8. Test status transitions (simulate what would happen)
SELECT 
  'pending_approval' as from_status,
  'approved' as to_status,
  'approved' IN (
    'pending_approval',
    'approved',
    'customer_approved',
    'customer_rejected',
    'waiting_for_payment',
    'payment_received',
    'completed',
    'rejected',
    'cancelled'
  ) as is_valid;
