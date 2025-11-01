-- ============================================================================
-- CREATE ASSAY CERTIFICATES STORAGE BUCKET
-- ============================================================================
-- Run this in Supabase SQL Editor after running the assay migration
-- ============================================================================

-- Create the assay-certificates bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'assay-certificates',
  'assay-certificates',
  false, -- Private bucket
  10485760, -- 10MB limit
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy: Authenticated users can upload files
DROP POLICY IF EXISTS "Users can upload assay certificates" ON storage.objects;
CREATE POLICY "Users can upload assay certificates"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'assay-certificates' AND
    auth.role() = 'authenticated'
  );

-- Policy: Authenticated users can view their files
DROP POLICY IF EXISTS "Users can view assay certificates" ON storage.objects;
CREATE POLICY "Users can view assay certificates"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'assay-certificates');

-- Policy: Users can update their own uploads
DROP POLICY IF EXISTS "Users can update their certificates" ON storage.objects;
CREATE POLICY "Users can update their certificates"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'assay-certificates' AND auth.uid()::text = owner);

-- Policy: Users can delete their own uploads
DROP POLICY IF EXISTS "Users can delete their certificates" ON storage.objects;
CREATE POLICY "Users can delete their certificates"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'assay-certificates' AND auth.uid()::text = owner);

-- Verify bucket created
SELECT
  'Bucket created' as status,
  id,
  name,
  public,
  file_size_limit / 1024 / 1024 as max_size_mb
FROM storage.buckets
WHERE id = 'assay-certificates';

-- Verify policies
SELECT
  'Policies created' as status,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE '%assay%';

-- ============================================================================
-- SUCCESS!
-- ============================================================================
-- Expected output:
-- 1. Bucket created: assay-certificates, max_size_mb: 10
-- 2. Policies created: 4
--
-- Next steps:
-- 1. Refresh your application
-- 2. Go to batch details
-- 3. Try uploading a PDF certificate
-- ============================================================================
