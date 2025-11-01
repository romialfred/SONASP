-- ============================================
-- FIX ASSAY CERTIFICATES RLS POLICIES
-- ============================================

-- Step 1: Drop ALL existing policies on storage.objects for assay certificates
DROP POLICY IF EXISTS "Authenticated users can upload certificates" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their batch certificates" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their certificates" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their certificates" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated uploads to ASSAY-CERTIFICATES" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated access to ASSAY-CERTIFICATES" ON storage.objects;

-- Step 2: Create PERMISSIVE policies (very open for testing)
-- These policies allow ANY authenticated user to do ANYTHING with the bucket

-- Policy 1: Upload (INSERT) - Allow any authenticated user
CREATE POLICY "Allow authenticated uploads to ASSAY-CERTIFICATES"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'ASSAY-CERTIFICATES'
);

-- Policy 2: View (SELECT) - Allow any authenticated user
CREATE POLICY "Allow authenticated access to ASSAY-CERTIFICATES"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'ASSAY-CERTIFICATES'
);

-- Policy 3: Update (UPDATE) - Allow any authenticated user
CREATE POLICY "Allow authenticated updates to ASSAY-CERTIFICATES"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'ASSAY-CERTIFICATES')
WITH CHECK (bucket_id = 'ASSAY-CERTIFICATES');

-- Policy 4: Delete (DELETE) - Allow any authenticated user
CREATE POLICY "Allow authenticated deletes from ASSAY-CERTIFICATES"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'ASSAY-CERTIFICATES');

-- Step 3: Verify policies were created
SELECT 
  COUNT(*) as policy_count,
  CASE 
    WHEN COUNT(*) >= 4 THEN '✅ All 4 policies created'
    ELSE '❌ Missing policies: ' || (4 - COUNT(*))::text
  END as status
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE '%ASSAY-CERTIFICATES%';

-- Step 4: Show all policies
SELECT 
  policyname,
  cmd as operation
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE '%ASSAY-CERTIFICATES%'
ORDER BY cmd;
