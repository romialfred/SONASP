/*
  ═══════════════════════════════════════════════════════════════════════════
  🚨 LICENSE MODULE DIAGNOSTIC & FIX
  ═══════════════════════════════════════════════════════════════════════════
  
  COPY THIS ENTIRE FILE AND RUN IN SUPABASE SQL EDITOR
  
  This will show you EXACTLY what's missing and what to do.
*/

-- ═══════════════════════════════════════════════════════════════════════════
-- DIAGNOSTIC
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_tables INT;
  v_view INT;
  v_licenses INT;
  v_mines INT;
  v_role TEXT;
  v_rls BOOLEAN;
BEGIN
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '🔍 LICENSE MODULE DIAGNOSTIC';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  
  -- Check tables
  SELECT COUNT(*) INTO v_tables
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name IN ('licenses', 'license_requests');
  
  RAISE NOTICE '1. TABLES (licenses, license_requests): %', v_tables;
  IF v_tables >= 2 THEN
    RAISE NOTICE '   ✅ Tables exist';
  ELSE
    RAISE NOTICE '   ❌ MISSING! Need to apply MIGRATION 19';
    RAISE NOTICE '   File: 20251108000000_create_export_license_system.sql';
  END IF;
  RAISE NOTICE '';
  
  -- Check view
  SELECT COUNT(*) INTO v_view
  FROM pg_views
  WHERE schemaname = 'public'
  AND viewname = 'licenses_with_computed_fields';
  
  RAISE NOTICE '2. VIEW (licenses_with_computed_fields): %', v_view;
  IF v_view = 1 THEN
    RAISE NOTICE '   ✅ View exists';
  ELSE
    RAISE NOTICE '   ❌ MISSING! This is why list is empty!';
    RAISE NOTICE '   Need to apply MIGRATION 19';
  END IF;
  RAISE NOTICE '';
  
  -- Check data
  IF v_tables >= 2 THEN
    EXECUTE 'SELECT COUNT(*) FROM licenses' INTO v_licenses;
    RAISE NOTICE '3. LICENSE DATA: % rows', v_licenses;
    IF v_licenses > 0 THEN
      RAISE NOTICE '   ✅ Has % licenses', v_licenses;
    ELSE
      RAISE NOTICE '   ❌ TABLE EMPTY! Need to apply MIGRATION 20';
      RAISE NOTICE '   File: 20251108100000_seed_license_sample_data.sql';
    END IF;
  ELSE
    RAISE NOTICE '3. LICENSE DATA: N/A (table missing)';
    v_licenses := 0;
  END IF;
  RAISE NOTICE '';
  
  -- Check mining companies
  BEGIN
    SELECT COUNT(*) INTO v_mines
    FROM mining_companies
    WHERE status = 'active';
    
    RAISE NOTICE '4. MINING COMPANIES (active): % rows', v_mines;
    IF v_mines > 0 THEN
      RAISE NOTICE '   ✅ Has % mining companies', v_mines;
      RAISE NOTICE '   If dropdown empty, check RLS policies';
    ELSE
      RAISE NOTICE '   ⚠️  No active mining companies';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '4. MINING COMPANIES: Table might not exist';
    v_mines := 0;
  END;
  RAISE NOTICE '';
  
  -- Check user role
  BEGIN
    SELECT role INTO v_role FROM user_profiles WHERE id = auth.uid();
    RAISE NOTICE '5. YOUR ROLE: %', COALESCE(v_role, 'NULL');
    IF v_role IN ('management', 'factory') THEN
      RAISE NOTICE '   ✅ Role is correct';
    ELSE
      RAISE NOTICE '   ❌ WRONG ROLE! Should be management or factory';
      RAISE NOTICE '   Run: UPDATE user_profiles SET role = ''management'' WHERE id = auth.uid();';
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '5. YOUR ROLE: ERROR (user_profiles table issue)';
    v_role := NULL;
  END;
  RAISE NOTICE '';
  
  -- Check RLS
  IF v_tables >= 2 THEN
    SELECT relrowsecurity INTO v_rls
    FROM pg_class
    WHERE relname = 'licenses' AND relnamespace = 'public'::regnamespace;
    
    RAISE NOTICE '6. RLS ON LICENSES: %', CASE WHEN v_rls THEN 'ENABLED' ELSE 'DISABLED' END;
  END IF;
  RAISE NOTICE '';
  
  -- Summary
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '📋 WHAT TO DO:';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  
  IF v_tables < 2 OR v_view < 1 THEN
    RAISE NOTICE '🔴 STEP 1: APPLY MIGRATION 19';
    RAISE NOTICE '';
    RAISE NOTICE 'File: supabase/migrations/20251108000000_create_export_license_system.sql';
    RAISE NOTICE '';
    RAISE NOTICE '1. Open the file';
    RAISE NOTICE '2. Select ALL (CTRL+A)';
    RAISE NOTICE '3. Copy (CTRL+C)';
    RAISE NOTICE '4. Open NEW SQL Editor tab';
    RAISE NOTICE '5. Paste (CTRL+V)';
    RAISE NOTICE '6. Click RUN';
    RAISE NOTICE '7. Wait 10 seconds';
    RAISE NOTICE '8. Then run STEP 2';
    RAISE NOTICE '';
  END IF;
  
  IF v_licenses = 0 AND v_tables >= 2 THEN
    RAISE NOTICE '🟡 STEP 2: APPLY MIGRATION 20';
    RAISE NOTICE '';
    RAISE NOTICE 'File: supabase/migrations/20251108100000_seed_license_sample_data.sql';
    RAISE NOTICE '';
    RAISE NOTICE '1. Open the file';
    RAISE NOTICE '2. Copy ALL';
    RAISE NOTICE '3. Paste in SQL Editor';
    RAISE NOTICE '4. Click RUN';
    RAISE NOTICE '5. Should see: "INSERT 0 10"';
    RAISE NOTICE '';
  END IF;
  
  IF v_role IS NULL OR v_role NOT IN ('management', 'factory') THEN
    RAISE NOTICE '🟡 STEP 3: FIX YOUR ROLE';
    RAISE NOTICE '';
    RAISE NOTICE 'UPDATE user_profiles SET role = ''management'' WHERE id = auth.uid();';
    RAISE NOTICE '';
  END IF;
  
  IF v_tables >= 2 AND v_view >= 1 AND v_licenses > 0 AND v_role IN ('management', 'factory') THEN
    RAISE NOTICE '🟢 ALL GOOD! If page still empty:';
    RAISE NOTICE '';
    RAISE NOTICE '1. Check browser console (F12) for errors';
    RAISE NOTICE '2. Hard reload page (CTRL+SHIFT+R)';
    RAISE NOTICE '3. Test query below';
    RAISE NOTICE '';
  END IF;
  
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- TEST QUERIES (Run after fixing)
-- ═══════════════════════════════════════════════════════════════════════════

/*
-- Test 1: Can you see licenses?
SELECT
  license_number,
  applicant_company_name,
  status,
  remaining_percentage
FROM licenses_with_computed_fields
LIMIT 3;

-- Test 2: Can you see mining companies?
SELECT id, name, status
FROM mining_companies
WHERE status = 'active'
ORDER BY name
LIMIT 5;

-- Test 3: Count everything
SELECT
  (SELECT COUNT(*) FROM licenses) as total_licenses,
  (SELECT COUNT(*) FROM mining_companies WHERE status = 'active') as active_mines;
*/
