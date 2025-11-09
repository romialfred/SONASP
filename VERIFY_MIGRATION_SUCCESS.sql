-- ✅ VERIFY MIGRATION WAS SUCCESSFUL

-- 1. Check if license_id column exists in batches table
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'batches'
  AND column_name = 'license_id';

-- Expected result: Should return one row showing license_id column

-- 2. Check if the index was created
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'batches'
  AND indexname = 'idx_batches_license_id';

-- Expected result: Should return one row showing the index

-- 3. Check foreign key constraint
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'batches'
  AND kcu.column_name = 'license_id';

-- Expected result: Should return one row showing foreign key to licenses table

-- 4. Check current batches (optional)
SELECT
  COUNT(*) as total_batches,
  COUNT(license_id) as batches_with_license,
  COUNT(*) - COUNT(license_id) as batches_without_license
FROM batches;

-- This shows how many batches have/don't have licenses assigned
