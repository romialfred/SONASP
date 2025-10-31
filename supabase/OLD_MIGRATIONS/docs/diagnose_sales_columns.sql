-- ========================================
-- DIAGNOSE SALES TABLE STRUCTURE
-- ========================================

-- 1. Get ALL columns in sales table in order
SELECT 
  ordinal_position,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'sales'
ORDER BY ordinal_position;

-- 2. Check for ALL constraints on sales table
SELECT
  con.conname as constraint_name,
  con.contype as constraint_type,
  pg_get_constraintdef(con.oid) as constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'sales'
ORDER BY con.conname;

-- 3. Look for any column that might be confusing with "status"
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'sales'
AND (column_name LIKE '%status%' OR column_name LIKE '%state%')
ORDER BY column_name;

-- 4. Check the EXACT constraint definition
SELECT pg_get_constraintdef(oid) as full_constraint
FROM pg_constraint
WHERE conname = 'sales_status_check'
AND conrelid = 'sales'::regclass;

-- 5. Try to manually validate the failing row's status
SELECT 
  'pending_approval' IN (
    'pending_approval',
    'approved',
    'customer_approved',
    'customer_rejected',
    'waiting_for_payment',
    'payment_received',
    'completed',
    'rejected',
    'cancelled'
  ) as should_be_true;

-- 6. Check if there are MULTIPLE status columns
SELECT 
  COUNT(*) as status_column_count
FROM information_schema.columns
WHERE table_name = 'sales'
AND column_name = 'status';

-- 7. Parse the failing row to identify column positions
-- Based on error, the 13th value is "pending_approval"
-- Let's confirm what the 13th column is
SELECT 
  column_name,
  ordinal_position
FROM information_schema.columns
WHERE table_name = 'sales'
AND ordinal_position = 13;
