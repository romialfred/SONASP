-- ============================================
-- CHECK YOUR ACTUAL STORAGE POLICIES
-- ============================================

-- Check 1: ALL policies on storage.objects (no filter)
SELECT 
  policyname as policy_name,
  cmd as operation,
  roles as applied_to
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
ORDER BY cmd;

-- Check 2: Count of all storage policies
SELECT 
  COUNT(*) as total_policies,
  CASE 
    WHEN COUNT(*) >= 4 THEN '✅ You have enough policies'
    ELSE '⚠️ Only ' || COUNT(*) || ' policies found'
  END as status
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects';

-- Check 3: Policies by operation type
SELECT 
  cmd as operation,
  COUNT(*) as count
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
GROUP BY cmd
ORDER BY cmd;

-- Check 4: Policies that mention "certificate"
SELECT 
  policyname as policy_name,
  cmd as operation
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND LOWER(policyname) LIKE '%certificate%'
ORDER BY cmd;
