-- =====================================================
-- PEUPLER unified_status_history avec les productions existantes
-- =====================================================
-- Ce script crée une entrée d'historique pour chaque production existante

DO $$
DECLARE
  v_production_count INTEGER;
  v_inserted INTEGER := 0;
  rec RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'PEUPLEMENT unified_status_history';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';

  -- Compter les productions
  SELECT COUNT(*) INTO v_production_count
  FROM daily_production
  WHERE status IS NOT NULL;

  RAISE NOTICE 'Productions trouvées: %', v_production_count;

  IF v_production_count = 0 THEN
    RAISE NOTICE 'Aucune production à traiter.';
    RETURN;
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE 'Création des entrées d''historique...';
  RAISE NOTICE '';

  -- Insérer une entrée d'historique pour chaque production
  -- On crée une entrée avec old_status = NULL (création initiale)
  INSERT INTO unified_status_history (
    entity_type,
    entity_id,
    old_status,
    new_status,
    change_context,
    changed_by,
    changed_at,
    action_description,
    notes
  )
  SELECT
    'production' as entity_type,
    id as entity_id,
    NULL as old_status,
    status::text as new_status,
    'production_management' as change_context,
    created_by as changed_by,
    created_at as changed_at,
    'Création initiale (importé depuis données existantes)' as action_description,
    'Entrée créée automatiquement pour historique' as notes
  FROM daily_production
  WHERE status IS NOT NULL
    AND id NOT IN (
      -- Ne pas recréer si l'entrée existe déjà
      SELECT entity_id
      FROM unified_status_history
      WHERE entity_type = 'production'
    );

  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RÉSULTAT';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '% entrée(s) créée(s) dans unified_status_history', v_inserted;
  RAISE NOTICE '';

  -- Afficher quelques exemples
  IF v_inserted > 0 THEN
    RAISE NOTICE 'Exemples d''entrées créées (5 premiers):';
    RAISE NOTICE '';

    FOR rec IN
      SELECT
        ush.entity_id,
        ush.new_status,
        to_char(ush.changed_at, 'DD/MM/YYYY HH24:MI') as created,
        dp.bar_reference
      FROM unified_status_history ush
      JOIN daily_production dp ON dp.id = ush.entity_id
      WHERE ush.entity_type = 'production'
        AND ush.old_status IS NULL
      ORDER BY ush.changed_at DESC
      LIMIT 5
    LOOP
      RAISE NOTICE '  % | Status: % | Créé: %',
        RPAD(COALESCE(rec.bar_reference, 'N/A'), 20),
        RPAD(rec.new_status, 15),
        rec.created;
    END LOOP;
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'VÉRIFICATION FINALE';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';

  -- Vérifier le total
  SELECT COUNT(*) INTO v_inserted
  FROM unified_status_history
  WHERE entity_type = 'production';

  RAISE NOTICE 'Total entrées production dans unified_status_history: %', v_inserted;
  RAISE NOTICE '';
  RAISE NOTICE 'TERMINÉ AVEC SUCCÈS!';
  RAISE NOTICE '';
  RAISE NOTICE 'L''historique devrait maintenant s''afficher dans l''interface.';
  RAISE NOTICE '';

END $$;
