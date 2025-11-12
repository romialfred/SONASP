/*
  # Fix Daily Production RLS and Permissions

  1. Issues Fixed
    - Add missing RLS policies for daily_production table
    - Ensure proper permissions for SELECT, INSERT, UPDATE, DELETE
    - Fix status history function permissions
    - Ensure all users can view and manage productions

  2. Security
    - Enable RLS on daily_production if not already enabled
    - Allow authenticated users to:
      - View all productions (SELECT)
      - Create productions (INSERT)
      - Update their own or all productions (UPDATE)
      - Delete productions (DELETE)
    - Allow read access to status history
*/

-- ========================================
-- 1. ENSURE RLS IS ENABLED
-- ========================================

ALTER TABLE daily_production ENABLE ROW LEVEL SECURITY;

-- ========================================
-- 2. DROP EXISTING POLICIES
-- ========================================

DROP POLICY IF EXISTS "Users can view all productions" ON daily_production;
DROP POLICY IF EXISTS "Users can insert productions" ON daily_production;
DROP POLICY IF EXISTS "Users can update productions" ON daily_production;
DROP POLICY IF EXISTS "Users can delete productions" ON daily_production;
DROP POLICY IF EXISTS "Enable read access for authenticated users" ON daily_production;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON daily_production;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON daily_production;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON daily_production;

-- ========================================
-- 3. CREATE COMPREHENSIVE RLS POLICIES
-- ========================================

-- Policy for SELECT: All authenticated users can view all productions
CREATE POLICY "Users can view all productions"
  ON daily_production
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy for INSERT: Authenticated users can create productions
CREATE POLICY "Users can insert productions"
  ON daily_production
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Policy for UPDATE: Authenticated users can update all productions
CREATE POLICY "Users can update productions"
  ON daily_production
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy for DELETE: Authenticated users can delete productions
CREATE POLICY "Users can delete productions"
  ON daily_production
  FOR DELETE
  TO authenticated
  USING (true);

-- ========================================
-- 4. VERIFY STATUS HISTORY FUNCTION
-- ========================================

-- Recreate the status history function to ensure SECURITY DEFINER is set
CREATE OR REPLACE FUNCTION get_production_status_history(prod_id uuid)
RETURNS TABLE (
  id uuid,
  production_id uuid,
  old_status text,
  new_status text,
  changed_by uuid,
  changed_at timestamptz,
  notes text,
  user_email text
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    psh.id,
    psh.production_id,
    psh.old_status::text,
    psh.new_status::text,
    psh.changed_by,
    psh.changed_at,
    psh.notes,
    COALESCE(au.email, 'system') as user_email
  FROM production_status_history psh
  LEFT JOIN auth.users au ON psh.changed_by = au.id
  WHERE psh.production_id = prod_id
  ORDER BY psh.changed_at DESC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_production_status_history(uuid) TO authenticated;

-- ========================================
-- 5. ENSURE MINING COMPANIES TABLE HAS RLS
-- ========================================

ALTER TABLE IF EXISTS mining_companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view mining companies" ON mining_companies;

CREATE POLICY "Users can view mining companies"
  ON mining_companies
  FOR SELECT
  TO authenticated
  USING (true);

-- ========================================
-- 6. VERIFICATION
-- ========================================

-- Check RLS status
DO $$
DECLARE
  dp_rls_enabled boolean;
  dp_policy_count integer;
  psh_policy_count integer;
BEGIN
  -- Check if RLS is enabled on daily_production
  SELECT relrowsecurity INTO dp_rls_enabled
  FROM pg_class
  WHERE relname = 'daily_production';

  -- Count policies
  SELECT COUNT(*) INTO dp_policy_count
  FROM pg_policies
  WHERE tablename = 'daily_production';

  SELECT COUNT(*) INTO psh_policy_count
  FROM pg_policies
  WHERE tablename = 'production_status_history';

  RAISE NOTICE '=== Daily Production RLS Status ===';
  RAISE NOTICE 'RLS Enabled: %', dp_rls_enabled;
  RAISE NOTICE 'Policies Count: %', dp_policy_count;
  RAISE NOTICE 'Status History Policies: %', psh_policy_count;

  IF dp_policy_count < 4 THEN
    RAISE WARNING 'Expected 4 policies on daily_production, found %', dp_policy_count;
  ELSE
    RAISE NOTICE 'All policies created successfully!';
  END IF;
END $$;

-- ========================================
-- 7. TEST QUERIES
-- ========================================

-- Test that the function works
DO $$
DECLARE
  test_prod_id uuid;
  history_count integer;
BEGIN
  -- Get a production ID to test
  SELECT id INTO test_prod_id
  FROM daily_production
  LIMIT 1;

  IF test_prod_id IS NOT NULL THEN
    -- Test the status history function
    SELECT COUNT(*) INTO history_count
    FROM get_production_status_history(test_prod_id);

    RAISE NOTICE 'Status history function works! Found % history entries for production %',
                 history_count, test_prod_id;
  ELSE
    RAISE NOTICE 'No productions found to test status history function';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error testing status history function: %', SQLERRM;
END $$;

-- Display policy details for verification
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual IS NOT NULL as has_using,
  with_check IS NOT NULL as has_check
FROM pg_policies
WHERE tablename IN ('daily_production', 'production_status_history')
ORDER BY tablename, policyname;
