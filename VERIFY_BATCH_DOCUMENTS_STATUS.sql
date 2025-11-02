/* 
  SCRIPT DE VÉRIFICATION - MODULE BATCH DOCUMENTS
  Version robuste (prévention des erreurs de quotes et ordre garanti)
*/

-- ============================================================================
-- 1) VÉRIFICATION DES MIGRATIONS APPLIQUÉES
-- ============================================================================

WITH rows AS (
  SELECT 0 AS ord, NULL::text AS sort_key,
         '=== MIGRATIONS APPLIQUÉES ==='::text AS section,
         ''::text AS details
  UNION ALL
  SELECT 1 AS ord, version::text AS sort_key,
         version::text AS section,
         name::text AS details
  FROM supabase_migrations.schema_migrations
  WHERE version >= '20251101120000'
)
SELECT section, details
FROM rows
ORDER BY ord, sort_key DESC NULLS LAST;

-- ============================================================================
-- 2) VÉRIFICATION TABLE BATCH_DOCUMENTS
-- ============================================================================

WITH rows AS (
  SELECT 0 AS ord, ''::text AS section, ''::text AS details
  UNION ALL
  SELECT 1, '=== TABLE BATCH_DOCUMENTS ===', ''
  UNION ALL
  SELECT 2, 'Table exists',
         CASE
           WHEN EXISTS (
             SELECT 1
             FROM information_schema.tables
             WHERE table_name = 'batch_documents'
           )
           THEN '✅ OUI - Table existe'
           ELSE '❌ NON - Table manquante'
         END
  UNION ALL
  SELECT 3, 'Columns count',
         COALESCE((
           SELECT COUNT(*)::text || ' colonnes'
           FROM information_schema.columns
           WHERE table_name = 'batch_documents'
         ), '0 colonnes - Table non trouvée')
)
SELECT section, details
FROM rows
ORDER BY ord;

-- Détail des colonnes si la table existe (NOTICE)
DO $$
DECLARE
  r record;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = 'batch_documents'
  ) THEN
    RAISE NOTICE '--- Colonnes de batch_documents ---';
    FOR r IN
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'batch_documents'
      ORDER BY ordinal_position
    LOOP
      RAISE NOTICE '% (%)', r.column_name, r.data_type;
    END LOOP;
  END IF;
END $$ LANGUAGE plpgsql;

-- ============================================================================
-- 3) VÉRIFICATION DES INDEXES
-- ============================================================================

WITH rows AS (
  SELECT 0 AS ord, ''::text AS section, ''::text AS details
  UNION ALL
  SELECT 1, '=== INDEXES SUR BATCH_DOCUMENTS ===', ''
  UNION ALL
  SELECT 2, idx.indexname, 'Index existe'
  FROM pg_indexes AS idx
  WHERE idx.tablename = 'batch_documents'
  UNION ALL
  SELECT 3, 'Total indexes',
         COALESCE((
           SELECT COUNT(*)::text || ' indexes'
           FROM pg_indexes
           WHERE tablename = 'batch_documents'
         ), '0 indexes')
)
SELECT section, details
FROM rows
ORDER BY ord, section;

-- ============================================================================
-- 4) VÉRIFICATION RLS SUR TABLE
-- ============================================================================

WITH rows AS (
  SELECT 0 AS ord, ''::text AS section, ''::text AS details
  UNION ALL
  SELECT 1, '=== RLS POLICIES - batch_documents ===', ''
  UNION ALL
  SELECT 2, 'RLS enabled',
         CASE
           WHEN EXISTS (
             SELECT 1
             FROM pg_tables
             WHERE tablename = 'batch_documents'
               AND rowsecurity = true
           )
           THEN '✅ OUI - RLS activé'
           ELSE '❌ NON - RLS désactivé'
         END
  UNION ALL
  SELECT 3, policyname::text,
         ('Command: ' || cmd::text)::text
  FROM pg_policies
  WHERE tablename = 'batch_documents'
  UNION ALL
  SELECT 4, 'Total policies',
         COALESCE((
           SELECT COUNT(*)::text || ' policies'
           FROM pg_policies
           WHERE tablename = 'batch_documents'
         ), '0 policies')
)
SELECT section, details
FROM rows
ORDER BY ord, section;

-- ============================================================================
-- 5) VÉRIFICATION STORAGE BUCKETS
-- ============================================================================

WITH rows AS (
  SELECT 0 AS ord, ''::text AS section, ''::text AS details
  UNION ALL
  SELECT 1, '=== STORAGE BUCKETS ===', ''
  UNION ALL
  SELECT 2, id::text,
         ('Public: ' || public::text || ' | Created: ' || created_at::date::text)::text
  FROM storage.buckets
  WHERE id IN (
    'batch-documents',
    'assay-certificates',
    'documents',
    'reports',
    'payment-proofs'
  )
  UNION ALL
  SELECT 3, 'batch-documents exists',
         CASE
           WHEN EXISTS (
             SELECT 1 FROM storage.buckets WHERE id = 'batch-documents'
           )
           THEN '✅ OUI - Bucket existe'
           ELSE '❌ NON - Bucket manquant'
         END
  UNION ALL
  SELECT 4, 'assay-certificates exists',
         CASE
           WHEN EXISTS (
             SELECT 1 FROM storage.buckets WHERE id = 'assay-certificates'
           )
           THEN '✅ OUI - Bucket existe'
           ELSE '❌ NON - Bucket manquant'
         END
)
SELECT section, details
FROM rows
ORDER BY ord, section;

-- ============================================================================
-- 6) VÉRIFICATION RLS POLICIES STORAGE
--   (ordre maîtrisé via sort_key pour éviter ORDER BY avant UNION)
-- ============================================================================

WITH rows AS (
  SELECT 0 AS ord, NULL::text AS sort_key, ''::text AS section, ''::text AS details
  UNION ALL
  SELECT 1, NULL, '=== STORAGE POLICIES ===', ''
  UNION ALL
  SELECT 2, policyname::text AS sort_key,
         policyname::text,
         ('Storage policy: ' || cmd::text)::text
  FROM pg_policies
  WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND (
      policyname ILIKE '%batch%document%'
      OR policyname ILIKE '%assay%certificate%'
    )
  UNION ALL
  SELECT 3, 'zz1', 'Total storage policies (batch-documents)',
         COALESCE((
           SELECT COUNT(*)::text || ' policies'
           FROM pg_policies
           WHERE schemaname = 'storage'
             AND tablename = 'objects'
             AND policyname ILIKE '%batch%document%'
         ), '0 policies')
  UNION ALL
  SELECT 4, 'zz2', 'Total storage policies (assay-certificates)',
         COALESCE((
           SELECT COUNT(*)::text || ' policies'
           FROM pg_policies
           WHERE schemaname = 'storage'
             AND tablename = 'objects'
             AND policyname ILIKE '%assay%certificate%'
         ), '0 policies')
)
SELECT section, details
FROM rows
ORDER BY ord, sort_key NULLS FIRST;

-- ============================================================================
-- 7) VÉRIFICATION VUE v_batch_documents_with_details
--   (ligne courte, aucun commentaire après la quote)
-- ============================================================================

WITH rows AS (
  SELECT 0 AS ord, ''::text AS section, ''::text AS details
  UNION ALL
  SELECT 1, '=== VUE v_batch_documents_with_details ===', ''
  UNION ALL
  SELECT 2, 'View exists',
         CASE
           WHEN EXISTS (
             SELECT 1
             FROM information_schema.views
             WHERE table_name = 'v_batch_documents_with_details'
           )
           THEN '✅ OUI - Vue existe'
           ELSE '❌ NON - Vue manquante'
         END
)
SELECT section, details
FROM rows
ORDER BY ord, section;

-- ============================================================================
-- 8) VÉRIFICATION TRIGGERS
-- ============================================================================

WITH rows AS (
  SELECT 0 AS ord, ''::text AS section, ''::text AS details
  UNION ALL
  SELECT 1, '=== TRIGGERS - batch_documents ===', ''
  UNION ALL
  SELECT 2, trigger_name::text,
         ('Event: ' || event_manipulation || ' | Timing: ' || action_timing)::text
  FROM information_schema.triggers
  WHERE event_object_table = 'batch_documents'
  UNION ALL
  SELECT 3, 'Total triggers',
         COALESCE((
           SELECT COUNT(*)::text || ' triggers'
           FROM information_schema.triggers
           WHERE event_object_table = 'batch_documents'
         ), '0 triggers')
)
SELECT section, details
FROM rows
ORDER BY ord, section;

-- ============================================================================
-- 9) VÉRIFICATION FONCTIONS
-- ============================================================================

WITH rows AS (
  SELECT 0 AS ord, ''::text AS section, ''::text AS details
  UNION ALL
  SELECT 1, '=== FONCTIONS LIÉES ===', ''
  UNION ALL
  SELECT 2, routine_name::text, 'Function exists'
  FROM information_schema.routines
  WHERE routine_name ILIKE '%batch%document%'
    AND routine_schema = 'public'
  UNION ALL
  SELECT 3, 'update_batch_documents_updated_at',
         CASE
           WHEN EXISTS (
             SELECT 1
             FROM information_schema.routines
             WHERE routine_name = 'update_batch_documents_updated_at'
               AND routine_schema = 'public'
           )
           THEN '✅ OUI - Fonction existe'
           ELSE '❌ NON - Fonction manquante'
         END
)
SELECT section, details
FROM rows
ORDER BY ord, section;

-- ============================================================================
-- 10) RÉSUMÉ FINAL
-- ============================================================================

WITH rows AS (
  SELECT 0 AS ord, ''::text AS section, ''::text AS details
  UNION ALL
  SELECT 1, '=== RÉSUMÉ FINAL ===', ''
  UNION ALL
  SELECT 2, 'Status Table batch_documents',
         CASE
           WHEN EXISTS (
             SELECT 1
             FROM information_schema.tables
             WHERE table_name = 'batch_documents'
           )
           THEN '✅ PRÊT'
           ELSE '❌ À CRÉER'
         END
  UNION ALL
  SELECT 3, 'Status Storage batch-documents',
         CASE
           WHEN EXISTS (
             SELECT 1
             FROM storage.buckets
             WHERE id = 'batch-documents'
           )
           THEN '✅ PRÊT'
           ELSE '❌ À CRÉER'
         END
  UNION ALL
  SELECT 4, 'Status RLS Policies (table)',
         CASE
           WHEN (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'batch_documents') >= 4
             THEN '✅ PRÊT (4+ policies)'
           WHEN (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'batch_documents') > 0
             THEN '⚠️ INCOMPLET (' || (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'batch_documents')::text || ' policies)'
           ELSE '❌ MANQUANT'
         END
  UNION ALL
  SELECT 5, 'Status RLS Policies (storage)',
         CASE
           WHEN (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname ILIKE '%batch%document%') >= 4
             THEN '✅ PRÊT (4+ policies)'
           WHEN (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname ILIKE '%batch%document%') > 0
             THEN '⚠️ INCOMPLET (' || (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname ILIKE '%batch%document%')::text || ' policies)'
           ELSE '❌ MANQUANT'
         END
  UNION ALL
  SELECT 6, 'Status Vue avec détails',
         CASE
           WHEN EXISTS (
             SELECT 1
             FROM information_schema.views
             WHERE table_name = 'v_batch_documents_with_details'
           )
           THEN '✅ PRÊT'
           ELSE '❌ À CRÉER'
         END
  UNION ALL
  SELECT 7, 'Status Indexes',
         CASE
           WHEN (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'batch_documents') >= 5
             THEN '✅ PRÊT (5+ indexes)'
           WHEN (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'batch_documents') > 0
             THEN '⚠️ INCOMPLET (' || (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'batch_documents')::text || ' indexes)'
           ELSE '❌ MANQUANT'
         END
  UNION ALL
  SELECT 8, 'Status Triggers',
         CASE
           WHEN EXISTS (
             SELECT 1
             FROM information_schema.triggers
             WHERE event_object_table = 'batch_documents'
           )
           THEN '✅ PRÊT'
           ELSE '❌ À CRÉER'
         END
)
SELECT section, details
FROM rows
ORDER BY ord, section;
