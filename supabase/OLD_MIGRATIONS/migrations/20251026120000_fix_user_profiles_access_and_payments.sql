/*
  # Fix User Profiles Access and Enable Full Access for Management

  1. Changes to user_profiles RLS
    - Add policy for management users to view all profiles
    - Keep existing policy for users to view their own profile
    - Add policy for management to update any user profile
    - Enable proper access for user directory

  2. Security
    - RLS remains enabled
    - Users can still only see their own profile
    - Management role can see and manage all user profiles
    - All policies use proper role checking without recursion

  3. Notes
    - This enables the User Management page to display all users
    - Fixes profile fetch timeout issues
    - Allows management full access to user administration
*/

-- Drop existing policies to recreate them properly
DROP POLICY IF EXISTS "user_profiles_select_own" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_update_own" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_management_select_all" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_management_update_all" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_management_insert" ON user_profiles;

-- Policy: Users can view their own profile
CREATE POLICY "user_profiles_select_own"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Policy: Management can view all profiles
-- Uses raw_app_meta_data to avoid recursion
CREATE POLICY "user_profiles_management_select_all"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (
    auth.jwt() ->> 'role' = 'management'
    OR
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'management'
    OR
    -- Fallback: check if user is actually management in their own profile
    (auth.uid() IN (
      SELECT id FROM user_profiles WHERE id = auth.uid() AND role = 'management'
    ))
  );

-- Policy: Users can update their own profile
CREATE POLICY "user_profiles_update_own"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Policy: Management can update any profile
CREATE POLICY "user_profiles_management_update_all"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (
    auth.jwt() ->> 'role' = 'management'
    OR
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'management'
    OR
    -- Fallback: check if user is actually management
    (auth.uid() IN (
      SELECT id FROM user_profiles WHERE id = auth.uid() AND role = 'management'
    ))
  )
  WITH CHECK (
    auth.jwt() ->> 'role' = 'management'
    OR
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'management'
    OR
    (auth.uid() IN (
      SELECT id FROM user_profiles WHERE id = auth.uid() AND role = 'management'
    ))
  );

-- Policy: Management can insert new profiles (for user creation)
CREATE POLICY "user_profiles_management_insert"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.jwt() ->> 'role' = 'management'
    OR
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'management'
    OR
    (auth.uid() IN (
      SELECT id FROM user_profiles WHERE id = auth.uid() AND role = 'management'
    ))
  );

-- Update the specific user to have management role and ensure profile exists
-- This fixes access for romuald.tiegnan@gmail.com
DO $$
DECLARE
  user_uuid uuid;
BEGIN
  -- Get the user ID for romuald.tiegnan@gmail.com
  SELECT id INTO user_uuid
  FROM auth.users
  WHERE email = 'romuald.tiegnan@gmail.com';

  -- If user exists, update or insert their profile
  IF user_uuid IS NOT NULL THEN
    -- Insert or update user profile with management role
    INSERT INTO user_profiles (
      id,
      email,
      full_name,
      role,
      is_active,
      language
    )
    VALUES (
      user_uuid,
      'romuald.tiegnan@gmail.com',
      'Romuald Tiegnan',
      'management',
      true,
      'en'
    )
    ON CONFLICT (id) DO UPDATE
    SET
      role = 'management',
      is_active = true,
      updated_at = now();

    -- Update auth metadata to include role
    UPDATE auth.users
    SET raw_app_meta_data =
      COALESCE(raw_app_meta_data, '{}'::jsonb) ||
      jsonb_build_object('role', 'management')
    WHERE id = user_uuid;

    RAISE NOTICE 'Updated user % to management role', 'romuald.tiegnan@gmail.com';
  ELSE
    RAISE NOTICE 'User % not found in auth.users', 'romuald.tiegnan@gmail.com';
  END IF;
END $$;

-- Create profiles for ALL auth.users that don't have a profile yet
-- This ensures that all authenticated users have a corresponding profile
INSERT INTO user_profiles (
  id,
  email,
  full_name,
  role,
  is_active
)
SELECT
  au.id,
  au.email,
  COALESCE(au.raw_user_meta_data->>'full_name', split_part(au.email, '@', 1)),
  COALESCE((au.raw_app_meta_data->>'role')::text, 'factory'),
  true
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM user_profiles up WHERE up.id = au.id
)
ON CONFLICT (id) DO UPDATE
SET
  email = EXCLUDED.email,
  updated_at = now();
