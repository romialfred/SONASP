/*
  ═══════════════════════════════════════════════════════════════════════════
  💪 FORCE DROP ALL LICENSE OBJECTS
  ═══════════════════════════════════════════════════════════════════════════
  
  This will FORCE remove everything related to licenses.
  SAFE - Preserves tables and data, only drops triggers/functions/views/policies
  
  RUN THIS, THEN RUN MIGRATION 19 AGAIN
*/

-- ═══════════════════════════════════════════════════════════════════════════
-- FORCE DROP TRIGGERS (even if they seem to exist)
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  r RECORD;
BEGIN
  RAISE NOTICE '🔨 Force dropping ALL triggers on license tables...';
  
  -- Drop all triggers on license_requests
  FOR r IN (
    SELECT tgname
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE c.relname = 'license_requests'
    AND tgname NOT LIKE 'RI_%'  -- Don't drop foreign key triggers
  ) LOOP
    BEGIN
      EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.tgname) || ' ON license_requests CASCADE';
      RAISE NOTICE '  ✓ Dropped trigger: %', r.tgname;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '  ✗ Could not drop: % (error: %)', r.tgname, SQLERRM;
    END;
  END LOOP;
  
  -- Drop all triggers on licenses
  FOR r IN (
    SELECT tgname
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE c.relname = 'licenses'
    AND tgname NOT LIKE 'RI_%'
  ) LOOP
    BEGIN
      EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.tgname) || ' ON licenses CASCADE';
      RAISE NOTICE '  ✓ Dropped trigger: %', r.tgname;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '  ✗ Could not drop: %', r.tgname;
    END;
  END LOOP;
  
  -- Drop all triggers on license_quota_transactions
  FOR r IN (
    SELECT tgname
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE c.relname = 'license_quota_transactions'
    AND tgname NOT LIKE 'RI_%'
  ) LOOP
    BEGIN
      EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.tgname) || ' ON license_quota_transactions CASCADE';
      RAISE NOTICE '  ✓ Dropped trigger: %', r.tgname;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '  ✗ Could not drop: %', r.tgname;
    END;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ All triggers dropped!';
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- FORCE DROP FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  r RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🔨 Force dropping ALL license functions...';
  
  FOR r IN (
    SELECT proname, oidvectortypes(proargtypes) as args
    FROM pg_proc
    WHERE proname LIKE '%license%'
    OR proname LIKE '%quota%'
  ) LOOP
    BEGIN
      EXECUTE 'DROP FUNCTION IF EXISTS ' || quote_ident(r.proname) || '(' || r.args || ') CASCADE';
      RAISE NOTICE '  ✓ Dropped function: %()', r.proname;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '  ✗ Could not drop: %() - %', r.proname, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ All functions dropped!';
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- FORCE DROP VIEW
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🔨 Dropping view...';
  
  DROP VIEW IF EXISTS licenses_with_computed_fields CASCADE;
  
  RAISE NOTICE '  ✓ View dropped!';
  RAISE NOTICE '';
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- FORCE DROP ALL POLICIES
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  r RECORD;
BEGIN
  RAISE NOTICE '🔨 Dropping ALL policies on license tables...';
  
  -- Drop policies on licenses
  FOR r IN (
    SELECT policyname
    FROM pg_policies
    WHERE tablename = 'licenses'
  ) LOOP
    BEGIN
      EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON licenses';
      RAISE NOTICE '  ✓ Dropped policy: % on licenses', r.policyname;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '  ✗ Could not drop: %', r.policyname;
    END;
  END LOOP;
  
  -- Drop policies on license_requests
  FOR r IN (
    SELECT policyname
    FROM pg_policies
    WHERE tablename = 'license_requests'
  ) LOOP
    BEGIN
      EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON license_requests';
      RAISE NOTICE '  ✓ Dropped policy: % on license_requests', r.policyname;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '  ✗ Could not drop: %', r.policyname;
    END;
  END LOOP;
  
  -- Drop policies on license_quota_transactions
  FOR r IN (
    SELECT policyname
    FROM pg_policies
    WHERE tablename = 'license_quota_transactions'
  ) LOOP
    BEGIN
      EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON license_quota_transactions';
      RAISE NOTICE '  ✓ Dropped policy: %', r.policyname;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
  
  -- Drop policies on license_events
  FOR r IN (
    SELECT policyname
    FROM pg_policies
    WHERE tablename = 'license_events'
  ) LOOP
    BEGIN
      EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON license_events';
      RAISE NOTICE '  ✓ Dropped policy: %', r.policyname;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
  
  -- Drop policies on license_kpi_thresholds
  FOR r IN (
    SELECT policyname
    FROM pg_policies
    WHERE tablename = 'license_kpi_thresholds'
  ) LOOP
    BEGIN
      EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON license_kpi_thresholds';
      RAISE NOTICE '  ✓ Dropped policy: %', r.policyname;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ All policies dropped!';
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICATION
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_triggers INT;
  v_functions INT;
  v_view INT;
  v_policies INT;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ VERIFICATION';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  
  -- Count remaining triggers
  SELECT COUNT(*) INTO v_triggers
  FROM pg_trigger t
  JOIN pg_class c ON t.tgrelid = c.oid
  WHERE c.relname IN ('licenses', 'license_requests', 'license_quota_transactions')
  AND t.tgname NOT LIKE 'RI_%';
  
  -- Count remaining functions
  SELECT COUNT(*) INTO v_functions
  FROM pg_proc
  WHERE proname LIKE '%license%' OR proname LIKE '%quota%';
  
  -- Count views
  SELECT COUNT(*) INTO v_view
  FROM pg_views
  WHERE viewname = 'licenses_with_computed_fields';
  
  -- Count policies
  SELECT COUNT(*) INTO v_policies
  FROM pg_policies
  WHERE tablename IN ('licenses', 'license_requests', 'license_quota_transactions', 'license_events', 'license_kpi_thresholds');
  
  RAISE NOTICE '📊 REMAINING OBJECTS:';
  RAISE NOTICE '  Triggers: % (should be 0)', v_triggers;
  RAISE NOTICE '  Functions: % (should be 0)', v_functions;
  RAISE NOTICE '  View: % (should be 0)', v_view;
  RAISE NOTICE '  Policies: % (should be 0)', v_policies;
  RAISE NOTICE '';
  
  IF v_triggers = 0 AND v_functions = 0 AND v_view = 0 AND v_policies = 0 THEN
    RAISE NOTICE '🟢 PERFECT! Everything cleaned!';
    RAISE NOTICE '';
    RAISE NOTICE '🚀 NEXT STEP:';
    RAISE NOTICE '   Now apply migration 19 and it will work!';
    RAISE NOTICE '';
    RAISE NOTICE '   File: 20251108000000_create_export_license_system.sql';
    RAISE NOTICE '   Copy ALL → Paste → RUN';
  ELSE
    RAISE NOTICE '🟡 Some objects remain. Check manually:';
    RAISE NOTICE '';
    IF v_triggers > 0 THEN
      RAISE NOTICE '   Run: SELECT tgname FROM pg_trigger WHERE tgrelid = ''license_requests''::regclass;';
    END IF;
    IF v_functions > 0 THEN
      RAISE NOTICE '   Run: SELECT proname FROM pg_proc WHERE proname LIKE ''%%license%%'';';
    END IF;
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- MANUAL VERIFICATION QUERIES (uncomment to check)
-- ═══════════════════════════════════════════════════════════════════════════

/*
-- Check no triggers remain
SELECT t.tgname, c.relname
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
WHERE c.relname IN ('licenses', 'license_requests')
AND t.tgname NOT LIKE 'RI_%';

-- Check no functions remain
SELECT proname FROM pg_proc WHERE proname LIKE '%license%';

-- Check tables still exist (should have data)
SELECT COUNT(*) FROM licenses;
SELECT COUNT(*) FROM license_requests;
*/
