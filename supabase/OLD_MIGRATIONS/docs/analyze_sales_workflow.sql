-- ========================================
-- ANALYZE SALES WORKFLOW - COMPLETE
-- ========================================

-- 1. Check if gold_inventory table exists
SELECT 
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE '%inventory%'
ORDER BY table_name;

-- 2. Check sales table structure and constraints
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'sales'
AND column_name LIKE '%status%'
ORDER BY ordinal_position;

-- 3. Check actual sales status values in database
SELECT 
  status,
  COUNT(*) as count,
  MIN(created_at) as first_created,
  MAX(created_at) as last_created
FROM sales
GROUP BY status
ORDER BY count DESC;

-- 4. Check sales table ALL columns to understand structure
SELECT 
  ordinal_position,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'sales'
ORDER BY ordinal_position;

-- 5. Check for any inventory-related tables
SELECT 
  t.table_name,
  COUNT(c.column_name) as column_count
FROM information_schema.tables t
LEFT JOIN information_schema.columns c ON c.table_name = t.table_name
WHERE t.table_schema = 'public'
AND (t.table_name LIKE '%inventory%' OR t.table_name LIKE '%stock%' OR t.table_name LIKE '%gold%')
GROUP BY t.table_name
ORDER BY t.table_name;

-- 6. Check recent sales needing approval
SELECT 
  id,
  sale_number,
  status,
  quantity_oz,
  final_proceeds,
  created_at,
  updated_at
FROM sales
WHERE status = 'pending_approval'
ORDER BY created_at DESC
LIMIT 5;

-- 7. Check if there's a batches table with inventory info
SELECT 
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'batches'
AND (column_name LIKE '%available%' OR column_name LIKE '%inventory%' OR column_name LIKE '%weight%')
ORDER BY column_name;

-- 8. Check all constraints on sales table
SELECT
  con.conname as constraint_name,
  con.contype as constraint_type,
  pg_get_constraintdef(con.oid) as constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'sales'
ORDER BY con.conname;
