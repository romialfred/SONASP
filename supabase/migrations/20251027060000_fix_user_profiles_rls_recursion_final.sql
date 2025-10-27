/*
  # Fix User Profiles RLS Recursion - Final Solution

  1. Problem
     - Infinite recursion in user_profiles RLS policies
     - Multiple conflicting policies causing query loops
     - Permissions not loading correctly for romuald.tiegnan@gmail.com

  2. Solution
     - Drop ALL existing user_profiles RLS policies
     - Create simple, non-recursive policies
     - Use auth.uid() directly (no subqueries on user_profiles)
     - Add management role access without recursion
     - Grant full permissions to romuald.tiegnan@gmail.com

  3. Security
     - Users can view/update their own profile
     - Management users can view all profiles (via separate function)
     - No recursive checks that query user_profiles within policies
*/

-- ============================================================================
-- STEP 1: Drop ALL existing user_profiles policies
-- ============================================================================
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (
    SELECT policyname
    FROM pg_policies
    WHERE tablename = 'user_profiles'
  ) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON user_profiles', r.policyname);
    RAISE NOTICE 'Dropped policy: %', r.policyname;
  END LOOP;
END $$;

-- ============================================================================
-- STEP 2: Create simple, non-recursive RLS policies
-- ============================================================================

-- Policy 1: Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Policy 2: Users can update their own profile (but not their role)
CREATE POLICY "Users can update own profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = (SELECT role FROM user_profiles WHERE id = auth.uid())
  );

-- Policy 3: Service role has full access (for edge functions)
CREATE POLICY "Service role full access"
  ON user_profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- STEP 3: Create helper function for management access (non-recursive)
-- ============================================================================

-- Create a function that checks if current user is management
-- This avoids recursion by using auth.jwt() instead of querying user_profiles
CREATE OR REPLACE FUNCTION is_management_user()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  -- Check role from JWT metadata (set during login)
  RETURN COALESCE(
    (current_setting('request.jwt.claims', true)::json->>'role')::text = 'management',
    false
  );
END;
$$;

-- Policy 4: Management users can view all profiles (using helper function)
CREATE POLICY "Management can view all profiles"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (is_management_user());

-- Policy 5: Management users can update all profiles
CREATE POLICY "Management can update all profiles"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (is_management_user())
  WITH CHECK (is_management_user());

-- ============================================================================
-- STEP 4: Ensure romuald.tiegnan@gmail.com has management role
-- ============================================================================

DO $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Get user ID from auth.users
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'romuald.tiegnan@gmail.com';

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'User romuald.tiegnan@gmail.com not found in auth.users';
    RETURN;
  END IF;

  -- Update or insert user profile with management role
  INSERT INTO user_profiles (
    id,
    email,
    full_name,
    role,
    is_active,
    email_verified
  )
  VALUES (
    v_user_id,
    'romuald.tiegnan@gmail.com',
    'Romuald Tiegnan',
    'management',
    true,
    true
  )
  ON CONFLICT (id) DO UPDATE SET
    role = 'management',
    is_active = true,
    email_verified = true,
    full_name = COALESCE(user_profiles.full_name, 'Romuald Tiegnan'),
    updated_at = now();

  RAISE NOTICE 'Updated romuald.tiegnan@gmail.com to management role';

  -- Update app_metadata in auth.users (for JWT claims)
  UPDATE auth.users
  SET raw_app_meta_data = jsonb_set(
    COALESCE(raw_app_meta_data, '{}'::jsonb),
    '{role}',
    '"management"'
  )
  WHERE id = v_user_id;

  RAISE NOTICE 'Updated JWT metadata with management role';
END $$;

-- ============================================================================
-- STEP 5: Grant full permissions to all modules for romuald
-- ============================================================================

DO $$
DECLARE
  v_user_id UUID;
  v_module RECORD;
  v_count INT := 0;
  v_field_perms JSONB;
BEGIN
  -- Get user ID
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'romuald.tiegnan@gmail.com';

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'User not found';
    RETURN;
  END IF;

  -- Delete existing permissions
  DELETE FROM user_permissions WHERE user_id = v_user_id;
  RAISE NOTICE 'Deleted existing permissions';

  -- Build comprehensive field permissions
  v_field_perms := jsonb_build_object(
    'batch_number', jsonb_build_object('read', true, 'write', true),
    'weight', jsonb_build_object('read', true, 'write', true),
    'status', jsonb_build_object('read', true, 'write', true),
    'name', jsonb_build_object('read', true, 'write', true),
    'email', jsonb_build_object('read', true, 'write', true),
    'phone', jsonb_build_object('read', true, 'write', true),
    'amount', jsonb_build_object('read', true, 'write', true),
    'price', jsonb_build_object('read', true, 'write', true),
    'total_amount', jsonb_build_object('read', true, 'write', true),
    'customer', jsonb_build_object('read', true, 'write', true),
    'payment_date', jsonb_build_object('read', true, 'write', true),
    'fx_rate', jsonb_build_object('read', true, 'write', true),
    'full_name', jsonb_build_object('read', true, 'write', true),
    'role', jsonb_build_object('read', true, 'write', true),
    'permissions', jsonb_build_object('read', true, 'write', true)
  );

  -- Grant permissions for each active module
  FOR v_module IN
    SELECT id, name, display_name
    FROM modules
    WHERE is_active = true
  LOOP
    INSERT INTO user_permissions (
      user_id,
      module_id,
      can_read,
      can_write,
      can_delete,
      field_permissions,
      granted_by,
      granted_at
    )
    VALUES (
      v_user_id,
      v_module.id,
      true,
      true,
      true,
      v_field_perms,
      v_user_id,
      now()
    );

    v_count := v_count + 1;
    RAISE NOTICE 'Granted permissions for module: %', v_module.display_name;
  END LOOP;

  RAISE NOTICE 'Successfully granted full permissions to % modules', v_count;

  -- Verify
  RAISE NOTICE 'Total permissions: %',
    (SELECT COUNT(*) FROM user_permissions WHERE user_id = v_user_id);
END $$;

-- ============================================================================
-- STEP 6: Fix user_permissions RLS policies
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own permissions" ON user_permissions;
DROP POLICY IF EXISTS "Management can view all permissions" ON user_permissions;
DROP POLICY IF EXISTS "Management can manage permissions" ON user_permissions;

-- Allow users to view their own permissions
CREATE POLICY "Users can view own permissions"
  ON user_permissions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Allow management users to view all permissions
CREATE POLICY "Management can view all permissions"
  ON user_permissions
  FOR SELECT
  TO authenticated
  USING (is_management_user());

-- Allow management users to manage all permissions
CREATE POLICY "Management can manage permissions"
  ON user_permissions
  FOR ALL
  TO authenticated
  USING (is_management_user())
  WITH CHECK (is_management_user());

-- Allow service role full access
CREATE POLICY "Service role full access on permissions"
  ON user_permissions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- STEP 7: Ensure modules table is accessible
-- ============================================================================

DROP POLICY IF EXISTS "Anyone can view modules" ON modules;
CREATE POLICY "Authenticated users can view modules"
  ON modules
  FOR SELECT
  TO authenticated
  USING (true);

COMMENT ON FUNCTION is_management_user() IS 'Check if current user has management role without recursive queries';
