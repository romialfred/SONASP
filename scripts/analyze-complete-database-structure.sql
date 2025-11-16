/*
  Analyse Complète de la Structure de Base de Données

  Ce script analyse:
  1. Tous les ENUMs de type status
  2. Toutes les tables avec colonnes status
  3. Tous les triggers sur ces tables
  4. Toutes les fonctions liées aux statuts
*/

\echo ''
\echo '═══════════════════════════════════════════════════════'
\echo '📊 ANALYSE COMPLÈTE DE LA STRUCTURE DATABASE'
\echo '═══════════════════════════════════════════════════════'
\echo ''

-- =====================================================
-- 1. TOUS LES ENUMS DE TYPE STATUS
-- =====================================================

\echo '1️⃣  ENUMS DE TYPE STATUS'
\echo '─────────────────────────────────────────────────────'
\echo ''

SELECT
  t.typname AS enum_name,
  string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) AS values,
  COUNT(e.enumlabel) AS nb_values,
  obj_description(t.oid, 'pg_type') AS description
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname LIKE '%status%'
GROUP BY t.typname, t.oid
ORDER BY t.typname;

\echo ''

-- =====================================================
-- 2. TABLES AVEC COLONNES STATUS
-- =====================================================

\echo '2️⃣  TABLES AVEC COLONNES STATUS'
\echo '─────────────────────────────────────────────────────'
\echo ''

SELECT
  c.table_name,
  c.column_name,
  c.data_type,
  c.udt_name AS enum_type,
  c.is_nullable,
  c.column_default
FROM information_schema.columns c
WHERE c.column_name LIKE '%status%'
  AND c.table_schema = 'public'
ORDER BY c.table_name, c.column_name;

\echo ''

-- =====================================================
-- 3. DÉTAIL PAR TABLE IMPORTANTE
-- =====================================================

\echo '3️⃣  DÉTAIL: daily_production'
\echo '─────────────────────────────────────────────────────'

SELECT
  column_name,
  data_type,
  udt_name AS enum_used,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'daily_production'
  AND column_name = 'status';

\echo ''
\echo '   Valeurs ENUM utilisé:'

SELECT
  e.enumlabel AS valeur,
  e.enumsortorder AS ordre
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname = (
  SELECT udt_name
  FROM information_schema.columns
  WHERE table_name = 'daily_production'
  AND column_name = 'status'
)
ORDER BY e.enumsortorder;

\echo ''
\echo '3️⃣  DÉTAIL: shipping_preparations'
\echo '─────────────────────────────────────────────────────'

SELECT
  column_name,
  data_type,
  udt_name AS enum_used,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'shipping_preparations'
  AND column_name = 'status';

\echo ''
\echo '   Valeurs ENUM utilisé:'

SELECT
  e.enumlabel AS valeur,
  e.enumsortorder AS ordre
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname = (
  SELECT udt_name
  FROM information_schema.columns
  WHERE table_name = 'shipping_preparations'
  AND column_name = 'status'
)
ORDER BY e.enumsortorder;

\echo ''

-- =====================================================
-- 4. TOUS LES TRIGGERS SUR LES TABLES
-- =====================================================

\echo '4️⃣  TRIGGERS SUR LES TABLES'
\echo '─────────────────────────────────────────────────────'
\echo ''

SELECT
  t.tgname AS trigger_name,
  c.relname AS table_name,
  p.proname AS function_name,
  CASE t.tgenabled
    WHEN 'O' THEN '✅ ACTIF'
    WHEN 'D' THEN '❌ DÉSACTIVÉ'
    ELSE '⚠️  INCONNU'
  END AS status,
  pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_proc p ON t.tgfoid = p.oid
WHERE c.relname IN ('daily_production', 'shipping_preparations', 'freight_customs', 'sales')
  AND NOT t.tgisinternal
ORDER BY c.relname, t.tgname;

\echo ''

-- =====================================================
-- 5. FONCTIONS LIÉES AUX STATUTS
-- =====================================================

\echo '5️⃣  FONCTIONS LIÉES AUX STATUTS'
\echo '─────────────────────────────────────────────────────'
\echo ''

SELECT
  proname AS function_name,
  pg_get_function_arguments(oid) AS arguments,
  pg_get_function_result(oid) AS return_type,
  prosrc IS NOT NULL AS has_source
FROM pg_proc
WHERE proname LIKE '%status%'
  OR proname LIKE '%log%'
ORDER BY proname;

\echo ''

-- =====================================================
-- 6. DÉPENDANCES ENTRE ENUMS ET TABLES
-- =====================================================

\echo '6️⃣  DÉPENDANCES ENUMS → TABLES'
\echo '─────────────────────────────────────────────────────'
\echo ''

SELECT
  t.typname AS enum_name,
  c.table_name,
  c.column_name,
  'Est utilisé par ' || c.table_name || '.' || c.column_name AS usage
FROM pg_type t
JOIN information_schema.columns c ON c.udt_name = t.typname
WHERE t.typname LIKE '%status%'
  AND c.table_schema = 'public'
ORDER BY t.typname, c.table_name;

\echo ''

-- =====================================================
-- 7. ENUMS OBSOLÈTES (non utilisés)
-- =====================================================

\echo '7️⃣  ENUMS OBSOLÈTES (Non Utilisés)'
\echo '─────────────────────────────────────────────────────'
\echo ''

SELECT
  t.typname AS enum_obsolete,
  COUNT(e.enumlabel) AS nb_values,
  '❌ Peut être supprimé' AS action
FROM pg_type t
LEFT JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname LIKE '%status%'
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.udt_name = t.typname
    AND c.table_schema = 'public'
  )
GROUP BY t.typname
ORDER BY t.typname;

\echo ''

-- =====================================================
-- 8. STATISTIQUES PAR STATUT (daily_production)
-- =====================================================

\echo '8️⃣  STATISTIQUES: Productions par Statut'
\echo '─────────────────────────────────────────────────────'
\echo ''

SELECT
  status::text AS statut,
  COUNT(*) AS nombre,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) || '%' AS pourcentage
FROM daily_production
GROUP BY status
ORDER BY COUNT(*) DESC;

\echo ''

-- =====================================================
-- 9. RÉSUMÉ ET RECOMMANDATIONS
-- =====================================================

\echo '═══════════════════════════════════════════════════════'
\echo '📋 RÉSUMÉ'
\echo '═══════════════════════════════════════════════════════'
\echo ''

\echo 'Comptage:'
SELECT
  'ENUMs status: ' || COUNT(DISTINCT t.typname) AS info
FROM pg_type t
WHERE t.typname LIKE '%status%';

SELECT
  'Tables avec status: ' || COUNT(DISTINCT c.table_name) AS info
FROM information_schema.columns c
WHERE c.column_name LIKE '%status%'
  AND c.table_schema = 'public';

SELECT
  'Triggers actifs: ' || COUNT(*) AS info
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
WHERE c.relname IN ('daily_production', 'shipping_preparations')
  AND NOT t.tgisinternal;

\echo ''
\echo '═══════════════════════════════════════════════════════'
