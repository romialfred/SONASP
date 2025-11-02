/*
  SCRIPT DE VÉRIFICATION - MODULE BATCH DOCUMENTS

  Ce script vérifie l'état actuel de la base de données pour déterminer
  quelles migrations ont déjà été appliquées et ce qui reste à faire.

  INSTRUCTIONS:
  1. Copiez ce script dans l'éditeur SQL de Supabase
  2. Exécutez-le
  3. Examinez les résultats pour voir ce qui manque
  4. Référez-vous au rapport ci-dessous pour les actions à entreprendre
*/

-- ============================================================================
-- 1. VÉRIFICATION DES MIGRATIONS APPLIQUÉES
-- ============================================================================

SELECT
  '=== MIGRATIONS APPLIQUÉES ===' as section,
  '' as details
UNION ALL
SELECT
  version::text,
  name
FROM supabase_migrations.schema_migrations
WHERE version >= '20251101120000'
ORDER BY version DESC;

-- ============================================================================
-- 2. VÉRIFICATION TABLE BATCH_DOCUMENTS
-- ============================================================================

SELECT
  '' as section,
  '' as details
UNION ALL
SELECT
  '=== TABLE BATCH_DOCUMENTS ===' as section,
  '' as details
UNION ALL
SELECT
  'Table exists' as section,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_name = 'batch_documents'
    )
    THEN '✅ OUI - Table existe'
    ELSE '❌ NON - Table manquante'
  END as details
UNION ALL
SELECT
  'Columns count' as section,
  COALESCE(
    (SELECT COUNT(*)::text || ' colonnes'
     FROM information_schema.columns
     WHERE table_name = 'batch_documents'),
    '0 colonnes - Table non trouvée'
  ) as details;

-- Détail des colonnes si la table existe
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'batch_documents') THEN
    RAISE NOTICE '--- Colonnes de batch_documents ---';
    PERFORM column_name || ' (' || data_type || ')'
    FROM information_schema.columns
    WHERE table_name = 'batch_documents'
    ORDER BY ordinal_position;
  END IF;
END $$;

-- ============================================================================
-- 3. VÉRIFICATION DES INDEXES
-- ============================================================================

SELECT
  '' as section,
  '' as details
UNION ALL
SELECT
  '=== INDEXES SUR BATCH_DOCUMENTS ===' as section,
  '' as details
UNION ALL
SELECT
  indexname as section,
  'Index existe' as details
FROM pg_indexes
WHERE tablename = 'batch_documents'
UNION ALL
SELECT
  'Total indexes' as section,
  COALESCE(
    (SELECT COUNT(*)::text || ' indexes'
     FROM pg_indexes
     WHERE tablename = 'batch_documents'),
    '0 indexes'
  ) as details;

-- ============================================================================
-- 4. VÉRIFICATION RLS SUR TABLE
-- ============================================================================

SELECT
  '' as section,
  '' as details
UNION ALL
SELECT
  '=== RLS POLICIES - batch_documents ===' as section,
  '' as details
UNION ALL
SELECT
  'RLS enabled' as section,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM pg_tables
      WHERE tablename = 'batch_documents'
      AND rowsecurity = true
    )
    THEN '✅ OUI - RLS activé'
    ELSE '❌ NON - RLS désactivé'
  END as details
UNION ALL
SELECT
  policyname as section,
  cmd::text || ' - ' || CASE WHEN permissive THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END as details
FROM pg_policies
WHERE tablename = 'batch_documents'
UNION ALL
SELECT
  'Total policies' as section,
  COALESCE(
    (SELECT COUNT(*)::text || ' policies'
     FROM pg_policies
     WHERE tablename = 'batch_documents'),
    '0 policies'
  ) as details;

-- ============================================================================
-- 5. VÉRIFICATION STORAGE BUCKETS
-- ============================================================================

SELECT
  '' as section,
  '' as details
UNION ALL
SELECT
  '=== STORAGE BUCKETS ===' as section,
  '' as details
UNION ALL
SELECT
  id as section,
  'Public: ' || public::text || ' | Created: ' || created_at::date::text as details
FROM storage.buckets
WHERE id IN ('batch-documents', 'assay-certificates', 'documents', 'reports', 'payment-proofs')
UNION ALL
SELECT
  'batch-documents exists' as section,
  CASE
    WHEN EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'batch-documents')
    THEN '✅ OUI - Bucket existe'
    ELSE '❌ NON - Bucket manquant'
  END as details
UNION ALL
SELECT
  'assay-certificates exists' as section,
  CASE
    WHEN EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'assay-certificates')
    THEN '✅ OUI - Bucket existe'
    ELSE '❌ NON - Bucket manquant'
  END as details;

-- ============================================================================
-- 6. VÉRIFICATION RLS POLICIES STORAGE
-- ============================================================================

SELECT
  '' as section,
  '' as details
UNION ALL
SELECT
  '=== STORAGE POLICIES ===' as section,
  '' as details
UNION ALL
SELECT
  policyname as section,
  'Storage policy: ' || cmd::text as details
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND (
    policyname ILIKE '%batch%document%'
    OR policyname ILIKE '%assay%certificate%'
  )
ORDER BY policyname
UNION ALL
SELECT
  'Total storage policies (batch-documents)' as section,
  COALESCE(
    (SELECT COUNT(*)::text || ' policies'
     FROM pg_policies
     WHERE schemaname = 'storage'
       AND tablename = 'objects'
       AND policyname ILIKE '%batch%document%'),
    '0 policies'
  ) as details
UNION ALL
SELECT
  'Total storage policies (assay-certificates)' as section,
  COALESCE(
    (SELECT COUNT(*)::text || ' policies'
     FROM pg_policies
     WHERE schemaname = 'storage'
       AND tablename = 'objects'
       AND policyname ILIKE '%assay%certificate%'),
    '0 policies'
  ) as details;

-- ============================================================================
-- 7. VÉRIFICATION VUE v_batch_documents_with_details
-- ============================================================================

SELECT
  '' as section,
  '' as details
UNION ALL
SELECT
  '=== VUE v_batch_documents_with_details ===' as section,
  '' as details
UNION ALL
SELECT
  'View exists' as section,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.views
      WHERE table_name = 'v_batch_documents_with_details'
    )
    THEN '✅ OUI - Vue existe'
    ELSE '❌ NON - Vue manquante'
  END as details;

-- ============================================================================
-- 8. VÉRIFICATION TRIGGERS
-- ============================================================================

SELECT
  '' as section,
  '' as details
UNION ALL
SELECT
  '=== TRIGGERS - batch_documents ===' as section,
  '' as details
UNION ALL
SELECT
  trigger_name as section,
  'Event: ' || event_manipulation || ' | Timing: ' || action_timing as details
FROM information_schema.triggers
WHERE event_object_table = 'batch_documents'
UNION ALL
SELECT
  'Total triggers' as section,
  COALESCE(
    (SELECT COUNT(*)::text || ' triggers'
     FROM information_schema.triggers
     WHERE event_object_table = 'batch_documents'),
    '0 triggers'
  ) as details;

-- ============================================================================
-- 9. VÉRIFICATION FONCTIONS
-- ============================================================================

SELECT
  '' as section,
  '' as details
UNION ALL
SELECT
  '=== FONCTIONS LIÉES ===' as section,
  '' as details
UNION ALL
SELECT
  routine_name as section,
  'Function exists' as details
FROM information_schema.routines
WHERE routine_name ILIKE '%batch%document%'
  AND routine_schema = 'public'
UNION ALL
SELECT
  'update_batch_documents_updated_at' as section,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM information_schema.routines
      WHERE routine_name = 'update_batch_documents_updated_at'
    )
    THEN '✅ OUI - Fonction existe'
    ELSE '❌ NON - Fonction manquante'
  END as details;

-- ============================================================================
-- 10. RÉSUMÉ FINAL
-- ============================================================================

SELECT
  '' as section,
  '' as details
UNION ALL
SELECT
  '=== RÉSUMÉ FINAL ===' as section,
  '' as details
UNION ALL
SELECT
  'Status Table batch_documents' as section,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'batch_documents')
    THEN '✅ PRÊT'
    ELSE '❌ À CRÉER'
  END as details
UNION ALL
SELECT
  'Status Storage batch-documents' as section,
  CASE
    WHEN EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'batch-documents')
    THEN '✅ PRÊT'
    ELSE '❌ À CRÉER'
  END as details
UNION ALL
SELECT
  'Status RLS Policies (table)' as section,
  CASE
    WHEN (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'batch_documents') >= 4
    THEN '✅ PRÊT (4+ policies)'
    WHEN (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'batch_documents') > 0
    THEN '⚠️ INCOMPLET (' || (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'batch_documents')::text || ' policies)'
    ELSE '❌ MANQUANT'
  END as details
UNION ALL
SELECT
  'Status RLS Policies (storage)' as section,
  CASE
    WHEN (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname ILIKE '%batch%document%') >= 4
    THEN '✅ PRÊT (4+ policies)'
    WHEN (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname ILIKE '%batch%document%') > 0
    THEN '⚠️ INCOMPLET (' || (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname ILIKE '%batch%document%')::text || ' policies)'
    ELSE '❌ MANQUANT'
  END as details
UNION ALL
SELECT
  'Status Vue avec détails' as section,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'v_batch_documents_with_details')
    THEN '✅ PRÊT'
    ELSE '❌ À CRÉER'
  END as details
UNION ALL
SELECT
  'Status Indexes' as section,
  CASE
    WHEN (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'batch_documents') >= 5
    THEN '✅ PRÊT (5+ indexes)'
    WHEN (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'batch_documents') > 0
    THEN '⚠️ INCOMPLET (' || (SELECT COUNT(*) FROM pg_indexes WHERE tablename = 'batch_documents')::text || ' indexes)'
    ELSE '❌ MANQUANT'
  END as details
UNION ALL
SELECT
  'Status Triggers' as section,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.triggers WHERE event_object_table = 'batch_documents')
    THEN '✅ PRÊT'
    ELSE '❌ À CRÉER'
  END as details;
