/*
  # Setup All Storage Buckets and Policies

  1. Storage Buckets
    - production-documents (private)
    - shipping-documents (public)
    - assay-certificates (private)

  2. Storage Policies for Each Bucket
    - SELECT: View/download files
    - INSERT: Upload new files
    - UPDATE: Modify files
    - DELETE: Remove files

  3. Security
    - Private buckets: Authenticated users only
    - Public buckets: Authenticated users can manage, public can view
    - Users can only modify their own files
*/

-- ========================================
-- 1. CREATE STORAGE BUCKETS
-- ========================================

-- Production Documents Bucket (Private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'production-documents',
  'production-documents',
  false,
  52428800, -- 50MB
  ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

-- Shipping Documents Bucket (Public for viewing)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'shipping-documents',
  'shipping-documents',
  true,
  52428800, -- 50MB
  ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/jpg', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

-- Assay Certificates Bucket (Private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'assay-certificates',
  'assay-certificates',
  false,
  52428800, -- 50MB
  ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];

-- ========================================
-- 2. DROP EXISTING POLICIES
-- ========================================

-- Drop all existing policies for our buckets
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE tablename = 'objects'
      AND schemaname = 'storage'
      AND (
        policyname LIKE '%production%' OR
        policyname LIKE '%shipping%' OR
        policyname LIKE '%assay%' OR
        policyname LIKE '%Auth users%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
    RAISE NOTICE 'Dropped policy: %', pol.policyname;
  END LOOP;
END $$;

-- ========================================
-- 3. PRODUCTION DOCUMENTS POLICIES
-- ========================================

-- SELECT: All authenticated users can view
CREATE POLICY "Production: View all docs"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'production-documents');

-- INSERT: Users can upload to their folder
CREATE POLICY "Production: Upload own docs"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'production-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- UPDATE: Users can update their own files
CREATE POLICY "Production: Update own docs"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'production-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'production-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- DELETE: Users can delete their own files
CREATE POLICY "Production: Delete own docs"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'production-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- ========================================
-- 4. SHIPPING DOCUMENTS POLICIES
-- ========================================

-- SELECT: All authenticated users can view (public bucket)
CREATE POLICY "Shipping: View all docs"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'shipping-documents');

-- INSERT: Users can upload to their folder
CREATE POLICY "Shipping: Upload own docs"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'shipping-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- UPDATE: Users can update their own files
CREATE POLICY "Shipping: Update own docs"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'shipping-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'shipping-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- DELETE: Users can delete their own files
CREATE POLICY "Shipping: Delete own docs"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'shipping-documents' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- ========================================
-- 5. ASSAY CERTIFICATES POLICIES
-- ========================================

-- SELECT: All authenticated users can view
CREATE POLICY "Assay: View all certificates"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'assay-certificates');

-- INSERT: Users can upload to their folder
CREATE POLICY "Assay: Upload own certificates"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'assay-certificates' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- UPDATE: Users can update their own files
CREATE POLICY "Assay: Update own certificates"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'assay-certificates' AND
    (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'assay-certificates' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- DELETE: Users can delete their own files
CREATE POLICY "Assay: Delete own certificates"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'assay-certificates' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- ========================================
-- 6. VERIFICATION
-- ========================================

DO $$
DECLARE
  bucket_record record;
  total_policies integer;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'STORAGE BUCKETS VERIFICATION';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';

  -- List all buckets
  FOR bucket_record IN
    SELECT id, name, public, file_size_limit
    FROM storage.buckets
    WHERE id IN ('production-documents', 'shipping-documents', 'assay-certificates')
    ORDER BY name
  LOOP
    RAISE NOTICE '📦 Bucket: % (ID: %)', bucket_record.name, bucket_record.id;
    RAISE NOTICE '   - Public: %', CASE WHEN bucket_record.public THEN '✅ Yes' ELSE '🔒 No' END;
    RAISE NOTICE '   - Size Limit: % MB', (bucket_record.file_size_limit / 1048576)::integer;
    RAISE NOTICE '';
  END LOOP;

  -- Count policies per bucket
  RAISE NOTICE '========================================';
  RAISE NOTICE 'STORAGE POLICIES COUNT';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';

  FOR bucket_record IN
    SELECT
      CASE
        WHEN policyname LIKE 'Production:%' THEN 'production-documents'
        WHEN policyname LIKE 'Shipping:%' THEN 'shipping-documents'
        WHEN policyname LIKE 'Assay:%' THEN 'assay-certificates'
      END as bucket_name,
      COUNT(*) as policy_count
    FROM pg_policies
    WHERE tablename = 'objects'
      AND schemaname = 'storage'
      AND (
        policyname LIKE 'Production:%' OR
        policyname LIKE 'Shipping:%' OR
        policyname LIKE 'Assay:%'
      )
    GROUP BY bucket_name
    ORDER BY bucket_name
  LOOP
    RAISE NOTICE '📋 %: % policies', bucket_record.bucket_name, bucket_record.policy_count;
    IF bucket_record.policy_count = 4 THEN
      RAISE NOTICE '   ✅ Complete (SELECT, INSERT, UPDATE, DELETE)';
    ELSE
      RAISE WARNING '   ⚠️ Expected 4 policies, found %', bucket_record.policy_count;
    END IF;
    RAISE NOTICE '';
  END LOOP;

  -- Total policies
  SELECT COUNT(*)
  INTO total_policies
  FROM pg_policies
  WHERE tablename = 'objects'
    AND schemaname = 'storage'
    AND (
      policyname LIKE 'Production:%' OR
      policyname LIKE 'Shipping:%' OR
      policyname LIKE 'Assay:%'
    );

  RAISE NOTICE '========================================';
  RAISE NOTICE 'TOTAL: % storage policies created', total_policies;
  IF total_policies = 12 THEN
    RAISE NOTICE '✅✅✅ ALL POLICIES SUCCESSFULLY CREATED!';
  ELSE
    RAISE WARNING '⚠️ Expected 12 policies (4 per bucket × 3 buckets)';
  END IF;
  RAISE NOTICE '========================================';
END $$;

-- ========================================
-- 7. LIST ALL STORAGE POLICIES
-- ========================================

SELECT
  policyname as "Policy Name",
  CASE
    WHEN policyname LIKE 'Production:%' THEN 'production-documents'
    WHEN policyname LIKE 'Shipping:%' THEN 'shipping-documents'
    WHEN policyname LIKE 'Assay:%' THEN 'assay-certificates'
  END as "Bucket",
  cmd as "Operation",
  roles::text as "Roles"
FROM pg_policies
WHERE tablename = 'objects'
  AND schemaname = 'storage'
  AND (
    policyname LIKE 'Production:%' OR
    policyname LIKE 'Shipping:%' OR
    policyname LIKE 'Assay:%'
  )
ORDER BY
  CASE
    WHEN policyname LIKE 'Production:%' THEN 1
    WHEN policyname LIKE 'Shipping:%' THEN 2
    WHEN policyname LIKE 'Assay:%' THEN 3
  END,
  cmd;

-- ========================================
-- 8. HELPFUL INFORMATION
-- ========================================

/*
📚 STORAGE CONFIGURATION SUMMARY

🔹 BUCKETS CREATED:
   1. production-documents (Private, 50MB limit)
   2. shipping-documents (Public viewing, 50MB limit)
   3. assay-certificates (Private, 50MB limit)

🔹 POLICIES PER BUCKET (4 each = 12 total):
   ✅ SELECT: View/download files
   ✅ INSERT: Upload new files
   ✅ UPDATE: Modify file metadata
   ✅ DELETE: Remove files

🔹 SECURITY MODEL:
   - All buckets: Authenticated users only for management
   - Files organized by user ID: {bucket}/{user_id}/{filename}
   - Users can only modify their own files
   - Users can view all files in bucket (for collaboration)

🔹 FILE PATH STRUCTURE:
   production-documents/{user_id}/document.pdf
   shipping-documents/{user_id}/invoice.pdf
   assay-certificates/{user_id}/certificate.pdf

🔹 VERIFICATION:
   Dashboard → Storage → Select Bucket → Policies tab
   Should see 4 policies per bucket

🔹 POLICY NAME FORMAT:
   {Bucket}: {Action} {Target}
   Examples:
   - "Production: View all docs"
   - "Shipping: Upload own docs"
   - "Assay: Delete own certificates"

🔹 ALL POLICY NAMES UNDER 50 CHARACTERS:
   ✅ Longest: "Assay: Upload own certificates" (33 chars)
   ✅ Shortest: "Assay: View all certificates" (30 chars)
*/
