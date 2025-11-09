/*
  # Add License Documents Storage Bucket

  1. Storage Bucket
    - `license-documents` - For license request supporting documents

  2. Security
    - Enable RLS on storage bucket
    - Authenticated users can upload documents
    - All authenticated users can view documents

  3. Policies
    - Upload policies for authenticated users
    - Download policies for authenticated users
    - Update/delete for document owners
*/

-- Create license-documents bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'license-documents',
  'license-documents',
  false,
  10485760, -- 10MB limit
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Drop existing policies if they exist
DO $$
BEGIN
  DROP POLICY IF EXISTS "Authenticated users can upload license documents" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can view license documents" ON storage.objects;
  DROP POLICY IF EXISTS "Users can update own license documents" ON storage.objects;
  DROP POLICY IF EXISTS "Users can delete own license documents" ON storage.objects;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Create storage policies for license-documents bucket
CREATE POLICY "Authenticated users can upload license documents"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'license-documents');

CREATE POLICY "Authenticated users can view license documents"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'license-documents');

CREATE POLICY "Users can update own license documents"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'license-documents' AND
    auth.uid() = owner
  )
  WITH CHECK (
    bucket_id = 'license-documents' AND
    auth.uid() = owner
  );

CREATE POLICY "Users can delete own license documents"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'license-documents' AND
    auth.uid() = owner
  );

-- Add comment for documentation
COMMENT ON TABLE storage.buckets IS 'Storage buckets including license-documents for license request attachments';
