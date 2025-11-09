/*
  ═══════════════════════════════════════════════════════════════════════════
  🔧 CLEAN AND REAPPLY MIGRATION 19
  ═══════════════════════════════════════════════════════════════════════════
  
  This script will:
  1. Drop existing triggers/functions that cause conflicts
  2. Check what exists
  3. Tell you exactly what to do next
  
  SAFE TO RUN - Only drops objects that will be recreated
*/

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 1: DROP EXISTING TRIGGERS AND FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  RAISE NOTICE '🔧 Cleaning existing license objects...';
  RAISE NOTICE '';
END $$;

-- Drop triggers
DROP TRIGGER IF EXISTS set_license_request_number ON license_requests;
DROP TRIGGER IF EXISTS update_license_status_on_dates ON licenses;
DROP TRIGGER IF EXISTS update_license_status_on_quota ON licenses;
DROP TRIGGER IF EXISTS log_license_quota_transaction ON license_quota_transactions;
DROP TRIGGER IF EXISTS update_updated_at ON licenses;
DROP TRIGGER IF EXISTS update_updated_at ON license_requests;

-- Drop functions
DROP FUNCTION IF EXISTS generate_license_request_number() CASCADE;
DROP FUNCTION IF EXISTS update_license_status_based_on_dates() CASCADE;
DROP FUNCTION IF EXISTS update_license_status_based_on_quota() CASCADE;
DROP FUNCTION IF EXISTS log_quota_transaction_event() CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Drop policies (will be recreated)
DROP POLICY IF EXISTS "Management can view all licenses" ON licenses;
DROP POLICY IF EXISTS "Mines can view own licenses" ON licenses;
DROP POLICY IF EXISTS "Management can insert licenses" ON licenses;
DROP POLICY IF EXISTS "Management can update licenses" ON licenses;
DROP POLICY IF EXISTS "Management can delete licenses" ON licenses;

DROP POLICY IF EXISTS "Management can view all requests" ON license_requests;
DROP POLICY IF EXISTS "Mines can view own requests" ON license_requests;
DROP POLICY IF EXISTS "Mines can insert own requests" ON license_requests;
DROP POLICY IF EXISTS "Management can update requests" ON license_requests;

DROP POLICY IF EXISTS "Management can view quota transactions" ON license_quota_transactions;
DROP POLICY IF EXISTS "Management can insert quota transactions" ON license_quota_transactions;

DROP POLICY IF EXISTS "Management can view license events" ON license_events;
DROP POLICY IF EXISTS "Management can insert license events" ON license_events;

DROP POLICY IF EXISTS "Management can view thresholds" ON license_kpi_thresholds;
DROP POLICY IF EXISTS "Management can update thresholds" ON license_kpi_thresholds;

-- Drop view
DROP VIEW IF EXISTS licenses_with_computed_fields CASCADE;

-- Drop enum types if they exist (will be recreated)
DO $$
BEGIN
  DROP TYPE IF EXISTS license_request_status CASCADE;
  DROP TYPE IF EXISTS license_status CASCADE;
  DROP TYPE IF EXISTS license_event_type CASCADE;
  DROP TYPE IF EXISTS quota_transaction_type CASCADE;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Some enums did not exist, continuing...';
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 2: CHECK WHAT EXISTS
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_licenses_exists BOOLEAN;
  v_requests_exists BOOLEAN;
  v_transactions_exists BOOLEAN;
  v_events_exists BOOLEAN;
  v_thresholds_exists BOOLEAN;
  v_license_count INT := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '🔍 CHECKING CURRENT STATE';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  
  -- Check tables
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'licenses'
  ) INTO v_licenses_exists;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'license_requests'
  ) INTO v_requests_exists;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'license_quota_transactions'
  ) INTO v_transactions_exists;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'license_events'
  ) INTO v_events_exists;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'license_kpi_thresholds'
  ) INTO v_thresholds_exists;
  
  RAISE NOTICE '📋 TABLES STATUS:';
  RAISE NOTICE '  licenses: %', CASE WHEN v_licenses_exists THEN '✅ EXISTS' ELSE '❌ MISSING' END;
  RAISE NOTICE '  license_requests: %', CASE WHEN v_requests_exists THEN '✅ EXISTS' ELSE '❌ MISSING' END;
  RAISE NOTICE '  license_quota_transactions: %', CASE WHEN v_transactions_exists THEN '✅ EXISTS' ELSE '❌ MISSING' END;
  RAISE NOTICE '  license_events: %', CASE WHEN v_events_exists THEN '✅ EXISTS' ELSE '❌ MISSING' END;
  RAISE NOTICE '  license_kpi_thresholds: %', CASE WHEN v_thresholds_exists THEN '✅ EXISTS' ELSE '❌ MISSING' END;
  RAISE NOTICE '';
  
  -- Check if data exists
  IF v_licenses_exists THEN
    SELECT COUNT(*) INTO v_license_count FROM licenses;
    RAISE NOTICE '📊 DATA: % licenses exist', v_license_count;
    RAISE NOTICE '';
  END IF;
  
  -- Decision
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '📋 NEXT STEPS:';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
  RAISE NOTICE '';
  
  IF v_licenses_exists AND v_requests_exists THEN
    RAISE NOTICE '✅ Tables already exist!';
    RAISE NOTICE '';
    RAISE NOTICE '🔄 WHAT TO DO:';
    RAISE NOTICE '   The triggers and functions have been cleaned.';
    RAISE NOTICE '   Now you need to recreate the view and triggers.';
    RAISE NOTICE '';
    RAISE NOTICE '   Option 1: Apply only the view and triggers';
    RAISE NOTICE '   → Use: REAPPLY_VIEW_AND_TRIGGERS.sql (will be created)';
    RAISE NOTICE '';
    RAISE NOTICE '   Option 2: Skip table creation in migration';
    RAISE NOTICE '   → Manually comment out CREATE TABLE statements';
    RAISE NOTICE '   → Then run migration 19';
    RAISE NOTICE '';
    
    IF v_license_count > 0 THEN
      RAISE NOTICE '⚠️  WARNING: % licenses exist!', v_license_count;
      RAISE NOTICE '   Do NOT drop tables or you will LOSE DATA!';
      RAISE NOTICE '   Use Option 1 (view and triggers only)';
    END IF;
  ELSE
    RAISE NOTICE '✅ Tables cleaned. Safe to apply full migration 19.';
    RAISE NOTICE '';
    RAISE NOTICE '🚀 NEXT: Apply migration 19';
    RAISE NOTICE '   File: 20251108000000_create_export_license_system.sql';
    RAISE NOTICE '   Copy ALL → Paste in SQL Editor → RUN';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════════════';
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICATION QUERIES
-- ═══════════════════════════════════════════════════════════════════════════

/*
-- After applying migration, verify with:

-- 1. Check view exists
SELECT COUNT(*) FROM pg_views WHERE viewname = 'licenses_with_computed_fields';

-- 2. Check triggers exist
SELECT tgname FROM pg_trigger WHERE tgrelid = 'licenses'::regclass;

-- 3. Check functions exist
SELECT proname FROM pg_proc WHERE proname LIKE '%license%';

-- 4. Test view
SELECT * FROM licenses_with_computed_fields LIMIT 1;
*/
