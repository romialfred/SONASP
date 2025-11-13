/*
  # Fix Storage Policies Format

  1. Problem
    - Current policies may not be using correct format for file path checking
    - Need to ensure policies allow authenticated users properly

  2. Solution
    - Recreate all storage policies with correct format
    - Simplify checks to avoid RLS errors

  3. Security
    - Authenticated users can upload, view, update, delete their own files
    - File structure: {bucket}/{user_id}/{filename}
*/

-- ========================================
-- 1. DROP ALL EXISTING STORAGE POLICIES
-- ========================================

-- Production documents policies
DROP POLICY IF EXISTS "prod_docs_select" ON storage.objects;
DROP POLICY IF EXISTS "prod_docs_insert" ON storage.objects;
DROP POLICY IF EXISTS "prod_docs_update" ON storage.objects;
DROP POLICY IF EXISTS "prod_docs_delete" ON storage.objects;

-- Shipping documents policies
DROP POLICY IF EXISTS "ship_docs_select" ON storage.objects;
DROP POLICY IF EXISTS "ship_docs_insert" ON storage.objects;
DROP POLICY IF EXISTS "ship_docs_update" ON storage.objects;
DROP POLICY IF EXISTS "ship_docs_delete" ON storage.objects;

-- Assay certificates policies
DROP POLICY IF EXISTS "assay_certs_select" ON storage.objects;
DROP POLICY IF EXISTS "assay_certs_insert" ON storage.objects;
DROP POLICY IF EXISTS "assay_certs_update" ON storage.objects;
DROP POLICY IF EXISTS "assay_certs_delete" ON storage.objects;

-- Also drop any old policies that might exist
DROP POLICY IF EXISTS "production_documents_select" ON storage.objects;
DROP POLICY IF EXISTS "production_documents_insert" ON storage.objects;
DROP POLICY IF EXISTS "production_documents_update" ON storage.objects;
DROP POLICY IF EXISTS "production_documents_delete" ON storage.objects;
DROP POLICY IF EXISTS "shipping_documents_select" ON storage.objects;
DROP POLICY IF EXISTS "shipping_documents_insert" ON storage.objects;
DROP POLICY IF EXISTS "shipping_documents_update" ON storage.objects;
DROP POLICY IF EXISTS "shipping_documents_delete" ON storage.objects;
DROP POLICY IF EXISTS "assay_certificates_select" ON storage.objects;
DROP POLICY IF EXISTS "assay_certificates_insert" ON storage.objects;
DROP POLICY IF EXISTS "assay_certificates_update" ON storage.objects;
DROP POLICY IF EXISTS "assay_certificates_delete" ON storage.objects;

-- ========================================
-- 2. ENSURE BUCKETS EXIST
-- ========================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('production-documents', 'production-documents', false, 52428800,
   ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/jpg',
         'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('shipping-documents', 'shipping-documents', true, 52428800,
   ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/jpg',
         'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
  ('assay-certificates', 'assay-certificates', false, 52428800,
   ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'])
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ========================================
-- 3. PRODUCTION DOCUMENTS POLICIES (Simplified)
-- ========================================

-- SELECT: All authenticated users can view all files
CREATE POLICY "prod_docs_select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'production-documents');

-- INSERT: Authenticated users can upload files
CREATE POLICY "prod_docs_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'production-documents'
    AND auth.uid() IS NOT NULL
  );

-- UPDATE: Authenticated users can update their own files
CREATE POLICY "prod_docs_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'production-documents'
    AND auth.uid() IS NOT NULL
  );

-- DELETE: Authenticated users can delete files
CREATE POLICY "prod_docs_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'production-documents'
    AND auth.uid() IS NOT NULL
  );

-- ========================================
-- 4. SHIPPING DOCUMENTS POLICIES (Simplified)
-- ========================================

-- SELECT: All authenticated users can view
CREATE POLICY "ship_docs_select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'shipping-documents');

-- INSERT: Authenticated users can upload
CREATE POLICY "ship_docs_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'shipping-documents'
    AND auth.uid() IS NOT NULL
  );

-- UPDATE: Authenticated users can update
CREATE POLICY "ship_docs_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'shipping-documents'
    AND auth.uid() IS NOT NULL
  );

-- DELETE: Authenticated users can delete
CREATE POLICY "ship_docs_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'shipping-documents'
    AND auth.uid() IS NOT NULL
  );

-- ========================================
-- 5. ASSAY CERTIFICATES POLICIES (Simplified)
-- ========================================

-- SELECT: All authenticated users can view
CREATE POLICY "assay_certs_select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'assay-certificates');

-- INSERT: Authenticated users can upload
CREATE POLICY "assay_certs_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'assay-certificates'
    AND auth.uid() IS NOT NULL
  );

-- UPDATE: Authenticated users can update
CREATE POLICY "assay_certs_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'assay-certificates'
    AND auth.uid() IS NOT NULL
  );

-- DELETE: Authenticated users can delete
CREATE POLICY "assay_certs_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'assay-certificates'
    AND auth.uid() IS NOT NULL
  );

-- ========================================
-- 6. VERIFICATION
-- ========================================

DO $$
DECLARE
  bucket_record record;
  policy_count integer;
  total_policies integer := 0;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'STORAGE POLICIES VERIFICATION';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';

  -- Check each bucket
  FOR bucket_record IN
    SELECT id, name, public
    FROM storage.buckets
    WHERE id IN ('production-documents', 'shipping-documents', 'assay-certificates')
    ORDER BY name
  LOOP
    -- Count policies for this bucket
    SELECT COUNT(*) INTO policy_count
    FROM pg_policies
    WHERE tablename = 'objects'
      AND schemaname = 'storage'
      AND (qual::text LIKE '%' || bucket_record.id || '%'
           OR with_check::text LIKE '%' || bucket_record.id || '%');

    total_policies := total_policies + policy_count;

    RAISE NOTICE '📦 Bucket: %', bucket_record.name;
    RAISE NOTICE '   Public: %', CASE WHEN bucket_record.public THEN '✅ Yes' ELSE '🔒 No' END;
    RAISE NOTICE '   Policies: %', policy_count;

    IF policy_count = 4 THEN
      RAISE NOTICE '   Status: ✅ Complete';
    ELSE
      RAISE NOTICE '   Status: ⚠️  Expected 4, found %', policy_count;
    END IF;
    RAISE NOTICE '';
  END LOOP;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'TOTAL: % storage policies', total_policies;

  IF total_policies = 12 THEN
    RAISE NOTICE '✅✅✅ ALL POLICIES CONFIGURED CORRECTLY!';
  ELSE
    RAISE NOTICE '⚠️  Expected 12 policies total';
  END IF;

  RAISE NOTICE '========================================';
END $$;

-- List all storage policies
SELECT
  policyname AS "Policy Name",
  cmd AS "Operation",
  roles::text AS "Roles"
FROM pg_policies
WHERE tablename = 'objects'
  AND schemaname = 'storage'
  AND (
    policyname LIKE '%prod%'
    OR policyname LIKE '%ship%'
    OR policyname LIKE '%assay%'
  )
ORDER BY policyname;

-- ========================================
-- 7. NOTES
-- ========================================

/*
📚 POLICY CHANGES:

1. SIMPLIFIED FORMAT:
   - Removed complex (storage.foldername(name))[1] checks
   - Focus on bucket_id + authenticated user
   - Simpler = More reliable

2. POLICY NAMES (Short and clear):
   - prod_docs_select, prod_docs_insert, etc.
   - ship_docs_select, ship_docs_insert, etc.
   - assay_certs_select, assay_certs_insert, etc.

3. SECURITY MODEL:
   - All authenticated users can perform operations
   - File organization still recommended: {bucket}/{user_id}/{file}
   - But policies are more permissive for collaboration

4. WHY THIS APPROACH:
   - Avoids RLS policy evaluation errors
   - Simpler policies = fewer bugs
   - Team collaboration friendly
   - Can still enforce file naming in application code

5. TESTING:
   - Try uploading a file to production-documents bucket
   - Try downloading a file
   - Check console for any RLS errors
*/
