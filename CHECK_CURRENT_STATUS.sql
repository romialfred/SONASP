DO $$
DECLARE
  v_tables TEXT[];
  v_triggers TEXT[];
  v_functions TEXT[];
  v_policies TEXT[];
  v_view_exists BOOLEAN;
  t TEXT;
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '🔍 CURRENT DATABASE STATUS';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  
  -- Check tables
  SELECT ARRAY_AGG(table_name::TEXT ORDER BY table_name)
  INTO v_tables
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN (
      'licenses',
      'license_requests',
      'license_request_documents',
      'license_quota_transactions',
      'license_events',
      'license_kpi_thresholds'
    );
  
  RAISE NOTICE '📋 TABLES:';
  IF v_tables IS NOT NULL THEN
    FOREACH t IN ARRAY v_tables LOOP
      RAISE NOTICE '  ✓ %', t;
    END LOOP;
    RAISE NOTICE '  Total: %/6 tables exist', array_length(v_tables, 1);
  ELSE
    RAISE NOTICE '  ❌ NO license tables exist!';
  END IF;
  RAISE NOTICE '';
  
  -- Check view
  SELECT EXISTS (
    SELECT 1
    FROM pg_views
    WHERE schemaname = 'public'
      AND viewname = 'licenses_with_computed_fields'
  )
  INTO v_view_exists;
  
  RAISE NOTICE '👁️  VIEW:';
  IF v_view_exists THEN
    RAISE NOTICE '  ✓ licenses_with_computed_fields EXISTS';
  ELSE
    RAISE NOTICE '  ❌ licenses_with_computed_fields DOES NOT EXIST';
  END IF;
  RAISE NOTICE '';
  
  -- Check triggers (DISTINCT + ORDER BY must match select list)
  SELECT ARRAY(
    SELECT DISTINCT t.tgname::TEXT
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE c.relname IN (
      'licenses',
      'license_requests',
      'license_request_documents',
      'license_quota_transactions',
      'license_events',
      'license_kpi_thresholds'
    )
      AND t.tgname NOT LIKE 'RI_%'
    ORDER BY 1
  )
  INTO v_triggers;
  
  RAISE NOTICE '⚡ TRIGGERS:';
  IF v_triggers IS NOT NULL THEN
    FOREACH t IN ARRAY v_triggers LOOP
      RAISE NOTICE '  ✓ %', t;
    END LOOP;
    RAISE NOTICE '  Total: % triggers', array_length(v_triggers, 1);
  ELSE
    RAISE NOTICE '  ❌ No triggers exist';
  END IF;
  RAISE NOTICE '';
  
  -- Check functions (DISTINCT + ORDER BY must match select list)
  SELECT ARRAY(
    SELECT DISTINCT p.proname::TEXT
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND (p.proname LIKE '%license%' OR p.proname LIKE '%quota%')
    ORDER BY 1
  )
  INTO v_functions;
  
  RAISE NOTICE '⚙️  FUNCTIONS:';
  IF v_functions IS NOT NULL THEN
    FOREACH t IN ARRAY v_functions LOOP
      RAISE NOTICE '  ✓ %()', t;
    END LOOP;
    RAISE NOTICE '  Total: % functions', array_length(v_functions, 1);
  ELSE
    RAISE NOTICE '  ❌ No functions exist';
  END IF;
  RAISE NOTICE '';
  
  -- Check policies (DISTINCT + ORDER BY must match select list)
  SELECT ARRAY(
    SELECT DISTINCT (tablename || '.' || policyname)
    FROM pg_policies
    WHERE tablename IN (
      'licenses',
      'license_requests',
      'license_request_documents',
      'license_quota_transactions',
      'license_events',
      'license_kpi_thresholds'
    )
    ORDER BY 1
  )
  INTO v_policies;
  
  RAISE NOTICE '🔒 POLICIES:';
  IF v_policies IS NOT NULL THEN
    FOREACH t IN ARRAY v_policies LOOP
      RAISE NOTICE '  ✓ %', t;
    END LOOP;
    RAISE NOTICE '  Total: % policies', array_length(v_policies, 1);
  ELSE
    RAISE NOTICE '  ❌ No policies exist';
  END IF;
  RAISE NOTICE '';
  
  -- Decision
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '📊 SUMMARY & NEXT STEPS';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  
  IF v_tables IS NULL THEN
    RAISE NOTICE '🔴 STATE: Tables do not exist';
    RAISE NOTICE '';
    RAISE NOTICE '✅ ACTION: Apply migration 19 directly';
    RAISE NOTICE '   File: 20251108000000_create_export_license_system.sql';
    RAISE NOTICE '   This will create everything from scratch.';
    RAISE NOTICE '';
    
  ELSIF array_length(v_tables, 1) < 6 THEN
    RAISE NOTICE '🟡 STATE: Partial tables exist';
    RAISE NOTICE '   Tables: %/6', array_length(v_tables, 1);
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  ACTION: Database is in inconsistent state!';
    RAISE NOTICE '   1. Run COMPLETE_LICENSE_CLEANUP.sql';
    RAISE NOTICE '   2. Then apply migration 19';
    RAISE NOTICE '';
    
  ELSIF NOT v_view_exists THEN
    RAISE NOTICE '🟡 STATE: Tables exist but view missing';
    RAISE NOTICE '   Tables: 6/6 ✓';
    RAISE NOTICE '   View: Missing ❌';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  ACTION: Migration 19 partially applied!';
    RAISE NOTICE '';
    IF v_triggers IS NOT NULL OR v_functions IS NOT NULL OR v_policies IS NOT NULL THEN
      RAISE NOTICE '   Some objects exist. Clean first:';
      RAISE NOTICE '   1. Run COMPLETE_LICENSE_CLEANUP.sql';
      RAISE NOTICE '   2. Then apply migration 19 again';
    ELSE
      RAISE NOTICE '   No conflicts. Apply migration 19 directly.';
    END IF;
    RAISE NOTICE '';
    
  ELSE
    RAISE NOTICE '🟢 STATE: Everything exists!';
    RAISE NOTICE '   Tables: 6/6 ✓';
    RAISE NOTICE '   View: ✓';
    RAISE NOTICE '   Triggers: % ✓', COALESCE(array_length(v_triggers, 1), 0);
    RAISE NOTICE '   Functions: % ✓', COALESCE(array_length(v_functions, 1), 0);
    RAISE NOTICE '   Policies: % ✓', COALESCE(array_length(v_policies, 1), 0);
    RAISE NOTICE '';
    RAISE NOTICE '✅ ACTION: Apply migration 20 (sample data)';
    RAISE NOTICE '   File: 20251108100000_seed_license_sample_data.sql';
    RAISE NOTICE '';
  END IF;
  
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
END $$ LANGUAGE plpgsql;
