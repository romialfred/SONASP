-- ============================================
-- FIX ASSAY CERTIFICATES STORAGE BUCKET
-- ============================================

-- Step 1: Check if bucket exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'ASSAY-CERTIFICATES'
  ) THEN
    -- Create the bucket if it doesn't exist
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'ASSAY-CERTIFICATES',
      'ASSAY-CERTIFICATES',
      false, -- PRIVATE bucket
      10485760, -- 10MB limit
      ARRAY['application/pdf']
    );
    RAISE NOTICE 'Created assay-certificates bucket';
  ELSE
    RAISE NOTICE 'Bucket assay-certificates already exists';
    
    -- Update bucket settings to ensure it's configured correctly
    UPDATE storage.buckets 
    SET 
      public = false,
      file_size_limit = 10485760,
      allowed_mime_types = ARRAY['application/pdf']
    WHERE id = 'ASSAY-CERTIFICATES';
    RAISE NOTICE 'Updated bucket configuration';
  END IF;
END $$;

-- Step 2: Drop existing policies (to avoid conflicts)
DROP POLICY IF EXISTS "Authenticated users can upload certificates" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their batch certificates" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their certificates" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their certificates" ON storage.objects;

-- Step 3: Create RLS policies for storage.objects
-- CRITICAL: These policies control access to files in the bucket

-- Policy 1: Allow authenticated users to upload (INSERT)
CREATE POLICY "Authenticated users can upload certificates"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'ASSAY-CERTIFICATES'
  AND auth.uid() IS NOT NULL
);

-- Policy 2: Allow users to view certificates for their batches (SELECT)
CREATE POLICY "Users can view their batch certificates"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'ASSAY-CERTIFICATES'
  AND auth.uid() IS NOT NULL
);

-- Policy 3: Allow users to update their certificates (UPDATE)
CREATE POLICY "Users can update their certificates"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'ASSAY-CERTIFICATES'
  AND auth.uid() IS NOT NULL
)
WITH CHECK (
  bucket_id = 'ASSAY-CERTIFICATES'
  AND auth.uid() IS NOT NULL
);

-- Policy 4: Allow users to delete certificates (DELETE)
CREATE POLICY "Users can delete their certificates"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'ASSAY-CERTIFICATES'
  AND auth.uid() IS NOT NULL
);

-- Step 4: Verify setup
DO $$
DECLARE
  bucket_count INTEGER;
  policy_count INTEGER;
BEGIN
  -- Check bucket
  SELECT COUNT(*) INTO bucket_count
  FROM storage.buckets
  WHERE id = 'ASSAY-CERTIFICATES';
  
  -- Check policies
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname LIKE '%certificate%';
  
  RAISE NOTICE '=================================';
  RAISE NOTICE 'VERIFICATION RESULTS:';
  RAISE NOTICE 'Buckets found: %', bucket_count;
  RAISE NOTICE 'Policies found: %', policy_count;
  RAISE NOTICE '=================================';
  
  IF bucket_count = 0 THEN
    RAISE EXCEPTION 'ERROR: Bucket not created!';
  END IF;
  
  IF policy_count < 4 THEN
    RAISE WARNING 'WARNING: Expected 4 policies, found %', policy_count;
  END IF;
  
  RAISE NOTICE 'SUCCESS: Storage bucket configured correctly!';
END $$;

-- Show final configuration
SELECT 
  id as bucket_name,
  public as is_public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets
WHERE id = 'ASSAY-CERTIFICATES';
