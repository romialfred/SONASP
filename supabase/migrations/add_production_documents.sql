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

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view production documents" ON production_documents;
DROP POLICY IF EXISTS "Users can upload production documents" ON production_documents;
DROP POLICY IF EXISTS "Users can update their own documents" ON production_documents;
DROP POLICY IF EXISTS "Users can delete their own documents" ON production_documents;

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

-- Drop trigger if exists
DROP TRIGGER IF EXISTS production_documents_updated_at ON production_documents;

CREATE TRIGGER production_documents_updated_at
  BEFORE UPDATE ON production_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_production_documents_updated_at();

-- ========================================
-- STORAGE BUCKET POLICIES
-- ========================================
-- Note: Ces policies contrôlent l'accès aux FICHIERS dans le bucket Storage
-- (différent des policies RLS pour la TABLE production_documents)

-- Policy SELECT: Voir/Télécharger les fichiers
INSERT INTO storage.policies (name, bucket_id, operation, definition)
VALUES (
  'Authenticated users can view production documents',
  'production-documents',
  'SELECT',
  '(auth.role() = ''authenticated'')'
)
ON CONFLICT (bucket_id, name) DO UPDATE SET
  operation = EXCLUDED.operation,
  definition = EXCLUDED.definition;

-- Policy INSERT: Upload des fichiers
INSERT INTO storage.policies (name, bucket_id, operation, definition)
VALUES (
  'Authenticated users can upload production documents',
  'production-documents',
  'INSERT',
  '(auth.role() = ''authenticated'')'
)
ON CONFLICT (bucket_id, name) DO UPDATE SET
  operation = EXCLUDED.operation,
  definition = EXCLUDED.definition;

-- Policy UPDATE: Modifier les métadonnées (optionnel)
INSERT INTO storage.policies (name, bucket_id, operation, definition)
VALUES (
  'Authenticated users can update production documents',
  'production-documents',
  'UPDATE',
  '(auth.role() = ''authenticated'')'
)
ON CONFLICT (bucket_id, name) DO UPDATE SET
  operation = EXCLUDED.operation,
  definition = EXCLUDED.definition;

-- Policy DELETE: Supprimer les fichiers
INSERT INTO storage.policies (name, bucket_id, operation, definition)
VALUES (
  'Authenticated users can delete production documents',
  'production-documents',
  'DELETE',
  '(auth.role() = ''authenticated'')'
)
ON CONFLICT (bucket_id, name) DO UPDATE SET
  operation = EXCLUDED.operation,
  definition = EXCLUDED.definition;

-- Vérifier que les storage policies sont créées
DO $$
DECLARE
  policy_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM storage.policies
  WHERE bucket_id = 'production-documents';

  RAISE NOTICE 'Storage policies créées: % policies pour production-documents', policy_count;
END $$;
