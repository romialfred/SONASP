-- ============================================
-- SHOW DETAILED POLICY DEFINITIONS
-- ============================================

-- Show the actual SQL definition of each policy
SELECT 
  policyname,
  cmd as operation,
  CASE 
    WHEN qual IS NOT NULL THEN 'USING: ' || qual
    ELSE 'No USING clause'
  END as using_clause,
  CASE 
    WHEN with_check IS NOT NULL THEN 'WITH CHECK: ' || with_check
    ELSE 'No WITH CHECK clause'
  END as check_clause
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND LOWER(policyname) LIKE '%certificate%'
ORDER BY cmd;

-- Also check if these policies check bucket_id
SELECT 
  policyname,
  cmd,
  CASE 
    WHEN qual LIKE '%bucket_id%' OR with_check LIKE '%bucket_id%' 
    THEN '✅ Checks bucket_id'
    ELSE '❌ Does NOT check bucket_id (applies to ALL buckets!)'
  END as bucket_check
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND LOWER(policyname) LIKE '%certificate%'
ORDER BY cmd;
