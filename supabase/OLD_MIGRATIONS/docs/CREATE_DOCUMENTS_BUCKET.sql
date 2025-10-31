/*
  ============================================================================
  CREATE SUPABASE STORAGE BUCKET: "documents"
  ============================================================================

  This SQL script creates the required "documents" storage bucket for batch
  document uploads.

  IMPORTANT: Execute this in Supabase SQL Editor with FULL ACCESS
  ============================================================================
*/

-- Step 1: Create the storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  true,
  10485760, -- 10MB limit
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/jpg',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Step 2: Set up RLS policies for the documents bucket

-- Policy 1: Allow authenticated users to upload files
DROP POLICY IF EXISTS "Authenticated users can upload batch documents" ON storage.objects;
CREATE POLICY "Authenticated users can upload batch documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents' AND
  (storage.foldername(name))[1] = 'batch-documents'
);

-- Policy 2: Allow authenticated users to view/download files
DROP POLICY IF EXISTS "Authenticated users can view batch documents" ON storage.objects;
CREATE POLICY "Authenticated users can view batch documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
);

-- Policy 3: Allow users to delete documents they uploaded
DROP POLICY IF EXISTS "Authenticated users can delete batch documents" ON storage.objects;
CREATE POLICY "Authenticated users can delete batch documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents' AND
  (storage.foldername(name))[1] = 'batch-documents'
);

-- Policy 4: Allow public read access (optional - for public file viewing)
DROP POLICY IF EXISTS "Public can view batch documents" ON storage.objects;
CREATE POLICY "Public can view batch documents"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'documents'
);

-- Step 3: Verification
DO $$
DECLARE
  bucket_exists BOOLEAN;
  policy_count INTEGER;
BEGIN
  -- Check if bucket was created
  SELECT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'documents'
  ) INTO bucket_exists;

  -- Count policies
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE tablename = 'objects'
    AND schemaname = 'storage'
    AND policyname LIKE '%batch documents%';

  -- Display results
  IF bucket_exists THEN
    RAISE NOTICE '✅ SUCCESS: Storage bucket "documents" created successfully!';
  ELSE
    RAISE WARNING '❌ FAILED: Storage bucket "documents" was not created.';
  END IF;

  RAISE NOTICE 'ℹ️  RLS Policies created: % policies', policy_count;
  RAISE NOTICE '';
  RAISE NOTICE '══════════════════════════════════════════════════════════════';
  RAISE NOTICE '  NEXT STEPS:';
  RAISE NOTICE '══════════════════════════════════════════════════════════════';
  RAISE NOTICE '  1. Bucket "documents" is ready for file uploads';
  RAISE NOTICE '  2. Files will be stored in: documents/batch-documents/';
  RAISE NOTICE '  3. Maximum file size: 10MB';
  RAISE NOTICE '  4. Allowed types: PDF, JPG, PNG, DOC, DOCX';
  RAISE NOTICE '  5. Test by creating a new batch and uploading a document';
  RAISE NOTICE '══════════════════════════════════════════════════════════════';
END $$;

-- Display bucket configuration
SELECT
  id,
  name,
  public,
  file_size_limit / 1024 / 1024 as "max_size_mb",
  created_at
FROM storage.buckets
WHERE id = 'documents';
