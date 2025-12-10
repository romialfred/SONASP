/*
  Script de recherche exhaustive de 'batch_id' dans toute la base de données

  Ce script recherche 'batch_id' dans :
  - Colonnes de tables
  - Colonnes de vues
  - Définitions de fonctions
  - Définitions de triggers
  - Contraintes (FK, CHECK, etc.)
  - Index
*/

-- ============================================
-- 1. COLONNES DE TABLES
-- ============================================
SELECT
  'TABLE COLUMN' as type,
  schemaname as schema_name,
  tablename as object_name,
  attname as column_name,
  format_type(atttypid, atttypmod) as data_type,
  CASE WHEN attnotnull THEN 'NOT NULL' ELSE 'NULL' END as nullable
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
SELECT
  'VIEW COLUMN' as type,
  table_schema as schema_name,
  table_name as object_name,
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
-- 3. FONCTIONS (définition contient batch_id)
-- ============================================
SELECT
  'FUNCTION' as type,
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  pg_get_functiondef(p.oid) as definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND (
    pg_get_functiondef(p.oid) ILIKE '%batch_id%'
    OR pg_get_function_arguments(p.oid) ILIKE '%batch_id%'
  )
ORDER BY p.proname;

-- ============================================
-- 4. TRIGGERS (définition contient batch_id)
-- ============================================
SELECT
  'TRIGGER' as type,
  event_object_schema as schema_name,
  event_object_table as table_name,
  trigger_name,
  action_statement,
  action_timing || ' ' || string_agg(event_manipulation, ', ') as trigger_event
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND action_statement ILIKE '%batch_id%'
GROUP BY event_object_schema, event_object_table, trigger_name, action_statement, action_timing
ORDER BY event_object_table, trigger_name;

-- ============================================
-- 5. CONTRAINTES (Foreign Keys, Check, etc.)
-- ============================================
SELECT
  'CONSTRAINT' as type,
  tc.table_schema as schema_name,
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  CASE
    WHEN tc.constraint_type = 'FOREIGN KEY' THEN
      'FK: ' || kcu.column_name || ' -> ' || ccu.table_name || '(' || ccu.column_name || ')'
    WHEN tc.constraint_type = 'CHECK' THEN
      'CHECK: ' || cc.check_clause
    ELSE
      kcu.column_name
  END as constraint_details
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
LEFT JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
LEFT JOIN information_schema.check_constraints cc
  ON cc.constraint_name = tc.constraint_name
  AND cc.constraint_schema = tc.table_schema
WHERE tc.table_schema = 'public'
  AND (
    kcu.column_name ILIKE '%batch_id%'
    OR ccu.column_name ILIKE '%batch_id%'
    OR cc.check_clause ILIKE '%batch_id%'
    OR tc.constraint_name ILIKE '%batch_id%'
  )
ORDER BY tc.table_name, tc.constraint_name;

-- ============================================
-- 6. INDEX (nom ou définition contient batch_id)
-- ============================================
SELECT
  'INDEX' as type,
  schemaname as schema_name,
  tablename as table_name,
  indexname as index_name,
  indexdef as index_definition
FROM pg_indexes
WHERE schemaname = 'public'
  AND (
    indexname ILIKE '%batch_id%'
    OR indexdef ILIKE '%batch_id%'
  )
ORDER BY tablename, indexname;

-- ============================================
-- 7. RÉSUMÉ PAR TYPE
-- ============================================
SELECT
  'SUMMARY' as report_type,
  'Tables with batch_id columns' as category,
  COUNT(DISTINCT tablename)::text as count
FROM pg_attribute
JOIN pg_class ON pg_attribute.attrelid = pg_class.oid
JOIN pg_namespace ON pg_class.relnamespace = pg_namespace.oid
JOIN pg_stat_user_tables ON pg_class.relname = pg_stat_user_tables.tablename
WHERE attname ILIKE '%batch_id%'
  AND attnum > 0
  AND NOT attisdropped
  AND schemaname = 'public'

UNION ALL

SELECT
  'SUMMARY',
  'Functions referencing batch_id',
  COUNT(DISTINCT p.proname)::text
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND pg_get_functiondef(p.oid) ILIKE '%batch_id%'

UNION ALL

SELECT
  'SUMMARY',
  'Triggers referencing batch_id',
  COUNT(DISTINCT trigger_name)::text
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND action_statement ILIKE '%batch_id%'

UNION ALL

SELECT
  'SUMMARY',
  'Constraints on batch_id',
  COUNT(DISTINCT tc.constraint_name)::text
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
LEFT JOIN information_schema.check_constraints cc
  ON cc.constraint_name = tc.constraint_name
WHERE tc.table_schema = 'public'
  AND (
    kcu.column_name ILIKE '%batch_id%'
    OR cc.check_clause ILIKE '%batch_id%'
    OR tc.constraint_name ILIKE '%batch_id%'
  );
