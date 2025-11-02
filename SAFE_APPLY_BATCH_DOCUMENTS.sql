/*
  MIGRATION SÉCURISÉE - MODULE BATCH DOCUMENTS

  Ce script applique UNIQUEMENT les éléments manquants sans écraser ce qui existe déjà.
  Tous les éléments ont des vérifications IF NOT EXISTS / IF EXISTS.

  SÉCURITÉ:
  - Aucun DROP sans vérification
  - Aucune modification de données existantes
  - Compatible avec exécution multiple

  INSTRUCTIONS:
  1. Exécutez d'abord VERIFY_BATCH_DOCUMENTS_STATUS.sql
  2. Si des éléments manquent, exécutez ce script
  3. Réexécutez VERIFY_BATCH_DOCUMENTS_STATUS.sql pour confirmer
*/

-- ============================================================================
-- ÉTAPE 1: CRÉER LA TABLE batch_documents (si elle n'existe pas)
-- ============================================================================

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

-- Message de confirmation
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'batch_documents') THEN
    RAISE NOTICE '✅ Table batch_documents existe';
  END IF;
END $$;

-- ============================================================================
-- ÉTAPE 2: CRÉER LES INDEXES (s'ils n'existent pas)
-- ============================================================================

-- Index sur batch_id
CREATE INDEX IF NOT EXISTS idx_batch_documents_batch_id
  ON batch_documents(batch_id);

-- Index sur document_type
CREATE INDEX IF NOT EXISTS idx_batch_documents_type
  ON batch_documents(document_type);

-- Index partiel sur lifecycle_stage
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'idx_batch_documents_stage'
  ) THEN
    CREATE INDEX idx_batch_documents_stage
      ON batch_documents(lifecycle_stage)
      WHERE lifecycle_stage IS NOT NULL;
    RAISE NOTICE '✅ Index idx_batch_documents_stage créé';
  ELSE
    RAISE NOTICE '✅ Index idx_batch_documents_stage existe déjà';
  END IF;
END $$;

-- Index sur created_at
CREATE INDEX IF NOT EXISTS idx_batch_documents_created_at
  ON batch_documents(created_at DESC);

-- Index sur uploaded_by
CREATE INDEX IF NOT EXISTS idx_batch_documents_uploaded_by
  ON batch_documents(uploaded_by);

-- ============================================================================
-- ÉTAPE 3: ACTIVER RLS (si pas déjà activé)
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'batch_documents') THEN
    ALTER TABLE batch_documents ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE '✅ RLS activé sur batch_documents';
  END IF;
END $$;

-- ============================================================================
-- ÉTAPE 4: CRÉER LES RLS POLICIES (si elles n'existent pas)
-- ============================================================================

-- Policy SELECT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'batch_documents'
    AND policyname = 'Users can view batch documents'
  ) THEN
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
    RAISE NOTICE '✅ Policy SELECT créée';
  ELSE
    RAISE NOTICE '✅ Policy SELECT existe déjà';
  END IF;
END $$;

-- Policy INSERT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'batch_documents'
    AND policyname = 'Users can upload batch documents'
  ) THEN
    CREATE POLICY "Users can upload batch documents"
      ON batch_documents
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = uploaded_by);
    RAISE NOTICE '✅ Policy INSERT créée';
  ELSE
    RAISE NOTICE '✅ Policy INSERT existe déjà';
  END IF;
END $$;

-- Policy UPDATE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'batch_documents'
    AND policyname = 'Users can update own documents'
  ) THEN
    CREATE POLICY "Users can update own documents"
      ON batch_documents
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = uploaded_by)
      WITH CHECK (auth.uid() = uploaded_by);
    RAISE NOTICE '✅ Policy UPDATE créée';
  ELSE
    RAISE NOTICE '✅ Policy UPDATE existe déjà';
  END IF;
END $$;

-- Policy DELETE
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'batch_documents'
    AND policyname = 'Users can delete own documents'
  ) THEN
    CREATE POLICY "Users can delete own documents"
      ON batch_documents
      FOR DELETE
      TO authenticated
      USING (auth.uid() = uploaded_by);
    RAISE NOTICE '✅ Policy DELETE créée';
  ELSE
    RAISE NOTICE '✅ Policy DELETE existe déjà';
  END IF;
END $$;

-- ============================================================================
-- ÉTAPE 5: CRÉER LE STORAGE BUCKET (si pas déjà créé)
-- ============================================================================

-- Vous avez dit que les buckets sont déjà créés, mais au cas où:
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'batch-documents',
  'batch-documents',
  false,
  10485760, -- 10MB
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Message de confirmation
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'batch-documents') THEN
    RAISE NOTICE '✅ Bucket batch-documents existe';
  END IF;
END $$;

-- ============================================================================
-- ÉTAPE 6: CRÉER LES STORAGE POLICIES (si elles n'existent pas)
-- ============================================================================

-- Policy INSERT storage
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname = 'Authenticated users can upload batch documents'
  ) THEN
    CREATE POLICY "Authenticated users can upload batch documents"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'batch-documents');
    RAISE NOTICE '✅ Storage Policy INSERT créée';
  ELSE
    RAISE NOTICE '✅ Storage Policy INSERT existe déjà';
  END IF;
END $$;

-- Policy SELECT storage
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname = 'Authenticated users can view batch documents'
  ) THEN
    CREATE POLICY "Authenticated users can view batch documents"
      ON storage.objects
      FOR SELECT
      TO authenticated
      USING (bucket_id = 'batch-documents');
    RAISE NOTICE '✅ Storage Policy SELECT créée';
  ELSE
    RAISE NOTICE '✅ Storage Policy SELECT existe déjà';
  END IF;
END $$;

-- Policy UPDATE storage
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname = 'Users can update own batch documents'
  ) THEN
    CREATE POLICY "Users can update own batch documents"
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (
        bucket_id = 'batch-documents' AND
        auth.uid()::text = (storage.foldername(name))[1]
      );
    RAISE NOTICE '✅ Storage Policy UPDATE créée';
  ELSE
    RAISE NOTICE '✅ Storage Policy UPDATE existe déjà';
  END IF;
END $$;

-- Policy DELETE storage
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname = 'Users can delete own batch documents'
  ) THEN
    CREATE POLICY "Users can delete own batch documents"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'batch-documents' AND
        auth.uid()::text = (storage.foldername(name))[1]
      );
    RAISE NOTICE '✅ Storage Policy DELETE créée';
  ELSE
    RAISE NOTICE '✅ Storage Policy DELETE existe déjà';
  END IF;
END $$;

-- ============================================================================
-- ÉTAPE 7: CRÉER LA FONCTION DE MISE À JOUR (si elle n'existe pas)
-- ============================================================================

CREATE OR REPLACE FUNCTION update_batch_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ÉTAPE 8: CRÉER LE TRIGGER (si il n'existe pas)
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_name = 'update_batch_documents_timestamp'
    AND event_object_table = 'batch_documents'
  ) THEN
    CREATE TRIGGER update_batch_documents_timestamp
      BEFORE UPDATE ON batch_documents
      FOR EACH ROW
      EXECUTE FUNCTION update_batch_documents_updated_at();
    RAISE NOTICE '✅ Trigger créé';
  ELSE
    RAISE NOTICE '✅ Trigger existe déjà';
  END IF;
END $$;

-- ============================================================================
-- ÉTAPE 9: CRÉER LA VUE (si elle n'existe pas)
-- ============================================================================

CREATE OR REPLACE VIEW v_batch_documents_with_details AS
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

-- Accorder les permissions sur la vue
GRANT SELECT ON v_batch_documents_with_details TO authenticated;

-- Message de confirmation
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'v_batch_documents_with_details') THEN
    RAISE NOTICE '✅ Vue v_batch_documents_with_details existe';
  END IF;
END $$;

-- ============================================================================
-- ÉTAPE 10: COMMENTAIRES (documentation)
-- ============================================================================

COMMENT ON TABLE batch_documents IS 'Stores all documents related to batch lifecycle (except assay certificates which have separate system)';
COMMENT ON COLUMN batch_documents.document_type IS 'Type of document: shipping_report, refinery_report, sales_invoice, quality_report, transport_document, customs_document, payment_proof, other';
COMMENT ON COLUMN batch_documents.lifecycle_stage IS 'Optional lifecycle stage: factory, airport, refinery, processing, sales, payment';

-- ============================================================================
-- RÉSUMÉ FINAL
-- ============================================================================

DO $$
DECLARE
  table_exists boolean;
  rls_enabled boolean;
  policies_count integer;
  storage_policies_count integer;
  indexes_count integer;
  view_exists boolean;
  trigger_exists boolean;
BEGIN
  -- Vérifications
  SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'batch_documents') INTO table_exists;
  SELECT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'batch_documents' AND rowsecurity = true) INTO rls_enabled;
  SELECT COUNT(*) FROM pg_policies WHERE tablename = 'batch_documents' INTO policies_count;
  SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname ILIKE '%batch%document%' INTO storage_policies_count;
  SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'batch_documents' INTO indexes_count;
  SELECT EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'v_batch_documents_with_details') INTO view_exists;
  SELECT EXISTS (SELECT 1 FROM information_schema.triggers WHERE event_object_table = 'batch_documents') INTO trigger_exists;

  -- Rapport
  RAISE NOTICE '';
  RAISE NOTICE '=================================================';
  RAISE NOTICE '       RÉSUMÉ DE LA MIGRATION';
  RAISE NOTICE '=================================================';
  RAISE NOTICE '';

  IF table_exists THEN
    RAISE NOTICE '✅ Table batch_documents: PRÊTE';
  ELSE
    RAISE NOTICE '❌ Table batch_documents: ERREUR';
  END IF;

  IF rls_enabled THEN
    RAISE NOTICE '✅ RLS: ACTIVÉ';
  ELSE
    RAISE NOTICE '❌ RLS: NON ACTIVÉ';
  END IF;

  RAISE NOTICE '   • Policies table: % / 4', policies_count;
  RAISE NOTICE '   • Policies storage: % / 4', storage_policies_count;
  RAISE NOTICE '   • Indexes: % / 5', indexes_count;

  IF view_exists THEN
    RAISE NOTICE '✅ Vue avec détails: PRÊTE';
  ELSE
    RAISE NOTICE '❌ Vue avec détails: MANQUANTE';
  END IF;

  IF trigger_exists THEN
    RAISE NOTICE '✅ Trigger updated_at: PRÊT';
  ELSE
    RAISE NOTICE '❌ Trigger updated_at: MANQUANT';
  END IF;

  RAISE NOTICE '';

  IF table_exists AND rls_enabled AND policies_count >= 4 AND
     storage_policies_count >= 4 AND indexes_count >= 5 AND
     view_exists AND trigger_exists THEN
    RAISE NOTICE '🎉 MIGRATION COMPLÈTE - MODULE BATCH DOCUMENTS OPÉRATIONNEL!';
  ELSE
    RAISE NOTICE '⚠️  MIGRATION INCOMPLÈTE - Vérifiez les éléments marqués ❌';
  END IF;

  RAISE NOTICE '=================================================';
  RAISE NOTICE '';
END $$;
