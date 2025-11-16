/*
  Générer les Commandes de Suppression des ENUMs Obsolètes

  Ce script analyse la base et génère les commandes DROP
  pour les ENUMs obsolètes qui ne sont PAS utilisés.

  ATTENTION: Exécuter d'abord ce script pour voir les commandes,
  puis les exécuter manuellement après vérification.
*/

\echo ''
\echo '═══════════════════════════════════════════════════════'
\echo '🔍 ANALYSE DES ENUMS OBSOLÈTES'
\echo '═══════════════════════════════════════════════════════'
\echo ''

-- =====================================================
-- 1. LISTER TOUS LES ENUMS STATUS
-- =====================================================

\echo '1️⃣  TOUS LES ENUMS STATUS EXISTANTS'
\echo '─────────────────────────────────────────────────────'
\echo ''

SELECT
  t.typname AS enum_name,
  string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) AS valeurs,
  COUNT(e.enumlabel) AS nb_valeurs,
  CASE
    WHEN EXISTS (
      SELECT 1
      FROM information_schema.columns c
      WHERE c.udt_name = t.typname
      AND c.table_schema = 'public'
    ) THEN '✅ UTILISÉ'
    ELSE '❌ OBSOLÈTE'
  END AS statut
FROM pg_type t
LEFT JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname LIKE '%status%'
GROUP BY t.typname, t.oid
ORDER BY t.typname;

\echo ''

-- =====================================================
-- 2. DÉTAIL DES ENUMS UTILISÉS PAR QUELLES TABLES
-- =====================================================

\echo '2️⃣  UTILISATION PAR TABLE'
\echo '─────────────────────────────────────────────────────'
\echo ''

SELECT
  c.udt_name AS enum_name,
  c.table_name || '.' || c.column_name AS utilisation,
  '✅ En usage' AS statut
FROM information_schema.columns c
WHERE c.udt_name LIKE '%status%'
  AND c.table_schema = 'public'
ORDER BY c.udt_name, c.table_name;

\echo ''

-- =====================================================
-- 3. ENUMS OBSOLÈTES À SUPPRIMER
-- =====================================================

\echo '3️⃣  ENUMS OBSOLÈTES (Non Utilisés)'
\echo '─────────────────────────────────────────────────────'
\echo ''

SELECT
  t.typname AS enum_obsolete,
  COUNT(e.enumlabel) AS nb_valeurs,
  '❌ Peut être supprimé' AS action,
  'DROP TYPE IF EXISTS ' || t.typname || ' CASCADE;' AS commande_suppression
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
-- 4. GÉNÉRATION SCRIPT DE NETTOYAGE
-- =====================================================

\echo '4️⃣  SCRIPT DE NETTOYAGE GÉNÉRÉ'
\echo '─────────────────────────────────────────────────────'
\echo ''
\echo '-- Copier/coller les commandes ci-dessous dans un nouveau script SQL'
\echo '-- Vérifier MANUELLEMENT avant d''exécuter!'
\echo ''
\echo 'DO $$ '
\echo 'BEGIN'
\echo '  RAISE NOTICE ''Suppression des ENUMs obsolètes...'';'
\echo ''

SELECT
  '  DROP TYPE IF EXISTS ' || t.typname || ' CASCADE;'
FROM pg_type t
WHERE t.typname LIKE '%status%'
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.udt_name = t.typname
    AND c.table_schema = 'public'
  )
ORDER BY t.typname;

\echo ''
\echo '  RAISE NOTICE ''✅ ENUMs obsolètes supprimés'';'
\echo 'END $$;'

\echo ''
\echo '═══════════════════════════════════════════════════════'
\echo '⚠️  IMPORTANT'
\echo '═══════════════════════════════════════════════════════'
\echo ''
\echo 'Avant de supprimer:'
\echo '  1. BACKUP de la base de données'
\echo '  2. Vérifier que les ENUMs sont vraiment obsolètes'
\echo '  3. Tester dans un environnement de staging'
\echo '  4. Exécuter pendant une fenêtre de maintenance'
\echo ''
\echo 'ENUMs à GARDER (utilisés actuellement):'
\echo '  • production_status_v2'
\echo '  • shipping_preparation_status'
\echo '  • freight_customs_status'
\echo '  • refinery_status'
\echo '  • inventory_status'
\echo '  • sale_status'
\echo '  • status_change_context'
\echo ''
\echo 'ENUMs à SUPPRIMER (obsolètes):'
\echo '  • production_status (ancien)'
\echo '  • shipping_status (ancien)'
\echo '  • unified_status (ancien)'
\echo '  • Tout autre ENUM status non utilisé'
\echo ''
