-- ============================================================================
-- RLS POLICIES FOR LICENSE-DOCUMENTS BUCKET
-- ============================================================================
--
-- IMPORTANT: Run this AFTER you've created the "license-documents" bucket
-- through the Supabase Dashboard UI.
--
-- HOW TO USE:
-- 1. First create bucket via Dashboard: Storage → New bucket → "license-documents"
-- 2. Then copy this SQL and run it in SQL Editor
-- 3. This will add the security policies
--
-- ============================================================================

-- Enable RLS on storage.objects table (if not already enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (cleanup)
DO $$
BEGIN
  DROP POLICY IF EXISTS "Allow authenticated upload to license-documents" ON storage.objects;
  DROP POLICY IF EXISTS "Allow authenticated view of license-documents" ON storage.objects;
  DROP POLICY IF EXISTS "Allow users to update own license-documents" ON storage.objects;
  DROP POLICY IF EXISTS "Allow users to delete own license-documents" ON storage.objects;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- ============================================================================
-- POLICY 1: Allow authenticated users to upload documents
-- ============================================================================
CREATE POLICY "Allow authenticated upload to license-documents"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'license-documents');

-- ============================================================================
-- POLICY 2: Allow authenticated users to view documents
-- ============================================================================
CREATE POLICY "Allow authenticated view of license-documents"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'license-documents');

-- ============================================================================
-- POLICY 3: Allow users to update their own documents
-- ============================================================================
CREATE POLICY "Allow users to update own license-documents"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'license-documents' AND auth.uid() = owner)
  WITH CHECK (bucket_id = 'license-documents' AND auth.uid() = owner);

-- ============================================================================
-- POLICY 4: Allow users to delete their own documents
-- ============================================================================
CREATE POLICY "Allow users to delete own license-documents"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'license-documents' AND auth.uid() = owner);

-- ============================================================================
-- VERIFICATION: Check if policies were created
-- ============================================================================
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'objects'
  AND policyname LIKE '%license-documents%'
ORDER BY policyname;

-- Expected: Should return 4 rows (one for each policy)

-- ============================================================================
-- ✅ SUCCESS!
-- ============================================================================
-- If you see 4 policies in the results above, you're done!
-- Now refresh your browser and test document uploads.
-- ============================================================================
