/*
  # Fix Assay Certificates Storage Bucket

  1. Changes
    - Create ASSAY-CERTIFICATES bucket if not exists
    - Set up proper RLS policies for upload/download
    - Create shipping-documents bucket for general documents
    - Configure public access where appropriate

  2. Security
    - Authenticated users can upload certificates
    - Authenticated users can read certificates
    - Proper access control for documents
*/

-- Create ASSAY-CERTIFICATES bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('ASSAY-CERTIFICATES', 'ASSAY-CERTIFICATES', true)
ON CONFLICT (id) DO UPDATE SET
  public = true;

-- Create shipping-documents bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('shipping-documents', 'shipping-documents', true)
ON CONFLICT (id) DO UPDATE SET
  public = true;

-- RLS Policies for ASSAY-CERTIFICATES

-- Allow authenticated users to upload certificates
DROP POLICY IF EXISTS "Authenticated users can upload assay certificates" ON storage.objects;
CREATE POLICY "Authenticated users can upload assay certificates"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'ASSAY-CERTIFICATES');

-- Allow authenticated users to read certificates
DROP POLICY IF EXISTS "Authenticated users can read assay certificates" ON storage.objects;
CREATE POLICY "Authenticated users can read assay certificates"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'ASSAY-CERTIFICATES');

-- Allow authenticated users to update certificates
DROP POLICY IF EXISTS "Authenticated users can update assay certificates" ON storage.objects;
CREATE POLICY "Authenticated users can update assay certificates"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'ASSAY-CERTIFICATES')
  WITH CHECK (bucket_id = 'ASSAY-CERTIFICATES');

-- Allow authenticated users to delete certificates
DROP POLICY IF EXISTS "Authenticated users can delete assay certificates" ON storage.objects;
CREATE POLICY "Authenticated users can delete assay certificates"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'ASSAY-CERTIFICATES');

-- RLS Policies for shipping-documents

-- Allow authenticated users to upload documents
DROP POLICY IF EXISTS "Authenticated users can upload shipping documents" ON storage.objects;
CREATE POLICY "Authenticated users can upload shipping documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'shipping-documents');

-- Allow authenticated users to read documents
DROP POLICY IF EXISTS "Authenticated users can read shipping documents" ON storage.objects;
CREATE POLICY "Authenticated users can read shipping documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'shipping-documents');

-- Allow authenticated users to update documents
DROP POLICY IF EXISTS "Authenticated users can update shipping documents" ON storage.objects;
CREATE POLICY "Authenticated users can update shipping documents"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'shipping-documents')
  WITH CHECK (bucket_id = 'shipping-documents');

-- Allow authenticated users to delete documents
DROP POLICY IF EXISTS "Authenticated users can delete shipping documents" ON storage.objects;
CREATE POLICY "Authenticated users can delete shipping documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'shipping-documents');
