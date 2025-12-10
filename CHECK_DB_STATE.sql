-- ============================================================================
-- DIAGNOSTIC: Vérification de l'état actuel de la base de données
-- ============================================================================

DO $$
DECLARE
  v_batch_id_exists BOOLEAN;
  v_freight_id_exists BOOLEAN;
  v_constraint_count INTEGER;
  v_index_count INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '╔══════════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║  DIAGNOSTIC: État actuel de inventory_transactions          ║';
  RAISE NOTICE '╚══════════════════════════════════════════════════════════════╝';
  RAISE NOTICE '';

  -- Check if batch_id exists
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'inventory_transactions'
      AND column_name = 'batch_id'
  ) INTO v_batch_id_exists;

  -- Check if freight_shipment_id exists
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'inventory_transactions'
      AND column_name = 'freight_shipment_id'
  ) INTO v_freight_id_exists;

  -- Count constraints on batch_id
  SELECT COUNT(*)
  FROM information_schema.table_constraints tc
  JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name
  WHERE tc.table_schema = 'public'
    AND tc.table_name = 'inventory_transactions'
    AND ccu.column_name = 'batch_id'
  INTO v_constraint_count;

  -- Count indexes on batch_id
  SELECT COUNT(*)
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename = 'inventory_transactions'
    AND indexdef LIKE '%batch_id%'
  INTO v_index_count;

  -- Display results
  RAISE NOTICE '📊 État des colonnes:';
  RAISE NOTICE '';

  IF v_batch_id_exists THEN
    RAISE NOTICE '  ❌ batch_id: EXISTE (PROBLÈME!)';
    RAISE NOTICE '     → Contraintes: %', v_constraint_count;
    RAISE NOTICE '     → Index: %', v_index_count;
  ELSE
    RAISE NOTICE '  ✅ batch_id: N''EXISTE PAS (BON)';
  END IF;

  IF v_freight_id_exists THEN
    RAISE NOTICE '  ✅ freight_shipment_id: EXISTE (BON)';
  ELSE
    RAISE NOTICE '  ❌ freight_shipment_id: N''EXISTE PAS (PROBLÈME!)';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';

  IF v_batch_id_exists THEN
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  CONCLUSION: LA MIGRATION N''A PAS ÉTÉ APPLIQUÉE!';
    RAISE NOTICE '';
    RAISE NOTICE '📋 TOUTES LES COLONNES ACTUELLES:';
    RAISE NOTICE '';

    FOR rec IN (
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'inventory_transactions'
      ORDER BY ordinal_position
    ) LOOP
      RAISE NOTICE '   - % (%, nullable=%)',
        rec.column_name,
        rec.data_type,
        rec.is_nullable;
    END LOOP;
  ELSE
    RAISE NOTICE '';
    RAISE NOTICE '✅ CONCLUSION: Migration appliquée correctement!';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';
  RAISE NOTICE '';

END $$;
