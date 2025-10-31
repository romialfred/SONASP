/*
  # Fix RLS Recursion and Grant Admin Access

  1. Changes
    - Drop all conflicting user_profiles RLS policies
    - Create simple non-recursive policies
    - Update romuald.tiegnan@gmail.com to management role
    - Grant full permissions to all modules

  2. Security
    - Users can view/update own profile only
    - Service role has full access (for admin functions)
    - No recursive policy checks
*/

-- ============================================================================
-- PART 1: Drop all existing user_profiles policies to start fresh
-- ============================================================================
DROP POLICY IF EXISTS "user_profiles_select_own" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_update_own" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_delete" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_management_select_all" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_management_update_all" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_service_role_all" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_service_role" ON user_profiles;

-- ============================================================================
-- PART 2: Create simple, non-recursive policies
-- ============================================================================

-- Users can view their own profile
CREATE POLICY "user_profiles_select_own"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Users can update their own profile
CREATE POLICY "user_profiles_update_own"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Service role can do everything (bypasses RLS)
CREATE POLICY "user_profiles_service_role"
  ON user_profiles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- PART 3: Update romuald.tiegnan@gmail.com to management role with full access
-- ============================================================================

-- Update user role to management
UPDATE user_profiles
SET
  role = 'management',
  is_active = true,
  full_name = COALESCE(full_name, 'Romuald Tiegnan')
WHERE email = 'romuald.tiegnan@gmail.com';

-- ============================================================================
-- PART 4: Grant full permissions to all modules
-- ============================================================================

DO $$
DECLARE
  v_user_id uuid;
  v_module_id uuid;
  v_module_count int := 0;
BEGIN
  -- Get user ID
  SELECT id INTO v_user_id
  FROM user_profiles
  WHERE email = 'romuald.tiegnan@gmail.com';

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'User not found: romuald.tiegnan@gmail.com';
    RAISE NOTICE 'Please ensure the user has been created through Supabase Auth';
    RETURN;
  END IF;

  RAISE NOTICE 'Found user ID: %', v_user_id;

  -- Delete existing permissions for this user
  DELETE FROM user_permissions WHERE user_id = v_user_id;
  RAISE NOTICE 'Deleted existing permissions';

  -- Grant full access to all active modules
  FOR v_module_id IN
    SELECT id FROM modules WHERE is_active = true
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
      true,  -- can_read
      true,  -- can_write
      true,  -- can_delete
      true,  -- can_approve
      '{}'::jsonb  -- field_permissions (empty = all fields allowed)
    )
    ON CONFLICT (user_id, module_id)
    DO UPDATE SET
      can_read = true,
      can_write = true,
      can_delete = true,
      can_approve = true,
      field_permissions = '{}'::jsonb;

    v_module_count := v_module_count + 1;
  END LOOP;

  RAISE NOTICE 'Granted full access to % modules', v_module_count;

  -- Verify permissions were created
  RAISE NOTICE 'Total permissions for user: %',
    (SELECT COUNT(*) FROM user_permissions WHERE user_id = v_user_id);
END $$;
