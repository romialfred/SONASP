-- ============================================================================
-- RECHERCHE DE batch_id DANS LES FONCTIONS ET TRIGGERS
-- ============================================================================

DO $$
DECLARE
  r RECORD;
  v_found_count INTEGER := 0;
  v_func_def TEXT;
BEGIN
  RAISE NOTICE '╔══════════════════════════════════════════════════════════════╗';
  RAISE NOTICE '║  Recherche de batch_id dans le code SQL                     ║';
  RAISE NOTICE '╚══════════════════════════════════════════════════════════════╝';
  RAISE NOTICE '';

  -- Search in function definitions
  RAISE NOTICE '🔍 Recherche dans les fonctions...';
  RAISE NOTICE '';

  FOR r IN (
    SELECT
      p.proname as function_name,
      p.oid as func_oid
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
  ) LOOP
    BEGIN
      v_func_def := pg_get_functiondef(r.func_oid);
      IF v_func_def LIKE '%batch_id%' THEN
        v_found_count := v_found_count + 1;
        RAISE NOTICE '  ❌ TROUVÉ dans fonction: %', r.function_name;
        RAISE NOTICE '     %', substring(v_func_def from 1 for 200);
        RAISE NOTICE '';
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Skip functions that cause errors when retrieving definition
      CONTINUE;
    END;
  END LOOP;

  -- Search in trigger definitions
  RAISE NOTICE '🔍 Recherche dans les triggers...';
  RAISE NOTICE '';

  FOR r IN (
    SELECT
      t.tgname as trigger_name,
      c.relname as table_name,
      p.proname as function_name,
      p.oid as func_oid
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    JOIN pg_proc p ON t.tgfoid = p.oid
  ) LOOP
    BEGIN
      v_func_def := pg_get_functiondef(r.func_oid);
      IF v_func_def LIKE '%batch_id%' THEN
        v_found_count := v_found_count + 1;
        RAISE NOTICE '  ❌ TROUVÉ dans trigger: % (table: %, function: %)',
          r.trigger_name, r.table_name, r.function_name;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Skip triggers that cause errors when retrieving definition
      CONTINUE;
    END;
  END LOOP;

  -- Search in views
  RAISE NOTICE '';
  RAISE NOTICE '🔍 Recherche dans les vues...';
  RAISE NOTICE '';

  FOR r IN (
    SELECT
      schemaname,
      viewname,
      definition
    FROM pg_views
    WHERE schemaname = 'public'
      AND definition LIKE '%batch_id%'
  ) LOOP
    v_found_count := v_found_count + 1;
    RAISE NOTICE '  ❌ TROUVÉ dans vue: %', r.viewname;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';

  IF v_found_count = 0 THEN
    RAISE NOTICE '';
    RAISE NOTICE '  ✅ Aucune référence à batch_id trouvée dans le code SQL!';
  ELSE
    RAISE NOTICE '';
    RAISE NOTICE '  ❌ % référence(s) à batch_id trouvée(s)!', v_found_count;
    RAISE NOTICE '     Ces fonctions/triggers/vues doivent être corrigées!';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════════';

END $$;
