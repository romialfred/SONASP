-- ================================================================
-- FIX USER MANAGEMENT DATABASE - COMPLETE SETUP
-- ================================================================
-- This script will check and create all missing database objects
-- for the User Management module to work properly
-- ================================================================

-- ================================================================
-- STEP 1: CHECK CURRENT user_profiles TABLE STRUCTURE
-- ================================================================

DO $$
BEGIN
  RAISE NOTICE '=== CHECKING user_profiles TABLE ===';
END $$;

-- Show current structure
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'user_profiles'
ORDER BY ordinal_position;

-- ================================================================
-- STEP 2: ADD MISSING COLUMNS TO user_profiles
-- ================================================================

DO $$
BEGIN
  -- Add two_factor_enabled if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'two_factor_enabled'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN two_factor_enabled boolean DEFAULT false;
    RAISE NOTICE '✓ Added column: two_factor_enabled';
  ELSE
    RAISE NOTICE '  Column already exists: two_factor_enabled';
  END IF;

  -- Add last_login_at if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'last_login_at'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN last_login_at timestamptz;
    RAISE NOTICE '✓ Added column: last_login_at';
  ELSE
    RAISE NOTICE '  Column already exists: last_login_at';
  END IF;

  -- Ensure is_active column exists with default
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN is_active boolean DEFAULT true;
    RAISE NOTICE '✓ Added column: is_active';
  ELSE
    RAISE NOTICE '  Column already exists: is_active';
    -- Make sure default is set
    ALTER TABLE user_profiles ALTER COLUMN is_active SET DEFAULT true;
  END IF;

  RAISE NOTICE '=== user_profiles TABLE STRUCTURE FIXED ===';
END $$;

-- ================================================================
-- STEP 3: ENSURE modules TABLE EXISTS WITH DATA
-- ================================================================

DO $$
BEGIN
  RAISE NOTICE '=== CHECKING modules TABLE ===';
END $$;

-- Create modules table if not exists
CREATE TABLE IF NOT EXISTS modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  display_name text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  category text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Check if modules table has data
DO $$
DECLARE
  module_count integer;
BEGIN
  SELECT COUNT(*) INTO module_count FROM modules;

  IF module_count = 0 THEN
    RAISE NOTICE '✓ Inserting default modules...';

    -- Insert default modules
    INSERT INTO modules (name, display_name, description, category) VALUES
      ('dashboard', 'Dashboard', 'View system dashboard and metrics', 'Core'),
      ('batch_management', 'Batch Management', 'Create and manage gold batches', 'Operations'),
      ('inventory', 'Inventory Management', 'Track gold and silver inventory', 'Operations'),
      ('sales', 'Sales Management', 'Manage gold sales and customers', 'Sales'),
      ('customers', 'Customer Management', 'Manage customer accounts and relationships', 'Sales'),
      ('payments', 'Payment Processing', 'Process and track payments', 'Finance'),
      ('receiving', 'Receiving', 'Receive and verify shipments', 'Operations'),
      ('refining', 'Refining', 'Manage refining processes', 'Operations'),
      ('reports', 'Reports & Analytics', 'Generate reports and view analytics', 'Analytics'),
      ('user_management', 'User Management', 'Manage user accounts and permissions', 'Administration'),
      ('system_settings', 'System Settings', 'Configure system parameters', 'Administration'),
      ('audit_trail', 'Audit Trail', 'View system audit logs', 'Administration')
    ON CONFLICT (name) DO UPDATE
    SET display_name = EXCLUDED.display_name,
        description = EXCLUDED.description,
        category = EXCLUDED.category,
        updated_at = now();

    RAISE NOTICE '✓ Default modules created';
  ELSE
    RAISE NOTICE '  modules table already has % entries', module_count;
  END IF;
END $$;

-- ================================================================
-- STEP 4: ENSURE user_permissions TABLE EXISTS
-- ================================================================

DO $$
BEGIN
  RAISE NOTICE '=== CHECKING user_permissions TABLE ===';
END $$;

-- Create user_permissions table if not exists
CREATE TABLE IF NOT EXISTS user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE,
  module_id uuid REFERENCES modules(id) ON DELETE CASCADE,
  can_read boolean DEFAULT false,
  can_write boolean DEFAULT false,
  can_delete boolean DEFAULT false,
  field_permissions jsonb DEFAULT '{}'::jsonb,
  granted_by uuid REFERENCES user_profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, module_id)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id
  ON user_permissions(user_id);

CREATE INDEX IF NOT EXISTS idx_user_permissions_module_id
  ON user_permissions(module_id);

-- ================================================================
-- STEP 5: ENABLE RLS ON ALL TABLES
-- ================================================================

DO $$
BEGIN
  RAISE NOTICE '=== ENABLING ROW LEVEL SECURITY ===';
END $$;

-- Enable RLS on user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Enable RLS on modules
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;

-- Enable RLS on user_permissions
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- STEP 6: CREATE/UPDATE RLS POLICIES FOR user_profiles
-- ================================================================

DO $$
BEGIN
  RAISE NOTICE '=== SETTING UP RLS POLICIES FOR user_profiles ===';
END $$;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Management can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Management can update all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Management can insert profiles" ON user_profiles;

-- Policy: Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Policy: Management can view all profiles
CREATE POLICY "Management can view all profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles AS up
      WHERE up.id = auth.uid()
        AND up.role = 'management'
    )
  );

-- Policy: Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Policy: Management can update all profiles
CREATE POLICY "Management can update all profiles"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles AS up
      WHERE up.id = auth.uid()
        AND up.role = 'management'
    )
  );

-- Policy: Management can insert new profiles (for Edge Function)
CREATE POLICY "Management can insert profiles"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles AS up
      WHERE up.id = auth.uid()
        AND up.role = 'management'
    )
  );

-- ================================================================
-- STEP 7: CREATE/UPDATE RLS POLICIES FOR modules
-- ================================================================

DO $$
BEGIN
  RAISE NOTICE '=== SETTING UP RLS POLICIES FOR modules ===';
END $$;

-- Drop existing policies
DROP POLICY IF EXISTS "Anyone can view active modules" ON modules;
DROP POLICY IF EXISTS "Management can manage modules" ON modules;

-- Policy: Authenticated users can view active modules
CREATE POLICY "Anyone can view active modules"
  ON modules FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Policy: Management can manage modules
CREATE POLICY "Management can manage modules"
  ON modules FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND role = 'management'
    )
  );

-- ================================================================
-- STEP 8: CREATE/UPDATE RLS POLICIES FOR user_permissions
-- ================================================================

DO $$
BEGIN
  RAISE NOTICE '=== SETTING UP RLS POLICIES FOR user_permissions ===';
END $$;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own permissions" ON user_permissions;
DROP POLICY IF EXISTS "Management can view all permissions" ON user_permissions;
DROP POLICY IF EXISTS "Management can manage permissions" ON user_permissions;

-- Policy: Users can view their own permissions
CREATE POLICY "Users can view own permissions"
  ON user_permissions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Policy: Management can view all permissions
CREATE POLICY "Management can view all permissions"
  ON user_permissions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND role = 'management'
    )
  );

-- Policy: Management can manage all permissions
CREATE POLICY "Management can manage permissions"
  ON user_permissions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
        AND role = 'management'
    )
  );

-- ================================================================
-- STEP 9: GRANT SERVICE ROLE PERMISSIONS
-- ================================================================

DO $$
BEGIN
  RAISE NOTICE '=== GRANTING SERVICE ROLE PERMISSIONS ===';
END $$;

-- Grant full access to service_role (used by Edge Functions)
GRANT ALL ON user_profiles TO service_role;
GRANT ALL ON modules TO service_role;
GRANT ALL ON user_permissions TO service_role;

-- Grant usage on sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- ================================================================
-- STEP 10: CREATE HELPER FUNCTION FOR PROFILE CREATION
-- ================================================================

-- Function to create user profile (called by Edge Function)
CREATE OR REPLACE FUNCTION create_user_profile(
  p_user_id uuid,
  p_email text,
  p_full_name text,
  p_phone text DEFAULT NULL,
  p_role text DEFAULT 'factory',
  p_is_active boolean DEFAULT true
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile_id uuid;
BEGIN
  -- Insert user profile
  INSERT INTO user_profiles (
    id,
    email,
    full_name,
    phone,
    role,
    is_active,
    two_factor_enabled,
    created_at,
    updated_at
  ) VALUES (
    p_user_id,
    p_email,
    p_full_name,
    p_phone,
    p_role,
    p_is_active,
    false,
    now(),
    now()
  )
  RETURNING id INTO v_profile_id;

  RETURN v_profile_id;
END;
$$;

-- Grant execute permission to service_role
GRANT EXECUTE ON FUNCTION create_user_profile TO service_role;

-- ================================================================
-- STEP 11: VERIFY EVERYTHING
-- ================================================================

DO $$
DECLARE
  profile_count integer;
  module_count integer;
  permission_count integer;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== VERIFICATION ===';
  RAISE NOTICE '';

  -- Count tables
  SELECT COUNT(*) INTO profile_count FROM user_profiles;
  SELECT COUNT(*) INTO module_count FROM modules;
  SELECT COUNT(*) INTO permission_count FROM user_permissions;

  RAISE NOTICE '✓ user_profiles: % records', profile_count;
  RAISE NOTICE '✓ modules: % records', module_count;
  RAISE NOTICE '✓ user_permissions: % records', permission_count;
  RAISE NOTICE '';

  -- Verify current user
  IF EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND role = 'management'
  ) THEN
    RAISE NOTICE '✓ Current user has management role';
  ELSE
    RAISE NOTICE '⚠ WARNING: Current user does not have management role!';
    RAISE NOTICE '  Run this to fix:';
    RAISE NOTICE '  UPDATE user_profiles SET role = ''management'' WHERE id = auth.uid();';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '=== SETUP COMPLETE ===';
  RAISE NOTICE '';
END $$;

-- ================================================================
-- FINAL: SHOW CURRENT STRUCTURE
-- ================================================================

\echo ''
\echo '=== CURRENT user_profiles STRUCTURE ==='
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'user_profiles'
ORDER BY ordinal_position;

\echo ''
\echo '=== MODULES LIST ==='
SELECT id, name, display_name, category, is_active
FROM modules
ORDER BY category, display_name;

\echo ''
\echo '=== RLS POLICIES ==='
SELECT
  schemaname,
  tablename,
  policyname,
  cmd as operation,
  qual as using_expression,
  with_check as check_expression
FROM pg_policies
WHERE tablename IN ('user_profiles', 'modules', 'user_permissions')
ORDER BY tablename, policyname;
