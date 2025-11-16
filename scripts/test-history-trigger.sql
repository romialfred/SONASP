/*
  Script de Test du Système d'Historique

  Ce script permet de tester que TOUS les changements de statut
  sont bien enregistrés dans unified_status_history

  Usage:
  psql $SUPABASE_DB_URL -f scripts/test-history-trigger.sql
*/

\echo ''
\echo '═══════════════════════════════════════════════════════'
\echo '🧪 TEST DU SYSTÈME D''HISTORIQUE'
\echo '═══════════════════════════════════════════════════════'
\echo ''

-- Test 1: Vérifier que les triggers existent
\echo '📋 Test 1: Vérification des Triggers'
\echo '─────────────────────────────────────────'

SELECT
  'Trigger: ' || tgname || ' sur table: ' || c.relname AS trigger_info,
  CASE
    WHEN tgenabled = 'O' THEN '✅ ACTIF'
    WHEN tgenabled = 'D' THEN '❌ DÉSACTIVÉ'
    ELSE '⚠️  INCONNU'
  END AS statut
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
WHERE tgname IN ('production_status_change_trigger', 'shipping_status_change_trigger')
ORDER BY c.relname, tgname;

\echo ''

-- Test 2: Vérifier la fonction
\echo '🔍 Test 2: Vérification de la Fonction'
\echo '────────────────────────────────────────'

SELECT
  'Fonction: ' || proname AS fonction,
  '✅ EXISTE' AS statut,
  pg_get_functiondef(oid) IS NOT NULL AS definition_ok
FROM pg_proc
WHERE proname = 'log_unified_status_change';

\echo ''

-- Test 3: Compter les entrées dans unified_status_history
\echo '📊 Test 3: Contenu de unified_status_history'
\echo '──────────────────────────────────────────'

SELECT
  entity_type AS type,
  COUNT(*) AS nombre_entrees,
  COUNT(DISTINCT entity_id) AS nombre_entities,
  MIN(changed_at) AS premiere_entree,
  MAX(changed_at) AS derniere_entree
FROM unified_status_history
GROUP BY entity_type
ORDER BY entity_type;

\echo ''
\echo '🔍 Dernières Entrées par Type:'
\echo ''

-- Dernières entrées production
\echo '  PRODUCTION:'
SELECT
  '    ' || to_char(changed_at, 'DD/MM/YYYY HH24:MI') || ' | ' ||
  COALESCE(old_status, 'null') || ' → ' || new_status || ' | ' ||
  action_description AS historique_production
FROM unified_status_history
WHERE entity_type = 'production'
ORDER BY changed_at DESC
LIMIT 5;

\echo ''
\echo '  SHIPPING:'
SELECT
  '    ' || to_char(changed_at, 'DD/MM/YYYY HH24:MI') || ' | ' ||
  COALESCE(old_status, 'null') || ' → ' || new_status || ' | ' ||
  action_description AS historique_shipping
FROM unified_status_history
WHERE entity_type = 'shipping'
ORDER BY changed_at DESC
LIMIT 5;

\echo ''

-- Test 4: Vérifier les statuts manquants (ready_for_customs notamment)
\echo '⚠️  Test 4: Vérification Statuts Spécifiques'
\echo '──────────────────────────────────────────────'

SELECT
  new_status AS statut,
  COUNT(*) AS occurrences,
  COUNT(DISTINCT entity_id) AS productions_uniques
FROM unified_status_history
WHERE entity_type = 'production'
GROUP BY new_status
ORDER BY new_status;

\echo ''

-- Test 5: Productions avec statut ready_for_customs mais SANS historique
\echo '🔴 Test 5: Productions ready_for_customs Sans Historique'
\echo '────────────────────────────────────────────────────────'

SELECT
  dp.id AS production_id,
  dp.batch_number AS lot,
  dp.status AS statut_actuel,
  COUNT(ush.id) AS entrees_historique,
  CASE
    WHEN COUNT(ush.id) = 0 THEN '❌ AUCUN HISTORIQUE'
    WHEN COUNT(ush.id) = 1 THEN '⚠️  UN SEUL CHANGEMENT'
    ELSE '✅ OK'
  END AS diagnostic
FROM daily_production dp
LEFT JOIN unified_status_history ush ON
  ush.entity_type = 'production' AND
  ush.entity_id = dp.id
WHERE dp.status = 'ready_for_customs'
GROUP BY dp.id, dp.batch_number, dp.status
ORDER BY COUNT(ush.id), dp.batch_number
LIMIT 10;

\echo ''

-- Test 6: Comparer nombre de productions vs nombre d'historiques
\echo '📈 Test 6: Ratio Productions / Historiques'
\echo '─────────────────────────────────────────────'

WITH stats AS (
  SELECT
    (SELECT COUNT(*) FROM daily_production) AS total_productions,
    (SELECT COUNT(DISTINCT entity_id) FROM unified_status_history WHERE entity_type = 'production') AS productions_avec_historique,
    (SELECT COUNT(*) FROM unified_status_history WHERE entity_type = 'production') AS total_historiques
)
SELECT
  total_productions AS "Total Productions",
  productions_avec_historique AS "Avec Historique",
  total_historiques AS "Entrées Historique",
  ROUND(100.0 * productions_avec_historique / NULLIF(total_productions, 0), 1) || '%' AS "Couverture",
  CASE
    WHEN productions_avec_historique = total_productions THEN '✅ PARFAIT'
    WHEN productions_avec_historique * 100 / NULLIF(total_productions, 0) > 80 THEN '⚠️  BON'
    ELSE '❌ INCOMPLET'
  END AS "Diagnostic"
FROM stats;

\echo ''

-- Test 7: Identifier les productions sans historique
\echo '🔍 Test 7: Productions SANS Historique'
\echo '────────────────────────────────────────'

SELECT
  dp.id,
  dp.batch_number AS lot,
  dp.status AS statut,
  dp.created_at AS cree_le,
  '❌ MANQUANT' AS historique
FROM daily_production dp
LEFT JOIN unified_status_history ush ON
  ush.entity_type = 'production' AND
  ush.entity_id = dp.id
WHERE ush.id IS NULL
ORDER BY dp.created_at DESC
LIMIT 10;

\echo ''
\echo '═══════════════════════════════════════════════════════'
\echo '📊 RÉSUMÉ DU TEST'
\echo '═══════════════════════════════════════════════════════'
\echo ''
\echo 'Actions Recommandées:'
\echo '  1. Si des triggers sont désactivés → Réactiver'
\echo '  2. Si des productions n''ont pas d''historique → Appliquer la migration'
\echo '  3. Si ready_for_customs est absent → Le trigger ne fonctionne pas'
\echo '  4. Si couverture < 100% → Vérifier la configuration'
\echo ''
\echo 'Migration à appliquer:'
\echo '  supabase/migrations/20251115_002_fix_complete_history_tracking.sql'
\echo ''
