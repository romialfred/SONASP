/*
  # FIX: Rendre le bucket freight-documents PUBLIC

  Ce script corrige le bucket freight-documents pour permettre
  l'affichage des PDF (Bullion Summary et Invoice) dans l'application.

  PROBLEME IDENTIFIE:
  - Le bucket freight-documents est privé (public = false)
  - Les PDF ne peuvent pas être affichés dans les iframes
  - Les URLs publiques ne fonctionnent pas

  SOLUTION:
  - Rendre le bucket public
  - Vérifier les politiques RLS

  EXECUTION: Copier-coller ce script dans le SQL Editor de Supabase
*/

-- 1. Rendre le bucket public
UPDATE storage.buckets
SET public = true
WHERE id = 'freight-documents';

-- 2. Vérifier la configuration
SELECT
  'Bucket status' as check_type,
  id,
  name,
  public as is_public
FROM storage.buckets
WHERE id = 'freight-documents';

-- 3. Vérifier les politiques RLS existantes
SELECT
  'RLS Policies' as check_type,
  policyname,
  cmd
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE '%freight%'
ORDER BY policyname;

-- 4. Créer les politiques RLS si elles n'existent pas

-- Policy 1: Public read access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname = 'Public Access for freight-documents'
  ) THEN
    CREATE POLICY "Public Access for freight-documents"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'freight-documents');
  END IF;
END $$;

-- Policy 2: Authenticated users can upload
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname = 'Authenticated users can upload freight documents'
  ) THEN
    CREATE POLICY "Authenticated users can upload freight documents"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'freight-documents');
  END IF;
END $$;

-- Policy 3: Authenticated users can update
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname = 'Authenticated users can update freight documents'
  ) THEN
    CREATE POLICY "Authenticated users can update freight documents"
    ON storage.objects FOR UPDATE
    TO authenticated
    USING (bucket_id = 'freight-documents');
  END IF;
END $$;

-- Policy 4: Authenticated users can delete
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname = 'Authenticated users can delete freight documents'
  ) THEN
    CREATE POLICY "Authenticated users can delete freight documents"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (bucket_id = 'freight-documents');
  END IF;
END $$;

-- 5. Vérification finale
SELECT
  'Configuration complete' as status,
  'Bucket is now public and policies are set' as message;

SELECT
  'Final check' as status,
  id,
  name,
  public,
  CASE WHEN public THEN 'PDFs can now be viewed' ELSE 'ERROR: Still private' END as pdf_viewing_status
FROM storage.buckets
WHERE id = 'freight-documents';
