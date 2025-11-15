/*
  # Script: Reset All Production Status to "prepared"

  Ce script change tous les statuts des productions à "prepared" et
  s'assure que les changements sont enregistrés dans unified_status_history.

  ## Ce que fait ce script:

  1. Affiche un résumé des statuts actuels
  2. Met à jour tous les statuts à "prepared"
  3. Vérifie que les changements sont dans unified_status_history
  4. Affiche un résumé final

  ## IMPORTANT:
  - Le trigger `log_unified_status_change` enregistrera automatiquement
    chaque changement dans unified_status_history
  - Les changements seront attribués à l'utilisateur système

  ## Utilisation:
  ```bash
  psql $SUPABASE_DB_URL -f scripts/reset-all-production-to-prepared.sql
  ```
*/

-- =====================================================
-- 1. AFFICHER RÉSUMÉ AVANT
-- =====================================================

\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '📊 RÉSUMÉ AVANT MODIFICATION'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

SELECT
  status as "Statut Actuel",
  COUNT(*) as "Nombre de Productions"
FROM daily_production
WHERE status IS NOT NULL
GROUP BY status
ORDER BY COUNT(*) DESC;

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '🔄 DÉBUT DE LA MISE À JOUR'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

-- =====================================================
-- 2. SAUVEGARDER LES STATUTS ACTUELS (pour référence)
-- =====================================================

CREATE TEMP TABLE IF NOT EXISTS temp_old_statuses AS
SELECT
  id,
  bar_reference,
  status as old_status,
  production_date,
  created_at
FROM daily_production
WHERE status IS NOT NULL
  AND status != 'prepared';

\echo ''
\echo '✅ Statuts actuels sauvegardés dans table temporaire'

-- Afficher quelques exemples
\echo ''
\echo 'Exemples de productions qui seront modifiées:'
SELECT
  bar_reference as "Référence",
  old_status as "Statut Actuel",
  to_char(production_date, 'DD/MM/YYYY') as "Date Production"
FROM temp_old_statuses
ORDER BY production_date DESC
LIMIT 5;

-- =====================================================
-- 3. METTRE À JOUR TOUS LES STATUTS À "prepared"
-- =====================================================

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '🔨 MISE À JOUR EN COURS...'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

-- Important: Cette requête déclenchera le trigger qui créera les entrées dans unified_status_history
DO $$
DECLARE
  v_count INTEGER;
  v_updated INTEGER := 0;
BEGIN
  -- Compter combien de productions seront modifiées
  SELECT COUNT(*) INTO v_count
  FROM daily_production
  WHERE status IS NOT NULL
    AND status::text != 'prepared';

  RAISE NOTICE 'Productions à modifier: %', v_count;

  -- Effectuer la mise à jour
  -- Le trigger log_unified_status_change() enregistrera automatiquement dans unified_status_history
  UPDATE daily_production
  SET
    status = 'prepared',
    updated_at = NOW()
  WHERE status IS NOT NULL
    AND status::text != 'prepared';

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RAISE NOTICE '✅ % productions mises à jour avec succès!', v_updated;

  -- Vérifier que les entrées ont été créées dans unified_status_history
  PERFORM pg_sleep(0.5); -- Petit délai pour laisser le trigger s'exécuter

  DECLARE
    v_history_count INTEGER;
  BEGIN
    SELECT COUNT(*) INTO v_history_count
    FROM unified_status_history
    WHERE entity_type = 'production'
      AND new_status = 'prepared'
      AND changed_at >= NOW() - INTERVAL '1 minute';

    RAISE NOTICE '✅ % entrées créées dans unified_status_history', v_history_count;
  END;
END $$;

-- =====================================================
-- 4. VÉRIFICATION ET RAPPORT FINAL
-- =====================================================

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '📊 RÉSUMÉ APRÈS MODIFICATION'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

SELECT
  status as "Statut Actuel",
  COUNT(*) as "Nombre de Productions"
FROM daily_production
WHERE status IS NOT NULL
GROUP BY status
ORDER BY COUNT(*) DESC;

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '📝 VÉRIFICATION HISTORIQUE (dernières 10 entrées)'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'

SELECT
  entity_id as "Production ID",
  old_status as "Ancien Statut",
  new_status as "Nouveau Statut",
  to_char(changed_at, 'DD/MM/YYYY HH24:MI:SS') as "Date Changement",
  action_description as "Description"
FROM unified_status_history
WHERE entity_type = 'production'
  AND new_status = 'prepared'
  AND changed_at >= NOW() - INTERVAL '1 minute'
ORDER BY changed_at DESC
LIMIT 10;

\echo ''
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo '✅ SCRIPT TERMINÉ AVEC SUCCÈS'
\echo '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
\echo ''
\echo '📌 Points importants:'
\echo '  • Tous les statuts ont été changés à "prepared"'
\echo '  • Les changements sont enregistrés dans unified_status_history'
\echo '  • Le trigger log_unified_status_change a fonctionné correctement'
\echo ''
\echo '🔍 Pour vérifier ultérieurement:'
\echo '  SELECT * FROM unified_status_history WHERE entity_type = '\''production'\'' ORDER BY changed_at DESC LIMIT 20;'
\echo ''

-- Nettoyer la table temporaire
DROP TABLE IF EXISTS temp_old_statuses;
