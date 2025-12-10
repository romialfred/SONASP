/*
  Script de recherche simple de 'batch_id' (SANS array_agg)

  Ce script recherche 'batch_id' dans :
  - Colonnes de tables
  - Colonnes de vues
  - Définitions de fonctions
  - Définitions de triggers
  - Contraintes
  - Index

  Version simple sans agrégation complexe
*/

-- ============================================
-- 1. COLONNES DE TABLES
-- ============================================
\echo '1. COLONNES DE TABLES'
\echo '===================='

SELECT
  schemaname,
  tablename,
  attname as column_name,
  format_type(atttypid, atttypmod) as data_type
FROM pg_attribute
JOIN pg_class ON pg_attribute.attrelid = pg_class.oid
JOIN pg_namespace ON pg_class.relnamespace = pg_namespace.oid
JOIN pg_stat_user_tables ON pg_class.relname = pg_stat_user_tables.tablename
  AND pg_namespace.nspname = pg_stat_user_tables.schemaname
WHERE attname ILIKE '%batch_id%'
  AND attnum > 0
  AND NOT attisdropped
  AND schemaname = 'public'
ORDER BY tablename, attname;

-- ============================================
-- 2. COLONNES DE VUES
-- ============================================
\echo ''
\echo '2. COLONNES DE VUES'
\echo '===================='

SELECT
  table_schema,
  table_name as view_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE column_name ILIKE '%batch_id%'
  AND table_schema = 'public'
  AND table_name IN (
    SELECT table_name
    FROM information_schema.views
    WHERE table_schema = 'public'
  )
ORDER BY table_name, column_name;

-- ============================================
-- 3. FONCTIONS
-- ============================================
\echo ''
\echo '3. FONCTIONS'
\echo '===================='

SELECT
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND (
    pg_get_functiondef(p.oid) ILIKE '%batch_id%'
    OR pg_get_function_arguments(p.oid) ILIKE '%batch_id%'
  )
ORDER BY p.proname;

-- ============================================
-- 4. TRIGGERS
-- ============================================
\echo ''
\echo '4. TRIGGERS'
\echo '===================='

SELECT DISTINCT
  event_object_table as table_name,
  trigger_name,
  action_timing,
  event_manipulation
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND action_statement ILIKE '%batch_id%'
ORDER BY event_object_table, trigger_name;

-- ============================================
-- 5. CONTRAINTES
-- ============================================
\echo ''
\echo '5. CONTRAINTES'
\echo '===================='

SELECT DISTINCT
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
WHERE tc.table_schema = 'public'
  AND (
    kcu.column_name ILIKE '%batch_id%'
    OR tc.constraint_name ILIKE '%batch_id%'
  )
ORDER BY tc.table_name, tc.constraint_name;

-- ============================================
-- 6. INDEX
-- ============================================
\echo ''
\echo '6. INDEX'
\echo '===================='

SELECT
  tablename as table_name,
  indexname as index_name
FROM pg_indexes
WHERE schemaname = 'public'
  AND (
    indexname ILIKE '%batch_id%'
    OR indexdef ILIKE '%batch_id%'
  )
ORDER BY tablename, indexname;

-- ============================================
-- 7. RÉSUMÉ (Comptages simples)
-- ============================================
\echo ''
\echo '7. RÉSUMÉ'
\echo '===================='

-- Compter tables avec batch_id
SELECT
  'Tables with batch_id' as category,
  COUNT(DISTINCT tablename)::text as count
FROM pg_attribute
JOIN pg_class ON pg_attribute.attrelid = pg_class.oid
JOIN pg_namespace ON pg_class.relnamespace = pg_namespace.oid
JOIN pg_stat_user_tables ON pg_class.relname = pg_stat_user_tables.tablename
WHERE attname ILIKE '%batch_id%'
  AND attnum > 0
  AND NOT attisdropped
  AND schemaname = 'public';

-- Compter fonctions
SELECT
  'Functions with batch_id' as category,
  COUNT(DISTINCT p.proname)::text as count
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND pg_get_functiondef(p.oid) ILIKE '%batch_id%';

-- Compter triggers
SELECT
  'Triggers with batch_id' as category,
  COUNT(DISTINCT trigger_name)::text as count
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND action_statement ILIKE '%batch_id%';

-- Compter contraintes
SELECT
  'Constraints on batch_id' as category,
  COUNT(DISTINCT tc.constraint_name)::text as count
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'public'
  AND (
    kcu.column_name ILIKE '%batch_id%'
    OR tc.constraint_name ILIKE '%batch_id%'
  );

-- Compter index
SELECT
  'Indexes on batch_id' as category,
  COUNT(DISTINCT indexname)::text as count
FROM pg_indexes
WHERE schemaname = 'public'
  AND (
    indexname ILIKE '%batch_id%'
    OR indexdef ILIKE '%batch_id%'
  );

\echo ''
\echo '===================='
\echo 'Recherche terminée'
\echo '===================='
