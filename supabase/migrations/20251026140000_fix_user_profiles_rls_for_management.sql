/*
  # Fix User Profiles RLS for Management Access

  1. Problem
    - Management users cannot view all user profiles
    - RLS policies are checking JWT incorrectly
    - Multiple conflicting policies exist

  2. Solution
    - Remove all conflicting policies
    - Create clean, working policies
    - Use raw_app_meta_data for role checking
    - Allow management users to view/edit all profiles

  3. Security
    - Users can view their own profile
    - Management users can view all profiles
    - Management users can edit all profiles
    - Regular users cannot see other users
*/

-- Drop all existing user_profiles RLS policies
DROP POLICY IF EXISTS "user_profiles_select_own" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_update_own" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_management_select_all" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_management_update_all" ON user_profiles;
DROP POLICY IF EXISTS "Management can view all user profiles" ON user_profiles;
DROP POLICY IF EXISTS "Management can update all user profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;

-- Ensure RLS is enabled
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Policy 1: Users can SELECT their own profile
CREATE POLICY "Users can view own profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Policy 2: Management users can SELECT all profiles
CREATE POLICY "Management can view all profiles"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role')::text = 'management'
    OR
    -- Also check the user_profiles table directly (for backward compatibility)
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.role = 'management'
    )
  );

-- Policy 3: Users can UPDATE their own profile
CREATE POLICY "Users can update own profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Policy 4: Management users can UPDATE all profiles
CREATE POLICY "Management can update all profiles"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role')::text = 'management'
    OR
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.role = 'management'
    )
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role')::text = 'management'
    OR
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.role = 'management'
    )
  );

-- Policy 5: Management users can INSERT new profiles
CREATE POLICY "Management can create profiles"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role')::text = 'management'
    OR
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.role = 'management'
    )
  );

-- Policy 6: Management users can DELETE profiles
CREATE POLICY "Management can delete profiles"
  ON user_profiles
  FOR DELETE
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role')::text = 'management'
    OR
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
      AND up.role = 'management'
    )
  );

-- Ensure romuald.tiegnan@gmail.com has management role in app_metadata
DO $$
DECLARE
  user_uuid uuid;
BEGIN
  -- Get the user ID
  SELECT id INTO user_uuid
  FROM auth.users
  WHERE email = 'romuald.tiegnan@gmail.com';

  IF user_uuid IS NOT NULL THEN
    -- Update app_metadata with role
    UPDATE auth.users
    SET raw_app_meta_data =
      COALESCE(raw_app_meta_data, '{}'::jsonb) ||
      jsonb_build_object('role', 'management')
    WHERE id = user_uuid;

    RAISE NOTICE 'Updated app_metadata for user %', 'romuald.tiegnan@gmail.com';
  END IF;
END $$;
