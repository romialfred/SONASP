-- ========================================
-- CHECK GOLD_INVENTORY TABLE STRUCTURE
-- ========================================

-- 1. Verify table exists
SELECT 
  table_name,
  table_type
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name = 'gold_inventory';

-- 2. Get ALL columns in gold_inventory table
SELECT 
  ordinal_position,
  column_name,
  data_type,
  is_nullable,
  column_default,
  character_maximum_length
FROM information_schema.columns
WHERE table_name = 'gold_inventory'
ORDER BY ordinal_position;

-- 3. Check for columns with 'available' in name
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'gold_inventory'
AND column_name LIKE '%available%';

-- 4. Check for columns with 'sale' in name
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'gold_inventory'
AND column_name LIKE '%sale%';

-- 5. Check for columns with 'weight' or 'oz' in name
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'gold_inventory'
AND (column_name LIKE '%weight%' OR column_name LIKE '%oz%');

-- 6. Show sample data structure
SELECT *
FROM gold_inventory
LIMIT 5;

-- 7. Check table constraints
SELECT
  con.conname as constraint_name,
  con.contype as constraint_type,
  pg_get_constraintdef(con.oid) as constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'gold_inventory'
ORDER BY con.conname;

-- 8. Check indexes on gold_inventory
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'gold_inventory'
ORDER BY indexname;
