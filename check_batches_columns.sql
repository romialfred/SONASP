-- ========================================
-- CHECK BATCHES TABLE STRUCTURE
-- ========================================

-- 1. Get ALL columns in batches table
SELECT 
  ordinal_position,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'batches'
ORDER BY ordinal_position;

-- 2. Check for weight/oz related columns
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'batches'
AND (column_name LIKE '%weight%' OR column_name LIKE '%oz%');

-- 3. Show sample data to understand structure
SELECT *
FROM batches
LIMIT 3;

-- 4. Check batch statuses
SELECT 
  status,
  COUNT(*) as count
FROM batches
GROUP BY status
ORDER BY count DESC;
