-- ============================================
-- CHECK STORAGE BUCKET STATUS
-- ============================================

-- Check 1: Does the bucket exist?
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'ASSAY-CERTIFICATES') 
    THEN '✅ Bucket exists'
    ELSE '❌ Bucket NOT FOUND'
  END as bucket_status;

-- Check 2: Bucket configuration
SELECT 
  id as bucket_name,
  public as is_public,
  file_size_limit / 1024 / 1024 as size_limit_mb,
  allowed_mime_types,
  created_at
FROM storage.buckets
WHERE id = 'ASSAY-CERTIFICATES';

-- Check 3: Storage policies
SELECT 
  COUNT(*) as policy_count,
  CASE 
    WHEN COUNT(*) >= 4 THEN '✅ All policies present'
    WHEN COUNT(*) > 0 THEN '⚠️ Some policies missing'
    ELSE '❌ NO POLICIES'
  END as policy_status
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE '%certificate%';

-- Check 4: List all certificate policies
SELECT 
  policyname as policy_name,
  cmd as operation,
  qual as using_clause,
  with_check as check_clause
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE '%certificate%'
ORDER BY policyname;

-- Check 5: RLS enabled on storage.objects?
SELECT 
  tablename,
  CASE 
    WHEN relrowsecurity THEN '✅ RLS Enabled'
    ELSE '❌ RLS Disabled'
  END as rls_status
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'storage'
  AND c.relname = 'objects';
