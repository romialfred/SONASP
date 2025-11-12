/*
  # Setup Production Documents Storage Policies

  1. Storage Bucket Policies
    - Create policies for production-documents bucket
    - Allow authenticated users to read, insert, update, delete files

  2. Policy Types
    - SELECT: Allow viewing/downloading files
    - INSERT: Allow uploading new files
    - UPDATE: Allow updating file metadata
    - DELETE: Allow deleting files

  3. Security
    - All operations restricted to authenticated users
    - Users can only manage their own files
*/

-- ========================================
-- STORAGE BUCKET POLICIES
-- ========================================

-- First, ensure the bucket exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('production-documents', 'production-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Authenticated users can view files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update own files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete own files" ON storage.objects;

-- Policy 1: SELECT (View/Download) - Shorter name
CREATE POLICY "Auth users view production docs"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'production-documents');

-- Policy 2: INSERT (Upload) - Shorter name
CREATE POLICY "Auth users upload production docs"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'production-documents' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policy 3: UPDATE (Modify) - Shorter name
CREATE POLICY "Auth users update own docs"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'production-documents' AND
    auth.uid()::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'production-documents' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Policy 4: DELETE (Remove) - Shorter name
CREATE POLICY "Auth users delete own docs"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'production-documents' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- ========================================
-- VERIFICATION
-- ========================================

DO $$
DECLARE
  bucket_exists boolean;
  policy_count integer;
BEGIN
  -- Check if bucket exists
  SELECT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'production-documents'
  ) INTO bucket_exists;

  IF bucket_exists THEN
    RAISE NOTICE '✅ Bucket "production-documents" exists';
  ELSE
    RAISE WARNING '❌ Bucket "production-documents" does not exist!';
  END IF;

  -- Count policies for this bucket
  SELECT COUNT(*)
  INTO policy_count
  FROM pg_policies
  WHERE tablename = 'objects'
    AND schemaname = 'storage'
    AND policyname LIKE '%production%';

  RAISE NOTICE '📋 Found % storage policies for production-documents bucket', policy_count;

  IF policy_count >= 4 THEN
    RAISE NOTICE '✅ All storage policies created successfully';
  ELSE
    RAISE WARNING '⚠️ Expected 4 policies, found only %', policy_count;
  END IF;
END $$;

-- ========================================
-- LIST ALL STORAGE POLICIES
-- ========================================

SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'objects'
  AND schemaname = 'storage'
  AND policyname LIKE '%production%'
ORDER BY policyname;

-- ========================================
-- HELPFUL INFORMATION
-- ========================================

/*
📚 IMPORTANT NOTES:

1. BUCKET STRUCTURE:
   - Files are organized by user ID: production-documents/{user_id}/{filename}
   - This allows per-user access control

2. POLICY NAMES (All under 50 chars):
   ✅ "Auth users view production docs" (33 chars)
   ✅ "Auth users upload production docs" (35 chars)
   ✅ "Auth users update own docs" (28 chars)
   ✅ "Auth users delete own docs" (28 chars)

3. SECURITY:
   - All policies check: bucket_id = 'production-documents'
   - INSERT/UPDATE/DELETE check: user owns the file path
   - SELECT allows viewing all files (for collaboration)

4. FILE PATHS:
   Format: production-documents/{user_id}/{filename}
   Example: production-documents/a1b2c3d4-e5f6-7890/.../document.pdf

5. TESTING:
   After migration, verify in Supabase Dashboard:
   Storage → production-documents → Policies
   You should see 4 policies listed

6. TROUBLESHOOTING:
   If policies don't appear:
   - Check pg_policies table directly
   - Verify bucket exists in storage.buckets
   - Check auth.users table has valid users
   - Review Supabase logs for errors
*/
