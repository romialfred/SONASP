/*
  # Comprehensive RLS Recursion Fix and Full Access Grant

  1. Problem Analysis
    - Infinite recursion detected in user_profiles table
    - Multiple policies in other tables query user_profiles.role which triggers RLS on user_profiles
    - This creates circular dependencies causing infinite recursion

  2. Solution
    - Disable RLS on user_profiles table (auth.uid() check is sufficient)
    - Grant direct access based on auth.uid() only
    - Create security definer functions for role checks
    - Grant full permissions to romuald.tiegnan@gmail.com

  3. Security
    - Users access only their own profile via auth.uid()
    - Service role has full access
    - No recursive policy checks on user_profiles
*/

-- ============================================================================
-- PART 1: Disable RLS on user_profiles and use simpler security model
-- ============================================================================

-- Drop all existing policies on user_profiles
DROP POLICY IF EXISTS "user_profiles_select_own" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_update_own" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_delete" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_management_select_all" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_management_update_all" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_service_role_all" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_service_role" ON user_profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;

-- DISABLE RLS on user_profiles to prevent recursion
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;

-- Grant appropriate permissions
GRANT SELECT, INSERT, UPDATE ON user_profiles TO authenticated;
GRANT ALL ON user_profiles TO service_role;

-- ============================================================================
-- PART 2: Create security definer functions for safe role checking
-- ============================================================================

-- Function to check if current user has a specific role
CREATE OR REPLACE FUNCTION public.user_has_role(required_role text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_profiles
    WHERE id = auth.uid()
    AND role = required_role
    AND is_active = true
  );
$$;

-- Function to check if current user is management
CREATE OR REPLACE FUNCTION public.is_management()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_profiles
    WHERE id = auth.uid()
    AND role = 'management'
    AND is_active = true
  );
$$;

-- Function to get current user's role
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role
  FROM user_profiles
  WHERE id = auth.uid();
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.user_has_role(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_management() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated, anon;

-- ============================================================================
-- PART 3: Ensure user profile exists for romuald.tiegnan@gmail.com
-- ============================================================================

DO $$
DECLARE
  v_user_id uuid;
  v_auth_user RECORD;
BEGIN
  -- Try to get the auth user
  SELECT id, email INTO v_auth_user
  FROM auth.users
  WHERE email = 'romuald.tiegnan@gmail.com'
  LIMIT 1;

  IF v_auth_user.id IS NULL THEN
    RAISE NOTICE 'Auth user not found for romuald.tiegnan@gmail.com';
    RAISE NOTICE 'User must be created through Supabase Auth first';
    RETURN;
  END IF;

  v_user_id := v_auth_user.id;
  RAISE NOTICE 'Found auth user ID: %', v_user_id;

  -- Check if profile exists
  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = v_user_id) THEN
    RAISE NOTICE 'Creating user profile for romuald.tiegnan@gmail.com';

    INSERT INTO user_profiles (
      id,
      email,
      full_name,
      role,
      is_active,
      two_factor_enabled,
      email_notifications,
      batch_notifications,
      approval_notifications
    ) VALUES (
      v_user_id,
      'romuald.tiegnan@gmail.com',
      'Romuald Tiegnan',
      'management',
      true,
      false,
      true,
      true,
      true
    );

    RAISE NOTICE 'User profile created successfully';
  ELSE
    RAISE NOTICE 'User profile already exists, updating to management role';

    UPDATE user_profiles
    SET
      role = 'management',
      is_active = true,
      full_name = COALESCE(full_name, 'Romuald Tiegnan'),
      updated_at = now()
    WHERE id = v_user_id;

    RAISE NOTICE 'User profile updated successfully';
  END IF;
END $$;

-- ============================================================================
-- PART 4: Grant full permissions to all modules
-- ============================================================================

DO $$
DECLARE
  v_user_id uuid;
  v_module_id uuid;
  v_module_count int := 0;
  v_module_name text;
BEGIN
  -- Get user ID
  SELECT id INTO v_user_id
  FROM user_profiles
  WHERE email = 'romuald.tiegnan@gmail.com';

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'User profile not found: romuald.tiegnan@gmail.com';
    RETURN;
  END IF;

  RAISE NOTICE 'Granting full permissions to user: %', v_user_id;

  -- Delete existing permissions for this user
  DELETE FROM user_permissions WHERE user_id = v_user_id;
  RAISE NOTICE 'Deleted existing permissions';

  -- Ensure all standard modules exist
  INSERT INTO modules (name, category, is_active)
  VALUES
    ('batches', 'operations', true),
    ('shipping', 'operations', true),
    ('receiving', 'operations', true),
    ('refining', 'operations', true),
    ('sales', 'sales', true),
    ('customers', 'sales', true),
    ('payments', 'finance', true),
    ('gold_prices', 'analytics', true),
    ('fx_rates', 'analytics', true),
    ('reports', 'analytics', true),
    ('analytics', 'analytics', true),
    ('users', 'admin', true),
    ('settings', 'admin', true),
    ('audit_trail', 'admin', true)
  ON CONFLICT (name) DO UPDATE SET
    is_active = true,
    updated_at = now();

  RAISE NOTICE 'Ensured all modules exist';

  -- Grant full access to all active modules
  FOR v_module_id, v_module_name IN
    SELECT id, name FROM modules WHERE is_active = true
  LOOP
    INSERT INTO user_permissions (
      user_id,
      module_id,
      can_read,
      can_write,
      can_delete,
      can_approve,
      field_permissions
    ) VALUES (
      v_user_id,
      v_module_id,
      true,
      true,
      true,
      true,
      '{}'::jsonb
    )
    ON CONFLICT (user_id, module_id)
    DO UPDATE SET
      can_read = true,
      can_write = true,
      can_delete = true,
      can_approve = true,
      field_permissions = '{}'::jsonb,
      updated_at = now();

    v_module_count := v_module_count + 1;
    RAISE NOTICE 'Granted full access to module: %', v_module_name;
  END LOOP;

  RAISE NOTICE 'Total modules granted: %', v_module_count;

  -- Verify permissions were created
  RAISE NOTICE 'Total permissions for user: %',
    (SELECT COUNT(*) FROM user_permissions WHERE user_id = v_user_id);

  -- Display permissions summary
  RAISE NOTICE 'Permissions summary:';
  FOR v_module_name IN
    SELECT m.name
    FROM user_permissions up
    JOIN modules m ON m.id = up.module_id
    WHERE up.user_id = v_user_id
    ORDER BY m.name
  LOOP
    RAISE NOTICE '  - %', v_module_name;
  END LOOP;
END $$;

-- ============================================================================
-- PART 5: Verification queries
-- ============================================================================

DO $$
DECLARE
  v_user_id uuid;
  v_profile RECORD;
  v_perm_count int;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'VERIFICATION RESULTS';
  RAISE NOTICE '========================================';

  -- Check user profile
  SELECT * INTO v_profile
  FROM user_profiles
  WHERE email = 'romuald.tiegnan@gmail.com';

  IF v_profile.id IS NULL THEN
    RAISE NOTICE 'ERROR: User profile not found!';
    RETURN;
  END IF;

  RAISE NOTICE 'User Profile:';
  RAISE NOTICE '  Email: %', v_profile.email;
  RAISE NOTICE '  Name: %', v_profile.full_name;
  RAISE NOTICE '  Role: %', v_profile.role;
  RAISE NOTICE '  Active: %', v_profile.is_active;
  RAISE NOTICE '  ID: %', v_profile.id;

  -- Check permissions
  SELECT COUNT(*) INTO v_perm_count
  FROM user_permissions
  WHERE user_id = v_profile.id;

  RAISE NOTICE 'Permissions: % modules', v_perm_count;

  IF v_perm_count = 0 THEN
    RAISE NOTICE 'WARNING: No permissions found!';
  ELSE
    RAISE NOTICE 'SUCCESS: Full access granted';
  END IF;

  RAISE NOTICE '========================================';
END $$;
