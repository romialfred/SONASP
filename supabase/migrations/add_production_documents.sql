/*
  # Add Production Documents Support

  1. New Table
    - `production_documents`
      - `id` (uuid, primary key)
      - `production_id` (uuid, foreign key to daily_production)
      - `document_name` (text) - User-provided name for the document
      - `file_name` (text) - Original file name
      - `file_path` (text) - Storage path in Supabase Storage
      - `file_size` (integer) - File size in bytes
      - `file_type` (text) - MIME type
      - `uploaded_by` (uuid, foreign key to auth.users)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `production_documents` table
    - Add policies for authenticated users to manage documents
*/

-- Create production_documents table
CREATE TABLE IF NOT EXISTS production_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  production_id uuid NOT NULL REFERENCES daily_production(id) ON DELETE CASCADE,
  document_name text NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size integer NOT NULL,
  file_type text NOT NULL,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_production_documents_production_id
  ON production_documents(production_id);

CREATE INDEX IF NOT EXISTS idx_production_documents_uploaded_by
  ON production_documents(uploaded_by);

-- Enable RLS
ALTER TABLE production_documents ENABLE ROW LEVEL SECURITY;

-- Policies for production_documents
CREATE POLICY "Users can view production documents"
  ON production_documents
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can upload production documents"
  ON production_documents
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Users can update their own documents"
  ON production_documents
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = uploaded_by)
  WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Users can delete their own documents"
  ON production_documents
  FOR DELETE
  TO authenticated
  USING (auth.uid() = uploaded_by);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_production_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER production_documents_updated_at
  BEFORE UPDATE ON production_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_production_documents_updated_at();
