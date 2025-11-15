-- =====================================================
-- DIAGNOSTIC: Vérification unified_status_history
-- =====================================================

DO $$
DECLARE
  v_table_exists BOOLEAN;
  v_trigger_exists BOOLEAN;
  v_production_count INTEGER;
  v_history_count INTEGER;
  rec RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'DIAGNOSTIC UNIFIED_STATUS_HISTORY';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';

  -- 1. Vérifier si la table existe
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_name = 'unified_status_history'
  ) INTO v_table_exists;

  RAISE NOTICE '1. Table unified_status_history existe: %', v_table_exists;

  IF NOT v_table_exists THEN
    RAISE WARNING 'La table unified_status_history n''existe pas!';
    RAISE WARNING 'Il faut appliquer la migration unified_status_system_fixed.sql';
    RETURN;
  END IF;

  -- 2. Compter les entrées dans unified_status_history
  SELECT COUNT(*) INTO v_history_count
  FROM unified_status_history;

  RAISE NOTICE '2. Nombre d''entrées dans unified_status_history: %', v_history_count;

  -- 3. Vérifier le trigger sur daily_production
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.triggers
    WHERE trigger_name = 'unified_status_change_trigger'
      AND event_object_table = 'daily_production'
  ) INTO v_trigger_exists;

  RAISE NOTICE '3. Trigger sur daily_production existe: %', v_trigger_exists;

  IF NOT v_trigger_exists THEN
    RAISE WARNING 'Le trigger unified_status_change_trigger n''existe pas sur daily_production!';
    RAISE WARNING 'Il faut appliquer la migration unified_status_system_fixed.sql';
  END IF;

  -- 4. Compter les productions
  SELECT COUNT(*) INTO v_production_count
  FROM daily_production
  WHERE status IS NOT NULL;

  RAISE NOTICE '4. Nombre de productions avec statut: %', v_production_count;

  -- 5. Afficher quelques productions
  RAISE NOTICE '';
  RAISE NOTICE 'Exemples de productions (5 premiers):';
  FOR rec IN
    SELECT
      id,
      bar_reference,
      status,
      to_char(production_date, 'DD/MM/YYYY') as prod_date,
      to_char(created_at, 'DD/MM/YYYY HH24:MI') as created
    FROM daily_production
    WHERE status IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 5
  LOOP
    RAISE NOTICE '  % | Status: % | Date: % | Créé: %',
      RPAD(COALESCE(rec.bar_reference, 'N/A'), 20),
      RPAD(rec.status::text, 15),
      rec.prod_date,
      rec.created;
  END LOOP;

  -- 6. Vérifier si unified_status_history a des données
  IF v_history_count = 0 THEN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'PROBLÈME IDENTIFIÉ';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'La table unified_status_history est VIDE!';
    RAISE NOTICE '';
    RAISE NOTICE 'Causes possibles:';
    RAISE NOTICE '  1. Le trigger n''a jamais été déclenché';
    RAISE NOTICE '  2. Les productions ont été créées AVANT l''installation du trigger';
    RAISE NOTICE '  3. Le trigger ne fonctionne pas correctement';
    RAISE NOTICE '';
    RAISE NOTICE 'SOLUTION:';
    RAISE NOTICE '  Exécuter le script: populate-unified-history.sql';
    RAISE NOTICE '  Cela créera les entrées d''historique pour toutes les productions existantes';
  ELSE
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'HISTORIQUE TROUVÉ';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Dernières entrées (5 premiers):';
    FOR rec IN
      SELECT
        entity_type,
        old_status,
        new_status,
        to_char(changed_at, 'DD/MM HH24:MI:SS') as changed
      FROM unified_status_history
      ORDER BY changed_at DESC
      LIMIT 5
    LOOP
      RAISE NOTICE '  % | % -> % | %',
        RPAD(rec.entity_type, 20),
        RPAD(COALESCE(rec.old_status, 'null'), 15),
        RPAD(rec.new_status, 15),
        rec.changed;
    END LOOP;
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'FIN DU DIAGNOSTIC';
  RAISE NOTICE '========================================';

END $$;
