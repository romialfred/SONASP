/*
  # Add Shipping Documents Table

  1. New Tables
    - `shipping_documents`
      - Links documents to shipping preparations
      - Multiple documents per shipment

  2. Security
    - Enable RLS
    - Policies for authenticated users
*/

CREATE TABLE IF NOT EXISTS shipping_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipping_preparation_id uuid NOT NULL REFERENCES shipping_preparations(id) ON DELETE CASCADE,
  title text NOT NULL,
  document_url text NOT NULL,
  file_name text NOT NULL,
  file_size bigint,
  mime_type text,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE shipping_documents ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Users can view shipping documents" ON shipping_documents;
CREATE POLICY "Users can view shipping documents"
  ON shipping_documents FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can create shipping documents" ON shipping_documents;
CREATE POLICY "Users can create shipping documents"
  ON shipping_documents FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Users can delete shipping documents" ON shipping_documents;
CREATE POLICY "Users can delete shipping documents"
  ON shipping_documents FOR DELETE
  TO authenticated
  USING (true);

-- Index
CREATE INDEX IF NOT EXISTS idx_shipping_documents_preparation
  ON shipping_documents(shipping_preparation_id);
