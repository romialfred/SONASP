/*
  Script de Test du Systeme d'Historique - VERSION FINALE CORRECTE

  Base sur la VRAIE structure de daily_production:
  - id (UUID)
  - production_date (date)
  - bar_reference (texte)
  - status (production_status_v2)
  - bullion_grams, pure_gold_grams, etc.

  PAS DE: batch_number, production_number
*/

-- Test 1: Verifier que les triggers existent
SELECT
  'Trigger: ' || tgname || ' sur table: ' || c.relname AS trigger_info,
  CASE
    WHEN tgenabled = 'O' THEN 'ACTIF'
    WHEN tgenabled = 'D' THEN 'DESACTIVE'
    ELSE 'INCONNU'
  END AS statut
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
WHERE tgname IN ('production_status_change_trigger', 'shipping_status_change_trigger')
  AND NOT t.tgisinternal
ORDER BY c.relname, tgname;

-- Test 2: Verifier la fonction
SELECT
  'Fonction: ' || proname AS fonction,
  'EXISTE' AS statut
FROM pg_proc
WHERE proname = 'log_unified_status_change';

-- Test 3: Compter les entrees dans unified_status_history
SELECT
  entity_type AS type,
  COUNT(*) AS nombre_entrees,
  COUNT(DISTINCT entity_id) AS nombre_entities,
  MIN(changed_at) AS premiere_entree,
  MAX(changed_at) AS derniere_entree
FROM unified_status_history
GROUP BY entity_type
ORDER BY entity_type;

-- Test 4: Dernieres entrees production
SELECT
  to_char(changed_at, 'DD/MM/YYYY HH24:MI') AS date_heure,
  COALESCE(old_status, 'null') AS ancien,
  new_status AS nouveau,
  action_description AS description
FROM unified_status_history
WHERE entity_type = 'production'
ORDER BY changed_at DESC
LIMIT 5;

-- Test 5: Dernieres entrees shipping
SELECT
  to_char(changed_at, 'DD/MM/YYYY HH24:MI') AS date_heure,
  COALESCE(old_status, 'null') AS ancien,
  new_status AS nouveau,
  action_description AS description
FROM unified_status_history
WHERE entity_type = 'shipping'
ORDER BY changed_at DESC
LIMIT 5;

-- Test 6: Verification statuts specifiques
SELECT
  new_status AS statut,
  COUNT(*) AS occurrences,
  COUNT(DISTINCT entity_id) AS productions_uniques
FROM unified_status_history
WHERE entity_type = 'production'
GROUP BY new_status
ORDER BY new_status;

-- Test 7: Productions ready_for_customs avec historique (VERSION CORRIGEE)
SELECT
  dp.id AS production_id,
  dp.production_date AS date_production,
  COALESCE(dp.bar_reference, 'N/A') AS reference_barre,
  dp.status AS statut_actuel,
  COUNT(ush.id) AS entrees_historique,
  CASE
    WHEN COUNT(ush.id) = 0 THEN 'AUCUN HISTORIQUE'
    WHEN COUNT(ush.id) = 1 THEN 'UN SEUL CHANGEMENT'
    ELSE 'OK'
  END AS diagnostic
FROM daily_production dp
LEFT JOIN unified_status_history ush ON
  ush.entity_type = 'production' AND
  ush.entity_id = dp.id
WHERE dp.status = 'ready_for_customs'
GROUP BY dp.id, dp.production_date, dp.bar_reference, dp.status
ORDER BY COUNT(ush.id), dp.production_date DESC
LIMIT 10;

-- Test 8: Ratio Productions / Historiques
WITH stats AS (
  SELECT
    (SELECT COUNT(*) FROM daily_production) AS total_productions,
    (SELECT COUNT(DISTINCT entity_id) FROM unified_status_history WHERE entity_type = 'production') AS productions_avec_historique,
    (SELECT COUNT(*) FROM unified_status_history WHERE entity_type = 'production') AS total_historiques
)
SELECT
  total_productions AS "Total Productions",
  productions_avec_historique AS "Avec Historique",
  total_historiques AS "Entrees Historique",
  ROUND(100.0 * productions_avec_historique / NULLIF(total_productions, 0), 1) || '%' AS "Couverture",
  CASE
    WHEN productions_avec_historique = total_productions THEN 'PARFAIT'
    WHEN productions_avec_historique * 100 / NULLIF(total_productions, 0) > 80 THEN 'BON'
    ELSE 'INCOMPLET'
  END AS "Diagnostic"
FROM stats;

-- Test 9: Productions SANS historique (VERSION CORRIGEE)
SELECT
  dp.id,
  dp.production_date AS date_production,
  COALESCE(dp.bar_reference, 'N/A') AS reference_barre,
  dp.status AS statut,
  dp.created_at AS cree_le,
  'MANQUANT' AS historique
FROM daily_production dp
LEFT JOIN unified_status_history ush ON
  ush.entity_type = 'production' AND
  ush.entity_id = dp.id
WHERE ush.id IS NULL
ORDER BY dp.created_at DESC
LIMIT 10;

-- Test 10: Structure reelle de daily_production (VERIFICATION)
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'daily_production'
  AND table_schema = 'public'
ORDER BY ordinal_position;
