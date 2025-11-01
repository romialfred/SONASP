-- ============================================
-- REPLACE EXISTING POLICIES WITH SIMPLE ONES
-- ============================================

-- Step 1: Drop ALL existing certificate policies
DROP POLICY IF EXISTS "Authenticated users can upload certificates" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their certificates" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their certificates" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their batch certificates" ON storage.objects;

-- Also drop any with these names (from previous attempts)
DROP POLICY IF EXISTS "Allow authenticated uploads to ASSAY-CERTIFICATES" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated access to ASSAY-CERTIFICATES" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates to ASSAY-CERTIFICATES" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes from ASSAY-CERTIFICATES" ON storage.objects;

-- Step 2: Create NEW simple policies (VERY PERMISSIVE for testing)

-- INSERT - Allow any authenticated user to upload
CREATE POLICY "Allow uploads to ASSAY-CERTIFICATES"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'ASSAY-CERTIFICATES');

-- SELECT - Allow any authenticated user to view
CREATE POLICY "Allow select from ASSAY-CERTIFICATES"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'ASSAY-CERTIFICATES');

-- UPDATE - Allow any authenticated user to update
CREATE POLICY "Allow updates to ASSAY-CERTIFICATES"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'ASSAY-CERTIFICATES')
WITH CHECK (bucket_id = 'ASSAY-CERTIFICATES');

-- DELETE - Allow any authenticated user to delete
CREATE POLICY "Allow deletes from ASSAY-CERTIFICATES"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'ASSAY-CERTIFICATES');

-- Step 3: Verify
SELECT 
  COUNT(*) as policy_count,
  CASE 
    WHEN COUNT(*) = 4 THEN '✅ SUCCESS: 4 policies created'
    ELSE '❌ ERROR: Only ' || COUNT(*) || ' policies created'
  END as status
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND (policyname LIKE '%ASSAY-CERTIFICATES%' OR LOWER(policyname) LIKE '%certificate%');

-- Step 4: Show the new policies
SELECT 
  policyname,
  cmd as operation
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE '%ASSAY-CERTIFICATES%'
ORDER BY cmd;
