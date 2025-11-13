/*
  # Fix Daily Production Display Issues

  1. Problem
    - Productions are created but don't display on the Daily Production page
    - Likely RLS SELECT policy issue preventing data retrieval

  2. Solution
    - Ensure SELECT policy allows all authenticated users to view productions
    - Verify table structure and indexes
    - Add helpful debugging

  3. Important Notes
    - site_id: Geographic site (guinea, yamfolila, dougbe, etc.)
    - mining_company_id: Mining company UUID (Yamfolila Gold Mine, etc.)
    - These are TWO DIFFERENT CONCEPTS - both are needed!
*/

-- ========================================
-- 1. VERIFY TABLE STRUCTURE
-- ========================================

-- Check if daily_production table exists and has correct columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'daily_production') THEN
    RAISE EXCEPTION 'daily_production table does not exist!';
  END IF;

  RAISE NOTICE '✅ daily_production table exists';
END $$;

-- ========================================
-- 2. FIX RLS POLICIES FOR SELECT
-- ========================================

-- Enable RLS if not already enabled
ALTER TABLE daily_production ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing SELECT policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view all productions" ON daily_production;
DROP POLICY IF EXISTS "Users can view productions" ON daily_production;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON daily_production;
DROP POLICY IF EXISTS "authenticated_users_select_daily_production" ON daily_production;
DROP POLICY IF EXISTS "Users can select daily production" ON daily_production;

-- Create a single, clear SELECT policy
CREATE POLICY "authenticated_select_all_productions"
  ON daily_production
  FOR SELECT
  TO authenticated
  USING (true);  -- All authenticated users can see all productions

COMMENT ON POLICY "authenticated_select_all_productions" ON daily_production IS
'Allows all authenticated users to view all daily production records';

-- ========================================
-- 3. VERIFY INSERT POLICY EXISTS
-- ========================================

-- Ensure INSERT policy exists (should have been created by previous migration)
DO $$
DECLARE
  insert_policy_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'daily_production'
      AND cmd = 'INSERT'
  ) INTO insert_policy_exists;

  IF NOT insert_policy_exists THEN
    RAISE NOTICE '⚠️  No INSERT policy found, creating one...';

    CREATE POLICY "authenticated_insert_production"
      ON daily_production
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() IS NOT NULL);
  ELSE
    RAISE NOTICE '✅ INSERT policy exists';
  END IF;
END $$;

-- ========================================
-- 4. VERIFY UPDATE POLICY EXISTS
-- ========================================

DO $$
DECLARE
  update_policy_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE tablename = 'daily_production'
      AND cmd = 'UPDATE'
  ) INTO update_policy_exists;

  IF NOT update_policy_exists THEN
    RAISE NOTICE '⚠️  No UPDATE policy found, creating one...';

    CREATE POLICY "authenticated_update_production"
      ON daily_production
      FOR UPDATE
      TO authenticated
      USING (auth.uid() IS NOT NULL)
      WITH CHECK (auth.uid() IS NOT NULL);
  ELSE
    RAISE NOTICE '✅ UPDATE policy exists';
  END IF;
END $$;

-- ========================================
-- 5. ADD HELPFUL INDEX FOR QUERIES
-- ========================================

-- Index for common queries (by date and company)
CREATE INDEX IF NOT EXISTS idx_daily_production_date
  ON daily_production(production_date DESC);

CREATE INDEX IF NOT EXISTS idx_daily_production_company
  ON daily_production(mining_company_id);

CREATE INDEX IF NOT EXISTS idx_daily_production_site
  ON daily_production(site_id);

CREATE INDEX IF NOT EXISTS idx_daily_production_date_company
  ON daily_production(production_date DESC, mining_company_id);

-- ========================================
-- 6. VERIFICATION AND DIAGNOSTICS
-- ========================================

DO $$
DECLARE
  total_records integer;
  select_policies integer;
  insert_policies integer;
  update_policies integer;
  recent_record record;
BEGIN
  -- Count total records
  SELECT COUNT(*) INTO total_records FROM daily_production;

  -- Count policies by type
  SELECT COUNT(*) INTO select_policies
  FROM pg_policies
  WHERE tablename = 'daily_production' AND cmd = 'SELECT';

  SELECT COUNT(*) INTO insert_policies
  FROM pg_policies
  WHERE tablename = 'daily_production' AND cmd = 'INSERT';

  SELECT COUNT(*) INTO update_policies
  FROM pg_policies
  WHERE tablename = 'daily_production' AND cmd = 'UPDATE';

  -- Get most recent record
  SELECT production_date, site_id, mining_company_id, created_at
  INTO recent_record
  FROM daily_production
  ORDER BY created_at DESC
  LIMIT 1;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'DAILY PRODUCTION DISPLAY FIX';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '📊 DATABASE STATUS:';
  RAISE NOTICE '   Total records: %', total_records;
  RAISE NOTICE '   SELECT policies: %', select_policies;
  RAISE NOTICE '   INSERT policies: %', insert_policies;
  RAISE NOTICE '   UPDATE policies: %', update_policies;
  RAISE NOTICE '';

  IF total_records > 0 THEN
    RAISE NOTICE '📅 MOST RECENT RECORD:';
    RAISE NOTICE '   Date: %', recent_record.production_date;
    RAISE NOTICE '   Site ID: %', recent_record.site_id;
    RAISE NOTICE '   Company ID: %', recent_record.mining_company_id;
    RAISE NOTICE '   Created: %', recent_record.created_at;
    RAISE NOTICE '';
  END IF;

  IF select_policies >= 1 AND total_records > 0 THEN
    RAISE NOTICE '✅✅✅ CONFIGURATION LOOKS GOOD!';
    RAISE NOTICE '';
    RAISE NOTICE '🔍 NEXT STEPS:';
    RAISE NOTICE '   1. Refresh the Daily Production page';
    RAISE NOTICE '   2. Check browser console for errors';
    RAISE NOTICE '   3. Verify date range filter includes recent dates';
    RAISE NOTICE '';
  ELSE
    RAISE WARNING '⚠️  POTENTIAL ISSUES DETECTED';
    IF select_policies = 0 THEN
      RAISE WARNING '   - No SELECT policy found!';
    END IF;
    IF total_records = 0 THEN
      RAISE WARNING '   - No records in database!';
    END IF;
  END IF;

  RAISE NOTICE '========================================';
END $$;

-- ========================================
-- 7. LIST ALL CURRENT POLICIES
-- ========================================

SELECT
  policyname AS "Policy Name",
  cmd AS "Command",
  roles::text AS "Roles",
  CASE
    WHEN qual IS NOT NULL THEN 'Has USING clause'
    ELSE 'No USING clause'
  END AS "Using",
  CASE
    WHEN with_check IS NOT NULL THEN 'Has WITH CHECK clause'
    ELSE 'No WITH CHECK clause'
  END AS "With Check"
FROM pg_policies
WHERE tablename = 'daily_production'
ORDER BY cmd, policyname;

-- ========================================
-- 8. TEST QUERY (for verification)
-- ========================================

/*
After running this migration, you can test with:

-- This should return all productions
SELECT
  id,
  production_date,
  bullion_grams,
  site_id,
  mining_company_id,
  created_at
FROM daily_production
ORDER BY created_at DESC
LIMIT 5;

-- Check if user can see the data
SELECT COUNT(*) as total_visible_to_user
FROM daily_production;
*/

-- ========================================
-- 9. NOTES ON site_id vs mining_company_id
-- ========================================

/*
IMPORTANT CLARIFICATION:

✅ site_id (text):
   - Geographic location: 'guinea', 'yamfolila', 'dougbe', etc.
   - Indicates WHERE the production happened
   - Should match user's site for filtering
   - Example: 'yamfolila'

✅ mining_company_id (uuid):
   - Reference to mining_companies table
   - Indicates WHICH COMPANY produced the gold
   - Foreign key to mining_companies.id
   - Example: '53cce625-d11d-4a0f-82b0-18e63...'

These are DIFFERENT concepts:
- Same site can have multiple mining companies
- Same company might operate in multiple sites
- BOTH fields are necessary and should NOT be removed

Example record:
  site_id: 'yamfolila'              ← Site location
  mining_company_id: 'uuid-here'    ← Yamfolila Gold Mine company
*/
