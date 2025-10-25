/*
  # Simplify User Profiles RLS to Prevent Recursion
  
  1. Problem
    - Checking role in same table causes infinite recursion
    - Need simpler approach for management access
  
  2. Solution
    - Keep simple "select own" policy for regular users
    - For User Management page, we'll use service role key instead
    - This is the recommended Supabase approach for admin operations
  
  3. Security
    - Regular users can only see their own profile
    - Admin operations (like User Management) should use service role
    - No recursion possible
*/

-- Drop the problematic management policy
DROP POLICY IF EXISTS "user_profiles_management_select_all" ON user_profiles;

-- Keep the simple policies (already exist, but recreate to be sure)
DROP POLICY IF EXISTS "user_profiles_select_own" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_update_own" ON user_profiles;

CREATE POLICY "user_profiles_select_own"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "user_profiles_update_own"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Note: Service role operations bypass RLS entirely
-- The User Management page should use service role for admin operations
