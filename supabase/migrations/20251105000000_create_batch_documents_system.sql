/*
  # Batch Documents Management System

  1. New Tables
    - `batch_documents`
      - `id` (uuid, primary key)
      - `batch_id` (uuid, foreign key to batches)
      - `document_type` (text) - Type: shipping_report, refinery_report, sales_invoice, quality_report, transport_document, customs_document, other
      - `document_name` (text) - User-provided name
      - `file_url` (text) - Storage URL
      - `file_size` (bigint) - File size in bytes
      - `mime_type` (text) - MIME type
      - `uploaded_by` (uuid, foreign key to user_profiles)
      - `lifecycle_stage` (text) - Stage: factory, airport, refinery, processing, sales, payment
      - `description` (text, optional)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Storage
    - Create 'batch-documents' bucket for file storage
    - Separate from assay-certificates

  3. Security
    - Enable RLS on batch_documents table
    - Policies for authenticated users based on roles
    - Storage policies for upload/download

  4. Indexes
    - Index on batch_id for fast queries
    - Index on document_type for filtering
    - Index on lifecycle_stage for filtering
*/

-- Create batch_documents table
CREATE TABLE IF NOT EXISTS batch_documents (
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
  lifecycle_stage text CHECK (lifecycle_stage IN (
    'factory',
    'airport', 
    'refinery',
    'processing',
    'sales',
    'payment'
  )),
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_batch_documents_batch_id ON batch_documents(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_documents_type ON batch_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_batch_documents_stage ON batch_documents(lifecycle_stage);
CREATE INDEX IF NOT EXISTS idx_batch_documents_created_at ON batch_documents(created_at DESC);

-- Enable RLS
ALTER TABLE batch_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies for batch_documents

-- Policy: Authenticated users can view documents for batches they can access
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

-- Policy: Authenticated users can insert documents
CREATE POLICY "Users can upload batch documents"
  ON batch_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = uploaded_by
  );

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

-- Create storage bucket for batch documents (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('batch-documents', 'batch-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for batch-documents bucket

-- Policy: Authenticated users can upload documents
CREATE POLICY "Authenticated users can upload batch documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'batch-documents'
);

-- Policy: Authenticated users can view documents
CREATE POLICY "Authenticated users can view batch documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'batch-documents'
);

-- Policy: Users can update their own uploaded documents
CREATE POLICY "Users can update own batch documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'batch-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy: Users can delete their own uploaded documents
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
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_batch_documents_timestamp ON batch_documents;
CREATE TRIGGER update_batch_documents_timestamp
  BEFORE UPDATE ON batch_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_batch_documents_updated_at();

-- Create view for documents with user info
CREATE OR REPLACE VIEW v_batch_documents_with_details AS
SELECT 
  bd.*,
  up.full_name as uploaded_by_name,
  b.batch_number,
  b.status as batch_status
FROM batch_documents bd
LEFT JOIN user_profiles up ON bd.uploaded_by = up.id
LEFT JOIN batches b ON bd.batch_id = b.id;

-- Grant access to view
GRANT SELECT ON v_batch_documents_with_details TO authenticated;
