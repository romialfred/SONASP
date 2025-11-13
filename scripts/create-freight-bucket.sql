-- =====================================================
-- CRÉATION DU BUCKET FREIGHT & CUSTOMS
-- =====================================================
-- Ce script crée le bucket de stockage pour les documents
-- du module Freight & Customs avec les politiques RLS
-- =====================================================

-- Créer le bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'freight-customs-documents',
  'freight-customs-documents',
  false,
  52428800, -- 50MB
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/jpg']
)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- POLITIQUES RLS (Row Level Security)
-- =====================================================

-- Politique 1: Upload de documents
CREATE POLICY IF NOT EXISTS "Authenticated users can upload freight documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'freight-customs-documents');

-- Politique 2: Lecture de documents
CREATE POLICY IF NOT EXISTS "Authenticated users can view freight documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'freight-customs-documents');

-- Politique 3: Mise à jour de documents
CREATE POLICY IF NOT EXISTS "Authenticated users can update freight documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'freight-customs-documents');

-- Politique 4: Suppression de documents
CREATE POLICY IF NOT EXISTS "Authenticated users can delete freight documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'freight-customs-documents');

-- =====================================================
-- VÉRIFICATION
-- =====================================================

-- Vérifier que le bucket a été créé
SELECT
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets
WHERE id = 'freight-customs-documents';

-- Vérifier les politiques
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename = 'objects'
AND policyname LIKE '%freight%'
ORDER BY policyname;
