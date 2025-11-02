-- ================================================================
-- QUICK FIX FOR USER CREATION - EXECUTE THIS NOW
-- ================================================================
-- Copy and paste this entire script into Supabase SQL Editor
-- Then click "Run" button
-- ================================================================

-- STEP 1: Add missing columns to user_profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS two_factor_enabled boolean DEFAULT false;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS last_login_at timestamptz;
ALTER TABLE user_profiles ALTER COLUMN is_active SET DEFAULT true;

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

-- STEP 7: Drop old policies (if they exist)
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

-- STEP 11: Grant permissions to service_role (used by Edge Functions)
GRANT ALL ON user_profiles TO service_role;
GRANT ALL ON modules TO service_role;
GRANT ALL ON user_permissions TO service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- STEP 12: Ensure your user has management role
-- IMPORTANT: Replace 'your-email@example.com' with YOUR actual email
UPDATE user_profiles
SET role = 'management', is_active = true
WHERE email = 'your-email@example.com';

-- If above returns 0 rows, create your profile
-- (This will only work if you're logged in)
INSERT INTO user_profiles (id, email, full_name, role, is_active, two_factor_enabled)
SELECT
  auth.uid(),
  (SELECT email FROM auth.users WHERE id = auth.uid()),
  'Admin User',
  'management',
  true,
  false
WHERE NOT EXISTS (
  SELECT 1 FROM user_profiles WHERE id = auth.uid()
);

-- ================================================================
-- VERIFICATION - Run this to check everything is OK
-- ================================================================

-- Check your profile
SELECT
  'YOUR PROFILE:' as info,
  id,
  email,
  full_name,
  role,
  is_active,
  two_factor_enabled
FROM user_profiles
WHERE id = auth.uid();

-- Check modules count
SELECT
  'MODULES COUNT:' as info,
  COUNT(*) as total_modules
FROM modules;

-- Show user_profiles structure
SELECT
  'USER_PROFILES COLUMNS:' as info,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'user_profiles'
ORDER BY ordinal_position;

-- ================================================================
-- ALL DONE! Now test user creation in your application
-- ================================================================
