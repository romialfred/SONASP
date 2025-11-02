-- ================================================================
-- FIX DATABASE STRUCTURE FOR USER CREATION
-- ================================================================
-- This script ONLY fixes the database structure
-- It does NOT try to create/update your user profile
-- ================================================================

-- STEP 1: Add missing columns to user_profiles
DO $$
BEGIN
  -- Add two_factor_enabled
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'two_factor_enabled'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN two_factor_enabled boolean DEFAULT false;
    RAISE NOTICE '✓ Added column: two_factor_enabled';
  ELSE
    RAISE NOTICE '  Column already exists: two_factor_enabled';
  END IF;

  -- Add last_login_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'last_login_at'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN last_login_at timestamptz;
    RAISE NOTICE '✓ Added column: last_login_at';
  ELSE
    RAISE NOTICE '  Column already exists: last_login_at';
  END IF;

  -- Ensure is_active has default
  ALTER TABLE user_profiles ALTER COLUMN is_active SET DEFAULT true;
  RAISE NOTICE '✓ Set default for is_active column';
END $$;

-- STEP 2: Create modules table if not exists
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

-- STEP 3: Insert default modules
INSERT INTO modules (name, display_name, description, category) VALUES
  ('dashboard', 'Dashboard', 'View system dashboard and metrics', 'Core'),
  ('batch_management', 'Batch Management', 'Create and manage gold batches', 'Operations'),
  ('inventory', 'Inventory Management', 'Track gold and silver inventory', 'Operations'),
  ('sales', 'Sales Management', 'Manage gold sales and customers', 'Sales'),
  ('customers', 'Customer Management', 'Manage customer accounts', 'Sales'),
  ('payments', 'Payment Processing', 'Process and track payments', 'Finance'),
  ('receiving', 'Receiving', 'Receive and verify shipments', 'Operations'),
  ('refining', 'Refining', 'Manage refining processes', 'Operations'),
  ('reports', 'Reports & Analytics', 'Generate reports', 'Analytics'),
  ('user_management', 'User Management', 'Manage user accounts', 'Administration'),
  ('system_settings', 'System Settings', 'Configure system', 'Administration'),
  ('audit_trail', 'Audit Trail', 'View system logs', 'Administration')
ON CONFLICT (name) DO UPDATE
SET display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    category = EXCLUDED.category;

-- STEP 4: Create user_permissions table
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

-- STEP 5: Create indexes
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_module_id ON user_permissions(module_id);

-- STEP 6: Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

-- STEP 7: Drop old policies
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Management can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Management can update all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Management can insert profiles" ON user_profiles;
DROP POLICY IF EXISTS "Anyone can view active modules" ON modules;
DROP POLICY IF EXISTS "Management can manage modules" ON modules;
DROP POLICY IF EXISTS "Users can view own permissions" ON user_permissions;
DROP POLICY IF EXISTS "Management can view all permissions" ON user_permissions;
DROP POLICY IF EXISTS "Management can manage permissions" ON user_permissions;

-- STEP 8: Create RLS policies for user_profiles
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Management can view all profiles"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'management'
    )
  );

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Management can update all profiles"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'management'
    )
  );

CREATE POLICY "Management can insert profiles"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'management'
    )
  );

-- STEP 9: Create RLS policies for modules
CREATE POLICY "Anyone can view active modules"
  ON modules FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Management can manage modules"
  ON modules FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'management'
    )
  );

-- STEP 10: Create RLS policies for user_permissions
CREATE POLICY "Users can view own permissions"
  ON user_permissions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Management can view all permissions"
  ON user_permissions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'management'
    )
  );

CREATE POLICY "Management can manage permissions"
  ON user_permissions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'management'
    )
  );

-- STEP 11: Grant permissions to service_role
GRANT ALL ON user_profiles TO service_role;
GRANT ALL ON modules TO service_role;
GRANT ALL ON user_permissions TO service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- ================================================================
-- VERIFICATION
-- ================================================================

-- Show structure
SELECT
  'user_profiles columns:' as info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'user_profiles'
ORDER BY ordinal_position;

-- Count modules
SELECT 'Modules count:' as info, COUNT(*) as count FROM modules;

-- Show all users (you need to be logged in to see this)
SELECT
  'All user profiles:' as info,
  id,
  email,
  full_name,
  role,
  is_active
FROM user_profiles;
