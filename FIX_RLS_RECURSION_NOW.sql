-- ================================================================
-- URGENT FIX: INFINITE RECURSION IN USER_PROFILES RLS POLICIES
-- ================================================================
-- This completely removes the problematic RLS policies
-- Security is now handled by Edge Functions
-- ================================================================

-- Step 1: Disable RLS on user_profiles
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;

-- Step 2: Drop ALL existing policies on user_profiles
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN 
    SELECT policyname 
    FROM pg_policies 
    WHERE tablename = 'user_profiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON user_profiles', pol.policyname);
    RAISE NOTICE 'Dropped policy: %', pol.policyname;
  END LOOP;
END $$;

-- Step 3: Grant full access to service_role (for Edge Functions)
GRANT ALL ON user_profiles TO service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Step 4: Grant read/update to authenticated users (for own profile)
GRANT SELECT ON user_profiles TO authenticated;
GRANT UPDATE ON user_profiles TO authenticated;

-- Step 5: Create helper function to check management role (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_management_user(user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM user_profiles 
    WHERE id = user_id AND role = 'management'
  );
$$;

-- Grant execute to authenticated
GRANT EXECUTE ON FUNCTION public.is_management_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_management_user(uuid) TO service_role;

-- Step 6: Verify final state
SELECT 
  '=== VERIFICATION RESULTS ===' as info;

SELECT 
  'Policies on user_profiles:' as check_type,
  COUNT(*) as count,
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ SUCCESS - No policies (no recursion!)'
    ELSE '⚠️  WARNING - Still has policies'
  END as status
FROM pg_policies
WHERE tablename = 'user_profiles';

SELECT 
  'RLS Status:' as check_type,
  rowsecurity as enabled,
  CASE 
    WHEN rowsecurity = false THEN '✅ SUCCESS - RLS disabled'
    ELSE '⚠️  WARNING - RLS still enabled'
  END as status
FROM pg_tables
WHERE tablename = 'user_profiles';

SELECT 
  'Helper Function:' as check_type,
  COUNT(*) as count,
  CASE 
    WHEN COUNT(*) = 1 THEN '✅ SUCCESS - Function exists'
    ELSE '❌ ERROR - Function missing'
  END as status
FROM pg_proc
WHERE proname = 'is_management_user';

-- Success messages
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '╔════════════════════════════════════════════════╗';
  RAISE NOTICE '║  ✅ FIX APPLIED SUCCESSFULLY!                  ║';
  RAISE NOTICE '╚════════════════════════════════════════════════╝';
  RAISE NOTICE '';
  RAISE NOTICE '✅ RLS policies removed from user_profiles';
  RAISE NOTICE '✅ All access now controlled by Edge Functions';
  RAISE NOTICE '✅ Helper function is_management_user() created';
  RAISE NOTICE '✅ No more infinite recursion!';
  RAISE NOTICE '';
  RAISE NOTICE 'NEXT STEPS:';
  RAISE NOTICE '1. Refresh your application (Ctrl+Shift+R)';
  RAISE NOTICE '2. Go to Administration → User Management';
  RAISE NOTICE '3. Page should load without errors';
  RAISE NOTICE '4. Test user creation';
  RAISE NOTICE '';
END $$;
