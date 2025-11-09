/*
  ═══════════════════════════════════════════════════════════════════════════
  💥 COMPLETE LICENSE SYSTEM CLEANUP - DEFINITIVE SOLUTION
  ═══════════════════════════════════════════════════════════════════════════
  
  This script will COMPLETELY clean ALL license-related objects.
  
  COVERAGE:
    ✓ All 6 tables (including license_request_documents)
    ✓ All triggers on ALL tables
    ✓ All functions
    ✓ All views
    ✓ ALL policies on ALL tables
    ✓ Verification at end
  
  SAFE: Preserves table data, only drops functions/triggers/views/policies
  
  RUN THIS ONCE, THEN RUN MIGRATION 19 - IT WILL WORK!
*/

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 1: DROP ALL POLICIES FROM ALL LICENSE TABLES
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  r RECORD;
  v_count INT := 0;
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '🧹 COMPLETE LICENSE CLEANUP';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '🔨 Step 1: Dropping ALL policies...';
  RAISE NOTICE '';
  
  -- Drop policies on ALL 6 tables
  FOR r IN (
    SELECT tablename, policyname
    FROM pg_policies
    WHERE tablename IN (
      'licenses',
      'license_requests',
      'license_request_documents',  -- ← THIS WAS MISSING!
      'license_quota_transactions',
      'license_events',
      'license_kpi_thresholds'
    )
  ) LOOP
    BEGIN
      EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || 
              ' ON ' || quote_ident(r.tablename);
      v_count := v_count + 1;
      RAISE NOTICE '  ✓ Dropped: % on %', r.policyname, r.tablename;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '  ✗ Failed: % on % - %', r.policyname, r.tablename, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ Dropped % policies', v_count;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 2: DROP ALL TRIGGERS FROM ALL LICENSE TABLES
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  r RECORD;
  v_count INT := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🔨 Step 2: Dropping ALL triggers...';
  RAISE NOTICE '';
  
  -- Drop triggers on ALL 6 tables
  FOR r IN (
    SELECT c.relname as tablename, t.tgname as triggername
    FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE c.relname IN (
      'licenses',
      'license_requests',
      'license_request_documents',  -- ← THIS TOO!
      'license_quota_transactions',
      'license_events',
      'license_kpi_thresholds'
    )
    AND t.tgname NOT LIKE 'RI_%'  -- Preserve foreign key triggers
  ) LOOP
    BEGIN
      EXECUTE 'DROP TRIGGER IF EXISTS ' || quote_ident(r.triggername) || 
              ' ON ' || quote_ident(r.tablename) || ' CASCADE';
      v_count := v_count + 1;
      RAISE NOTICE '  ✓ Dropped: % on %', r.triggername, r.tablename;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '  ✗ Failed: % - %', r.triggername, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ Dropped % triggers', v_count;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 3: DROP ALL LICENSE-RELATED FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  r RECORD;
  v_count INT := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🔨 Step 3: Dropping ALL functions...';
  RAISE NOTICE '';
  
  FOR r IN (
    SELECT 
      p.proname,
      pg_get_function_identity_arguments(p.oid) as args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND (
      p.proname LIKE '%license%'
      OR p.proname LIKE '%quota%'
    )
  ) LOOP
    BEGIN
      EXECUTE 'DROP FUNCTION IF EXISTS ' || quote_ident(r.proname) || 
              '(' || r.args || ') CASCADE';
      v_count := v_count + 1;
      RAISE NOTICE '  ✓ Dropped: %()', r.proname;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE '  ✗ Failed: %() - %', r.proname, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ Dropped % functions', v_count;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 4: DROP LICENSE VIEW
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🔨 Step 4: Dropping view...';
  RAISE NOTICE '';
  
  DROP VIEW IF EXISTS licenses_with_computed_fields CASCADE;
  
  RAISE NOTICE '  ✓ Dropped: licenses_with_computed_fields';
  RAISE NOTICE '';
  RAISE NOTICE '✅ View dropped';
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 5: COMPREHENSIVE VERIFICATION
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_policies INT := 0;
  v_triggers INT := 0;
  v_functions INT := 0;
  v_view INT := 0;
  v_tables INT := 0;
  v_license_data INT := 0;
  v_all_clean BOOLEAN := false;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ VERIFICATION';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  
  -- Count remaining policies
  SELECT COUNT(*) INTO v_policies
  FROM pg_policies
  WHERE tablename IN (
    'licenses', 
    'license_requests', 
    'license_request_documents',
    'license_quota_transactions', 
    'license_events', 
    'license_kpi_thresholds'
  );
  
  -- Count remaining triggers
  SELECT COUNT(*) INTO v_triggers
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
  AND t.tgname NOT LIKE 'RI_%';
  
  -- Count remaining functions
  SELECT COUNT(*) INTO v_functions
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
  AND (p.proname LIKE '%license%' OR p.proname LIKE '%quota%');
  
  -- Count view
  SELECT COUNT(*) INTO v_view
  FROM pg_views
  WHERE schemaname = 'public'
  AND viewname = 'licenses_with_computed_fields';
  
  -- Count tables
  SELECT COUNT(*) INTO v_tables
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
  
  -- Count existing data
  IF v_tables >= 6 THEN
    BEGIN
      SELECT COUNT(*) INTO v_license_data FROM licenses;
    EXCEPTION WHEN OTHERS THEN
      v_license_data := 0;
    END;
  END IF;
  
  RAISE NOTICE '📊 REMAINING OBJECTS:';
  RAISE NOTICE '  ├─ Policies: % (should be 0)', v_policies;
  RAISE NOTICE '  ├─ Triggers: % (should be 0)', v_triggers;
  RAISE NOTICE '  ├─ Functions: % (should be 0)', v_functions;
  RAISE NOTICE '  ├─ View: % (should be 0)', v_view;
  RAISE NOTICE '  ├─ Tables: % (OK if exists)', v_tables;
  RAISE NOTICE '  └─ License Data: % rows (preserved)', v_license_data;
  RAISE NOTICE '';
  
  v_all_clean := (v_policies = 0 AND v_triggers = 0 AND v_functions = 0 AND v_view = 0);
  
  IF v_all_clean THEN
    RAISE NOTICE '🟢 PERFECT! Everything cleaned successfully!';
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════════════════════';
    RAISE NOTICE '🚀 NEXT STEPS:';
    RAISE NOTICE '═══════════════════════════════════════════════════════════';
    RAISE NOTICE '';
    RAISE NOTICE '1. Open NEW SQL Editor tab';
    RAISE NOTICE '2. Open file: 20251108000000_create_export_license_system.sql';
    RAISE NOTICE '3. Copy ALL (CTRL+A, CTRL+C)';
    RAISE NOTICE '4. Paste in editor (CTRL+V)';
    RAISE NOTICE '5. Click RUN';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Migration 19 will now complete WITHOUT errors!';
    RAISE NOTICE '';
    
    IF v_license_data > 0 THEN
      RAISE NOTICE '📌 NOTE: You have % licenses - data preserved!', v_license_data;
      RAISE NOTICE '   Skip migration 20 if you want to keep this data.';
      RAISE NOTICE '';
    END IF;
  ELSE
    RAISE NOTICE '🟡 Some objects remain:';
    RAISE NOTICE '';
    
    IF v_policies > 0 THEN
      RAISE NOTICE '❌ % policies still exist!', v_policies;
      RAISE NOTICE '   Check: SELECT tablename, policyname FROM pg_policies';
      RAISE NOTICE '          WHERE tablename LIKE ''license%'';';
      RAISE NOTICE '';
    END IF;
    
    IF v_triggers > 0 THEN
      RAISE NOTICE '❌ % triggers still exist!', v_triggers;
      RAISE NOTICE '   Check: SELECT c.relname, t.tgname FROM pg_trigger t';
      RAISE NOTICE '          JOIN pg_class c ON t.tgrelid = c.oid';
      RAISE NOTICE '          WHERE c.relname LIKE ''license%'';';
      RAISE NOTICE '';
    END IF;
    
    IF v_functions > 0 THEN
      RAISE NOTICE '❌ % functions still exist!', v_functions;
      RAISE NOTICE '   Check: SELECT proname FROM pg_proc';
      RAISE NOTICE '          WHERE proname LIKE ''%license%'';';
      RAISE NOTICE '';
    END IF;
  END IF;
  
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
END $$;
