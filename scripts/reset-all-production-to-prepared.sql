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
  - Compatible avec l'interface SQL de Supabase (utilise RAISE NOTICE)

  ## Utilisation:
  Exécutez ce script dans l'éditeur SQL de Supabase.
  Regardez les messages dans la console/logs pour voir la progression.
*/

-- =====================================================
-- SCRIPT DE RÉINITIALISATION DES STATUTS
-- =====================================================

DO $$
DECLARE
  v_count_before INTEGER;
  v_count_to_update INTEGER;
  v_updated INTEGER := 0;
  v_history_count INTEGER;
  rec RECORD;
BEGIN
  -- =====================================================
  -- 1. AFFICHER RÉSUMÉ AVANT MODIFICATION
  -- =====================================================
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RÉSUMÉ AVANT MODIFICATION';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';

  -- Compter le total
  SELECT COUNT(*) INTO v_count_before
  FROM daily_production
  WHERE status IS NOT NULL;

  RAISE NOTICE 'Total productions: %', v_count_before;
  RAISE NOTICE '';
  RAISE NOTICE 'Répartition par statut:';

  -- Afficher la répartition
  FOR rec IN
    SELECT
      status,
      COUNT(*) as count
    FROM daily_production
    WHERE status IS NOT NULL
    GROUP BY status
    ORDER BY COUNT(*) DESC
  LOOP
    RAISE NOTICE '  % : % production(s)', RPAD(rec.status::text, 25), rec.count;
  END LOOP;

  -- =====================================================
  -- 2. COMPTER LES PRODUCTIONS À MODIFIER
  -- =====================================================
  SELECT COUNT(*) INTO v_count_to_update
  FROM daily_production
  WHERE status IS NOT NULL
    AND status::text != 'prepared';

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'PRODUCTIONS À MODIFIER: %', v_count_to_update;
  RAISE NOTICE '========================================';

  IF v_count_to_update = 0 THEN
    RAISE NOTICE '';
    RAISE NOTICE 'Toutes les productions ont déjà le statut "prepared"';
    RAISE NOTICE 'Rien à faire!';
    RETURN;
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE 'Exemples de productions qui seront modifiées (5 premiers):';
  RAISE NOTICE '';

  FOR rec IN
    SELECT
      bar_reference,
      status,
      to_char(production_date, 'DD/MM/YYYY') as prod_date
    FROM daily_production
    WHERE status IS NOT NULL
      AND status::text != 'prepared'
    ORDER BY production_date DESC
    LIMIT 5
  LOOP
    RAISE NOTICE '  % | % -> prepared | Date: %',
      RPAD(COALESCE(rec.bar_reference, 'N/A'), 20),
      RPAD(rec.status::text, 20),
      rec.prod_date;
  END LOOP;

  -- =====================================================
  -- 3. METTRE À JOUR TOUS LES STATUTS À "prepared"
  -- =====================================================
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'MISE À JOUR EN COURS...';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';

  -- Important: Cette requête déclenchera le trigger qui créera les entrées dans unified_status_history
  UPDATE daily_production
  SET
    status = 'prepared',
    updated_at = NOW()
  WHERE status IS NOT NULL
    AND status::text != 'prepared';

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RAISE NOTICE '% production(s) mise(s) à jour avec succès!', v_updated;

  -- Petit délai pour laisser le trigger s'exécuter
  PERFORM pg_sleep(0.5);

  -- =====================================================
  -- 4. VÉRIFIER L'HISTORIQUE
  -- =====================================================
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'VÉRIFICATION HISTORIQUE';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';

  SELECT COUNT(*) INTO v_history_count
  FROM unified_status_history
  WHERE entity_type = 'production'
    AND new_status = 'prepared'
    AND changed_at >= NOW() - INTERVAL '2 minutes';

  RAISE NOTICE '% entrée(s) créée(s) dans unified_status_history', v_history_count;
  RAISE NOTICE '';

  IF v_history_count > 0 THEN
    RAISE NOTICE 'Dernières entrées créées (5 premiers):';
    RAISE NOTICE '';

    FOR rec IN
      SELECT
        old_status,
        new_status,
        to_char(changed_at, 'DD/MM HH24:MI:SS') as change_time
      FROM unified_status_history
      WHERE entity_type = 'production'
        AND new_status = 'prepared'
        AND changed_at >= NOW() - INTERVAL '2 minutes'
      ORDER BY changed_at DESC
      LIMIT 5
    LOOP
      RAISE NOTICE '  % -> % | %',
        RPAD(COALESCE(rec.old_status, 'null'), 20),
        RPAD(rec.new_status, 15),
        rec.change_time;
    END LOOP;
  ELSE
    RAISE WARNING 'Aucune entrée trouvée dans unified_status_history!';
    RAISE WARNING 'Le trigger pourrait ne pas fonctionner correctement.';
  END IF;

  -- =====================================================
  -- 5. RÉSUMÉ FINAL
  -- =====================================================
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RÉSUMÉ APRÈS MODIFICATION';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';

  RAISE NOTICE 'Répartition par statut:';

  FOR rec IN
    SELECT
      status,
      COUNT(*) as count
    FROM daily_production
    WHERE status IS NOT NULL
    GROUP BY status
    ORDER BY COUNT(*) DESC
  LOOP
    RAISE NOTICE '  % : % production(s)', RPAD(rec.status::text, 25), rec.count;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'SCRIPT TERMINÉ AVEC SUCCÈS';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Points importants:';
  RAISE NOTICE '  - % production(s) mise(s) à jour', v_updated;
  RAISE NOTICE '  - Tous les statuts changés à "prepared"';
  RAISE NOTICE '  - % entrée(s) dans unified_status_history', v_history_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Pour vérifier ultérieurement:';
  RAISE NOTICE '  SELECT * FROM unified_status_history';
  RAISE NOTICE '  WHERE entity_type = ''production''';
  RAISE NOTICE '  ORDER BY changed_at DESC LIMIT 20;';
  RAISE NOTICE '';

END $$;
