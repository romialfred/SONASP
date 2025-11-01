/*
  # Batch Documents Management System - FIXED VERSION

  1. New Tables
    - `batch_documents` - Store all batch-related documents
    
  2. Storage
    - Create 'batch-documents' bucket
    
  3. Security
    - RLS policies for table and storage
    
  4. Indexes
    - Performance indexes
*/

-- Drop existing objects if they exist (cleanup)
DROP TABLE IF EXISTS batch_documents CASCADE;
DROP VIEW IF EXISTS v_batch_documents_with_details CASCADE;

-- Create batch_documents table
CREATE TABLE batch_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN (
    'shipping_report',
    'refinery_report', 
    'sales_invoice',
    'quality_report',
    'transport_document',
    'customs_document',
    'payment_proof',
    'other'
  )),
  document_name text NOT NULL,
  file_url text NOT NULL,
  file_size bigint,
  mime_type text,
  uploaded_by uuid REFERENCES user_profiles(id),
  lifecycle_stage text CHECK (
    lifecycle_stage IS NULL OR
    lifecycle_stage IN (
      'factory',
      'airport',
      'refinery',
      'processing',
      'sales',
      'payment'
    )
  ),
  description text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes for performance
CREATE INDEX idx_batch_documents_batch_id ON batch_documents(batch_id);
CREATE INDEX idx_batch_documents_type ON batch_documents(document_type);
CREATE INDEX idx_batch_documents_stage ON batch_documents(lifecycle_stage) WHERE lifecycle_stage IS NOT NULL;
CREATE INDEX idx_batch_documents_created_at ON batch_documents(created_at DESC);
CREATE INDEX idx_batch_documents_uploaded_by ON batch_documents(uploaded_by);

-- Enable RLS
ALTER TABLE batch_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Policy: Authenticated users can view documents
CREATE POLICY "Users can view batch documents"
  ON batch_documents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM batches
      WHERE batches.id = batch_documents.batch_id
    )
  );

-- Policy: Authenticated users can upload documents
CREATE POLICY "Users can upload batch documents"
  ON batch_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = uploaded_by);

-- Policy: Users can update their own documents
CREATE POLICY "Users can update own documents"
  ON batch_documents
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = uploaded_by)
  WITH CHECK (auth.uid() = uploaded_by);

-- Policy: Users can delete their own documents
CREATE POLICY "Users can delete own documents"
  ON batch_documents
  FOR DELETE
  TO authenticated
  USING (auth.uid() = uploaded_by);

-- Create storage bucket (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('batch-documents', 'batch-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies

-- Drop existing policies if they exist
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Authenticated users can upload batch documents" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users can view batch documents" ON storage.objects;
  DROP POLICY IF EXISTS "Users can update own batch documents" ON storage.objects;
  DROP POLICY IF EXISTS "Users can delete own batch documents" ON storage.objects;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Create storage policies
CREATE POLICY "Authenticated users can upload batch documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'batch-documents');

CREATE POLICY "Authenticated users can view batch documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'batch-documents');

CREATE POLICY "Users can update own batch documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'batch-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own batch documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'batch-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_batch_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for updated_at
CREATE TRIGGER update_batch_documents_timestamp
  BEFORE UPDATE ON batch_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_batch_documents_updated_at();

-- Create view with details
CREATE VIEW v_batch_documents_with_details AS
SELECT 
  bd.id,
  bd.batch_id,
  bd.document_type,
  bd.document_name,
  bd.file_url,
  bd.file_size,
  bd.mime_type,
  bd.uploaded_by,
  bd.lifecycle_stage,
  bd.description,
  bd.created_at,
  bd.updated_at,
  up.full_name as uploaded_by_name,
  b.batch_number,
  b.status as batch_status
FROM batch_documents bd
LEFT JOIN user_profiles up ON bd.uploaded_by = up.id
LEFT JOIN batches b ON bd.batch_id = b.id;

-- Grant access to view
GRANT SELECT ON v_batch_documents_with_details TO authenticated;

-- Add comment to table
COMMENT ON TABLE batch_documents IS 'Stores all documents related to batch lifecycle (except assay certificates which have separate system)';
COMMENT ON COLUMN batch_documents.document_type IS 'Type of document: shipping_report, refinery_report, sales_invoice, quality_report, transport_document, customs_document, payment_proof, other';
COMMENT ON COLUMN batch_documents.lifecycle_stage IS 'Optional lifecycle stage: factory, airport, refinery, processing, sales, payment';
