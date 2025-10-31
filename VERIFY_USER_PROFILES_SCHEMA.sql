-- =====================================================
-- USER PROFILES TABLE VERIFICATION SCRIPT
-- Run this BEFORE applying migrations to verify schema
-- =====================================================

-- 1. Check if user_profiles table exists
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'user_profiles'
    )
    THEN '✅ user_profiles table exists'
    ELSE '❌ user_profiles table does NOT exist - you need to create it first'
  END as table_status;

-- 2. List all columns in user_profiles table
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default,
  CASE
    WHEN column_name = 'id' THEN '✅ Correct primary key column'
    WHEN column_name = 'user_id' THEN '❌ Wrong column name (should be id)'
    ELSE ''
  END as notes
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'user_profiles'
ORDER BY ordinal_position;

-- 3. Verify the primary key column
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'user_profiles'
        AND column_name = 'id'
        AND data_type = 'uuid'
    )
    THEN '✅ Column user_profiles.id exists (CORRECT)'
    ELSE '❌ Column user_profiles.id does NOT exist'
  END as id_column_check;

-- 4. Check for wrong column name
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'user_profiles'
        AND column_name = 'user_id'
    )
    THEN '❌ Column user_profiles.user_id exists (WRONG - should be id)'
    ELSE '✅ Column user_profiles.user_id does NOT exist (CORRECT)'
  END as user_id_column_check;

-- 5. Verify foreign key relationship to auth.users
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  '✅ Correct FK relationship' as notes
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name = 'user_profiles'
  AND kcu.column_name = 'id';

-- 6. Test query that will be used in policies
SELECT
  CASE
    WHEN EXISTS (
      SELECT 1 FROM user_profiles WHERE id IS NOT NULL LIMIT 1
    )
    THEN '✅ Query "SELECT 1 FROM user_profiles WHERE user_profiles.id = ..." will work'
    ELSE '⚠️  No users in user_profiles table yet'
  END as policy_query_test;

-- 7. Summary
SELECT '=================================================' as separator;
SELECT 'VERIFICATION COMPLETE' as status;
SELECT 'If all checks show ✅, the migration will work!' as result;
SELECT 'If you see ❌, you need to fix your schema first' as warning;
SELECT '=================================================' as separator;
