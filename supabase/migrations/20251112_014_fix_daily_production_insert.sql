/*
  # Fix Daily Production Insert Issues

  1. Issues Fixed
    - Fix RLS policies for daily_production INSERT operations
    - Ensure created_by field is properly set
    - Fix mining_company_id reference validation

  2. Changes
    - Drop and recreate INSERT policy with proper checks
    - Add default for created_by if not provided
    - Ensure site_id defaults are working

  3. Security
    - Maintain RLS protection
    - Allow authenticated users to insert with auto-filled created_by
*/

-- ========================================
-- 1. FIX DAILY_PRODUCTION INSERT POLICY
-- ========================================

-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Users can insert productions" ON daily_production;

-- Recreate with proper checks that auto-fill created_by
CREATE POLICY "Users can insert productions"
  ON daily_production
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- User must be authenticated
    auth.uid() IS NOT NULL
    AND
    -- Created_by must either match user OR be NULL (will be auto-filled by trigger)
    (created_by = auth.uid() OR created_by IS NULL)
  );

-- ========================================
-- 2. CREATE TRIGGER TO AUTO-FILL CREATED_BY
-- ========================================

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS set_created_by_on_daily_production ON daily_production;
DROP FUNCTION IF EXISTS set_created_by_on_insert() CASCADE;

-- Create function to auto-fill created_by
CREATE OR REPLACE FUNCTION set_created_by_on_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- If created_by is not set, use current user
  IF NEW.created_by IS NULL THEN
    NEW.created_by = auth.uid();
  END IF;

  -- If site_id is not set, use default 'guinea'
  IF NEW.site_id IS NULL OR NEW.site_id = '' THEN
    NEW.site_id = 'guinea';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
CREATE TRIGGER set_created_by_on_daily_production
  BEFORE INSERT ON daily_production
  FOR EACH ROW
  EXECUTE FUNCTION set_created_by_on_insert();

-- ========================================
-- 3. ENSURE MINING_COMPANIES TABLE IS ACCESSIBLE
-- ========================================

-- Make sure mining_companies RLS is properly set
ALTER TABLE IF EXISTS mining_companies ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policy
DROP POLICY IF EXISTS "Users can view mining companies" ON mining_companies;

CREATE POLICY "Users can view mining companies"
  ON mining_companies
  FOR SELECT
  TO authenticated
  USING (true);

-- ========================================
-- 4. FIX UPDATE POLICY TO ALLOW PROPER UPDATES
-- ========================================

DROP POLICY IF EXISTS "Users can update productions" ON daily_production;

CREATE POLICY "Users can update productions"
  ON daily_production
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (
    -- User can update their own production or any production
    auth.uid() IS NOT NULL
  );

-- ========================================
-- 5. VERIFICATION
-- ========================================

DO $$
DECLARE
  insert_policy_count integer;
  trigger_exists boolean;
BEGIN
  -- Check INSERT policies
  SELECT COUNT(*) INTO insert_policy_count
  FROM pg_policies
  WHERE tablename = 'daily_production'
    AND cmd = 'INSERT';

  -- Check trigger exists
  SELECT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'set_created_by_on_daily_production'
  ) INTO trigger_exists;

  RAISE NOTICE '=== Daily Production Insert Fix Status ===';
  RAISE NOTICE 'INSERT policies: %', insert_policy_count;
  RAISE NOTICE 'Auto-fill trigger exists: %', trigger_exists;

  IF insert_policy_count >= 1 AND trigger_exists THEN
    RAISE NOTICE '✅ Daily production insert fix applied successfully!';
  ELSE
    RAISE WARNING '⚠️ Some components may not be set up correctly';
  END IF;
END $$;
