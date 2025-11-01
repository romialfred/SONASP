-- ============================================================================
--  CREATE STORAGE POLICY FOR ASSAY CERTIFICATES BUCKET
--  Run this in Supabase SQL Editor if you can't find the Policies UI
-- ============================================================================

-- This creates the policy to allow authenticated users to upload, view,
-- update, and delete files in the assay-certificates bucket

CREATE POLICY "Allow authenticated users all operations"
ON storage.objects
FOR ALL
TO authenticated
USING (bucket_id = 'assay-certificates')
WITH CHECK (bucket_id = 'assay-certificates');

-- ============================================================================
-- VERIFICATION: Run this to check if policy was created
-- ============================================================================

SELECT 
    policyname,
    cmd,
    roles,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE '%assay%';

-- Expected result: 1 row showing your new policy

-- ============================================================================
-- WHAT THIS POLICY DOES:
-- ============================================================================
-- 
-- ✅ Allows logged-in users (authenticated) to:
--    - Upload files (INSERT)
--    - View files (SELECT)
--    - Update files (UPDATE)
--    - Delete files (DELETE)
-- 
-- ✅ Only in the 'assay-certificates' bucket
-- ✅ Not accessible to public/anonymous users
-- ✅ Secure by default
--
-- ============================================================================
-- HOW TO USE:
-- ============================================================================
--
-- 1. Copy the CREATE POLICY statement above (lines 10-15)
-- 2. Go to Supabase Dashboard → SQL Editor
-- 3. Paste and click "RUN"
-- 4. Should see: "Success. No rows returned"
-- 5. Run the verification query (lines 21-28)
-- 6. Should see 1 row with your policy
-- 7. ✅ Done!
--
-- ============================================================================
-- TEST:
-- ============================================================================
--
-- After running this:
-- 1. Refresh your Gold Shipper app (F5)
-- 2. Login
-- 3. Go to Batches → Any batch
-- 4. Scroll down to "Assay Certificates"
-- 5. Try uploading a PDF
-- 6. Should work! ✅
--
-- ============================================================================
