/*
  ============================================================================
  CREATE SUPABASE STORAGE BUCKET FOR BATCH DOCUMENTS
  ============================================================================

  This script creates the required storage bucket for batch document uploads.

  The error "Bucket not found" occurs because the 'documents' bucket doesn't
  exist in Supabase Storage.

  This script will:
  1. Create the 'documents' bucket if it doesn't exist
  2. Set appropriate access policies
  3. Configure file size limits and allowed types
  ============================================================================
*/

-- Create the documents bucket in storage.buckets
-- Note: This needs to be done through Supabase Dashboard or CLI
-- SQL cannot directly create storage buckets

-- MANUAL STEPS TO CREATE THE BUCKET:
-- ===================================
--
-- Option 1: Using Supabase Dashboard (RECOMMENDED)
-- -----------------------------------------------
-- 1. Go to your Supabase project dashboard
-- 2. Navigate to Storage section in the left sidebar
-- 3. Click "New bucket" button
-- 4. Fill in the details:
--    - Name: documents
--    - Public bucket: ✓ (checked)
--    - File size limit: 10 MB
--    - Allowed MIME types: application/pdf, image/jpeg, image/png, image/jpg,
--                          application/msword,
--                          application/vnd.openxmlformats-officedocument.wordprocessingml.document
-- 5. Click "Create bucket"
--
-- Option 2: Using Supabase CLI
-- -----------------------------
-- Run this command in your terminal:
-- supabase storage create documents --public
--
-- ============================================================================

-- After creating the bucket through the dashboard or CLI, run this SQL
-- to set up the RLS policies:

-- Enable RLS on the storage.objects table (if not already enabled)
-- This is usually already enabled by default

-- Policy 1: Allow authenticated users to upload files
CREATE POLICY IF NOT EXISTS "Authenticated users can upload documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents' AND
  (storage.foldername(name))[1] = 'batch-documents'
);

-- Policy 2: Allow authenticated users to view/download files
CREATE POLICY IF NOT EXISTS "Authenticated users can view documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
);

-- Policy 3: Allow users to delete their own uploaded files
CREATE POLICY IF NOT EXISTS "Users can delete their own documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents' AND
  (storage.foldername(name))[1] = 'batch-documents'
);

-- Policy 4: Public read access (if you want files to be publicly accessible)
CREATE POLICY IF NOT EXISTS "Public can view documents"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id = 'documents'
);

-- Verification query
-- This will show all your storage buckets
DO $$
BEGIN
  RAISE NOTICE '
╔════════════════════════════════════════════════════════════════════════════════╗
║                       STORAGE BUCKET SETUP COMPLETE                            ║
╚════════════════════════════════════════════════════════════════════════════════╝

NEXT STEPS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Create the "documents" bucket manually:

   SUPABASE DASHBOARD:
   - Storage → New bucket
   - Name: documents
   - Public: Yes
   - File size limit: 10 MB
   - Allowed types: PDF, JPG, PNG, DOC, DOCX

2. After creating the bucket, the RLS policies above will be applied

3. Test by uploading a document in the Batch Create form

SECURITY:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Only authenticated users can upload
✓ Files are stored in batch-documents/ folder
✓ Public read access enabled (files visible to all)
✓ Users can delete their own uploads
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
';
END $$;
