/*
  # Configuration du Bucket Supabase Storage pour les Documents Freight

  Ce script configure le bucket de stockage pour les documents PDF générés
  par le module Invoice & Consignment (Freight Shipment).

  Documents stockés:
  - Bullion Summary PDF
  - Customs Invoice PDF
  - Packing List PDF (futur)
  - Consignment Note PDF (futur)

  Exécution: Copier-coller ce script dans le SQL Editor de Supabase
*/

-- 1. Créer le bucket s'il n'existe pas déjà
INSERT INTO storage.buckets (id, name, public)
VALUES ('freight-documents', 'freight-documents', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Politique RLS: Permettre à tous de lire les documents (public)
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

-- 3. Politique RLS: Permettre aux utilisateurs authentifiés de créer des documents
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

-- 4. Politique RLS: Permettre aux utilisateurs authentifiés de mettre à jour (upsert)
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

-- 5. Politique RLS: Permettre aux utilisateurs authentifiés de supprimer
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

-- Vérification
SELECT
  'Bucket créé avec succès' as status,
  id,
  name,
  public
FROM storage.buckets
WHERE id = 'freight-documents';

SELECT
  'Politiques RLS configurées' as status,
  COUNT(*) as policy_count
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE '%freight%';
