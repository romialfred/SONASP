-- =====================================================
-- DIAGNOSTIC: Erreur de Suppression Shipping
-- =====================================================
-- Erreur: function release_license_quota(uuid, uuid, numeric, uuid) does not exist
-- HINT: No function matches the given name and argument types

DO $$
DECLARE
  rec RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'DIAGNOSTIC ERREUR SUPPRESSION SHIPPING';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';

  -- 1. Vérifier les triggers sur shipping_preparations
  RAISE NOTICE '1. TRIGGERS sur shipping_preparations:';
  RAISE NOTICE '';

  FOR rec IN
    SELECT
      trigger_name,
      event_manipulation,
      action_statement
    FROM information_schema.triggers
    WHERE event_object_table = 'shipping_preparations'
    ORDER BY trigger_name
  LOOP
    RAISE NOTICE '  Trigger: %', rec.trigger_name;
    RAISE NOTICE '    Event: %', rec.event_manipulation;
    RAISE NOTICE '    Action: %', rec.action_statement;
    RAISE NOTICE '';
  END LOOP;

  -- 2. Vérifier la fonction release_license_quota
  RAISE NOTICE '2. FONCTION release_license_quota:';
  RAISE NOTICE '';

  FOR rec IN
    SELECT
      p.proname as function_name,
      pg_get_function_arguments(p.oid) as arguments,
      pg_get_function_result(p.oid) as return_type
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'release_license_quota'
      AND n.nspname = 'public'
  LOOP
    RAISE NOTICE '  Fonction: %(%)  RETURNS %',
      rec.function_name,
      rec.arguments,
      rec.return_type;
  END LOOP;

  -- 3. Vérifier s'il y a un trigger qui appelle release_license_quota
  RAISE NOTICE '';
  RAISE NOTICE '3. RECHERCHE trigger_release_shipping_quota:';
  RAISE NOTICE '';

  SELECT COUNT(*) INTO rec
  FROM information_schema.triggers
  WHERE trigger_name = 'trigger_release_shipping_quota';

  IF rec > 0 THEN
    RAISE NOTICE '  ✅ Trigger trouvé';

    FOR rec IN
      SELECT
        trigger_name,
        event_object_table,
        event_manipulation,
        action_statement
      FROM information_schema.triggers
      WHERE trigger_name = 'trigger_release_shipping_quota'
    LOOP
      RAISE NOTICE '    Table: %', rec.event_object_table;
      RAISE NOTICE '    Event: %', rec.event_manipulation;
      RAISE NOTICE '    Action: %', rec.action_statement;
    END LOOP;
  ELSE
    RAISE NOTICE '  ❌ Trigger NON TROUVÉ';
  END IF;

  -- 4. Vérifier les shipping_preparations problématiques
  RAISE NOTICE '';
  RAISE NOTICE '4. SHIPPING_PREPARATIONS avec productions "prepared":';
  RAISE NOTICE '';

  FOR rec IN
    SELECT
      sp.id,
      sp.expedition_lot_number,
      sp.status as shipping_status,
      COUNT(DISTINCT spi.production_id) as nb_productions,
      STRING_AGG(DISTINCT dp.status::text, ', ') as production_statuses
    FROM shipping_preparations sp
    LEFT JOIN shipping_production_items spi ON spi.shipping_preparation_id = sp.id
    LEFT JOIN daily_production dp ON dp.id = spi.production_id
    GROUP BY sp.id, sp.expedition_lot_number, sp.status
    HAVING STRING_AGG(DISTINCT dp.status::text, ', ') LIKE '%prepared%'
  LOOP
    RAISE NOTICE '  Shipping: % (Status: %)',
      rec.expedition_lot_number,
      rec.shipping_status;
    RAISE NOTICE '    Productions: % (Statuts: %)',
      rec.nb_productions,
      rec.production_statuses;
  END LOOP;

  -- 5. Vérifier la structure de la table export_licenses
  RAISE NOTICE '';
  RAISE NOTICE '5. COLONNES de export_licenses:';
  RAISE NOTICE '';

  FOR rec IN
    SELECT
      column_name,
      data_type,
      is_nullable
    FROM information_schema.columns
    WHERE table_name = 'export_licenses'
      AND column_name IN ('id', 'used_quantity_grams', 'remaining_quantity_grams')
    ORDER BY ordinal_position
  LOOP
    RAISE NOTICE '  % : % %',
      RPAD(rec.column_name, 30),
      RPAD(rec.data_type, 15),
      CASE WHEN rec.is_nullable = 'NO' THEN 'NOT NULL' ELSE 'NULL' END;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'FIN DU DIAGNOSTIC';
  RAISE NOTICE '========================================';

END $$;
