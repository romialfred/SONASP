-- ========================================
-- CHECK SALES STATUS IN DATABASE
-- ========================================

-- 1. Check if 'sales' table exists
SELECT 
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name = 'sales';

-- 2. Check 'status' column in 'sales' table
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'sales'
AND column_name = 'status';

-- 3. Check constraint on 'status' column
SELECT
  con.conname as constraint_name,
  con.contype as constraint_type,
  pg_get_constraintdef(con.oid) as constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'sales'
AND con.contype = 'c'
AND con.conname LIKE '%status%';

-- 4. Show ALL distinct status values currently in database
SELECT 
  status,
  COUNT(*) as count
FROM sales
GROUP BY status
ORDER BY count DESC;

-- 5. Show sample sales records with status
SELECT 
  id,
  sale_number,
  status,
  customer_id,
  quantity_oz,
  final_proceeds,
  created_at
FROM sales
ORDER BY created_at DESC
LIMIT 10;

-- 6. Check for any related status history or audit tables
SELECT 
  table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND (
  table_name LIKE '%sales%status%' 
  OR table_name LIKE '%sale%history%'
  OR table_name LIKE '%sale%audit%'
);
