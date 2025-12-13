-- ================================================================
-- VÉRIFICATION: Colonne status et trigger sur table sales
-- ================================================================

DO $$
DECLARE
  v_column_exists BOOLEAN;
  v_trigger_exists BOOLEAN;
  v_column_type TEXT;
  v_column_default TEXT;
  v_total_sales INT;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'DIAGNOSTIC TABLE SALES';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';

  -- 1. Vérifier si la colonne status existe
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'sales'
    AND column_name = 'status'
  ) INTO v_column_exists;

  IF v_column_exists THEN
    -- Récupérer les détails de la colonne
    SELECT udt_name, column_default
    INTO v_column_type, v_column_default
    FROM information_schema.columns
    WHERE table_name = 'sales'
    AND column_name = 'status';

    RAISE NOTICE '1. COLONNE STATUS:';
    RAISE NOTICE '   Existe: OUI';
    RAISE NOTICE '   Type: %', v_column_type;
    RAISE NOTICE '   Default: %', v_column_default;
  ELSE
    RAISE NOTICE '1. COLONNE STATUS:';
    RAISE NOTICE '   Existe: NON - DOIT ETRE AJOUTEE';
  END IF;

  RAISE NOTICE '';

  -- 2. Vérifier si le trigger existe
  SELECT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE c.relname = 'sales'
    AND t.tgname LIKE '%status%'
    AND NOT t.tgisinternal
  ) INTO v_trigger_exists;

  IF v_trigger_exists THEN
    RAISE NOTICE '2. TRIGGER STATUS:';
    RAISE NOTICE '   Existe: OUI';

    -- Lister les triggers
    FOR rec IN (
      SELECT t.tgname as trigger_name, p.proname as function_name
      FROM pg_trigger t
      JOIN pg_class c ON t.tgrelid = c.oid
      JOIN pg_proc p ON t.tgfoid = p.oid
      WHERE c.relname = 'sales'
      AND t.tgname LIKE '%status%'
      AND NOT t.tgisinternal
    ) LOOP
      RAISE NOTICE '   - %: function %', rec.trigger_name, rec.function_name;
    END LOOP;
  ELSE
    RAISE NOTICE '2. TRIGGER STATUS:';
    RAISE NOTICE '   Existe: NON - DOIT ETRE CREE';
  END IF;

  RAISE NOTICE '';

  -- 3. Compter les ventes
  SELECT COUNT(*) INTO v_total_sales FROM sales;
  RAISE NOTICE '3. DONNEES:';
  RAISE NOTICE '   Total ventes: %', v_total_sales;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'CONCLUSION:';
  RAISE NOTICE '========================================';

  IF NOT v_column_exists THEN
    RAISE NOTICE 'ACTION REQUISE: Executer ADD_STATUS_TO_SALES.sql';
  ELSIF NOT v_trigger_exists THEN
    RAISE NOTICE 'ACTION REQUISE: Creer le trigger uniquement';
  ELSE
    RAISE NOTICE 'CONFIGURATION COMPLETE - Pas d''action requise';
    RAISE NOTICE '';
    RAISE NOTICE 'Si vous avez toujours l''erreur:';
    RAISE NOTICE '  - Verifier les triggers problematiques';
    RAISE NOTICE '  - Executer FIX_ALL_SALES_TRIGGERS.sql';
  END IF;

  RAISE NOTICE '========================================';
END $$;
