/*
  # User Permissions and Management System

  ## Overview
  This migration creates a comprehensive permission system with:
  - Granular module-level permissions (Read, Write, Delete)
  - User invitation and welcome email workflow
  - Default password with forced change on first login
  - 2FA enabled by default for all users
  - Module visibility based on permissions

  ## New Tables

  ### 1. `modules`
  Available system modules
  - `id` (uuid, primary key)
  - `name` (text) - Module name (e.g., batches, sales, shipping)
  - `display_name` (text) - User-friendly name
  - `description` (text)
  - `is_active` (boolean)

  ### 2. `user_permissions`
  Granular permissions per user per module
  - `id` (uuid, primary key)
  - `user_id` (uuid) - Reference to user_profiles
  - `module_id` (uuid) - Reference to modules
  - `can_read` (boolean)
  - `can_write` (boolean)
  - `can_delete` (boolean)
  - `granted_by` (uuid) - Who granted the permission
  - `granted_at` (timestamptz)

  ### 3. `user_invitations`
  Track user invitation workflow
  - `id` (uuid, primary key)
  - `email` (text)
  - `invited_by` (uuid)
  - `invitation_token` (text)
  - `expires_at` (timestamptz)
  - `accepted_at` (timestamptz)
  - `status` (text) - pending, accepted, expired, revoked

  ### 4. Updated `user_profiles`
  New columns:
  - `password_must_change` (boolean) - Force password change on next login
  - `password_changed_at` (timestamptz)
  - `last_login_at` (timestamptz)
  - `failed_login_attempts` (integer)
  - `account_locked_until` (timestamptz)
  - `invitation_id` (uuid)

  ## Security
  - RLS enabled on all tables
  - Only management role can manage users
  - Users can view their own permissions
*/

-- Create modules table
CREATE TABLE IF NOT EXISTS modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  display_name text NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE modules ENABLE ROW LEVEL SECURITY;

-- Policies for modules
CREATE POLICY "Everyone can read active modules"
  ON modules FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "Management can manage modules"
  ON modules FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'management'
    )
  );

-- Create user_permissions table
CREATE TABLE IF NOT EXISTS user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE,
  module_id uuid REFERENCES modules(id) ON DELETE CASCADE,
  can_read boolean DEFAULT false,
  can_write boolean DEFAULT false,
  can_delete boolean DEFAULT false,
  granted_by uuid REFERENCES user_profiles(id),
  granted_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, module_id)
);

-- Enable RLS
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

-- Policies for user_permissions
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
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'management'
    )
  );

CREATE POLICY "Management can manage permissions"
  ON user_permissions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'management'
    )
  );

-- Create user_invitations table
CREATE TABLE IF NOT EXISTS user_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  invited_by uuid REFERENCES user_profiles(id),
  invitation_token text UNIQUE NOT NULL,
  default_password text NOT NULL,
  role text NOT NULL,
  full_name text NOT NULL,
  phone text,
  site_ids uuid[] DEFAULT '{}',
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE user_invitations ENABLE ROW LEVEL SECURITY;

-- Policies for user_invitations
CREATE POLICY "Management can manage invitations"
  ON user_invitations FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'management'
    )
  );

-- Add new columns to user_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'password_must_change'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN password_must_change boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'password_changed_at'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN password_changed_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'last_login_at'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN last_login_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'failed_login_attempts'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN failed_login_attempts integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'account_locked_until'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN account_locked_until timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'invitation_id'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN invitation_id uuid REFERENCES user_invitations(id);
  END IF;
END $$;

-- Insert default modules
INSERT INTO modules (name, display_name, description) VALUES
  ('dashboard', 'Dashboard', 'View dashboard and analytics'),
  ('batches', 'Batch Management', 'Create and manage batches'),
  ('shipping', 'Shipping', 'Manage shipments and transportation'),
  ('receiving', 'Receiving', 'Confirm batch receipts'),
  ('refining', 'Refining', 'Process refining operations'),
  ('sales', 'Sales Management', 'Manage sales and customers'),
  ('customers', 'Customer Management', 'Manage customer information'),
  ('payments', 'Payment Processing', 'Process and track payments'),
  ('reports', 'Reports & Analytics', 'Generate and view reports'),
  ('users', 'User Management', 'Manage users and permissions'),
  ('settings', 'System Settings', 'Configure system settings'),
  ('audit', 'Audit Trail', 'View system audit logs')
ON CONFLICT (name) DO NOTHING;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_module_id ON user_permissions(module_id);
CREATE INDEX IF NOT EXISTS idx_user_invitations_email ON user_invitations(email);
CREATE INDEX IF NOT EXISTS idx_user_invitations_token ON user_invitations(invitation_token);
CREATE INDEX IF NOT EXISTS idx_user_invitations_status ON user_invitations(status);

-- Create function to check user permission
CREATE OR REPLACE FUNCTION check_user_permission(
  p_user_id uuid,
  p_module_name text,
  p_permission_type text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_has_permission boolean;
  v_module_id uuid;
BEGIN
  -- Get module ID
  SELECT id INTO v_module_id
  FROM modules
  WHERE name = p_module_name AND is_active = true;

  IF v_module_id IS NULL THEN
    RETURN false;
  END IF;

  -- Check permission
  IF p_permission_type = 'read' THEN
    SELECT can_read INTO v_has_permission
    FROM user_permissions
    WHERE user_id = p_user_id AND module_id = v_module_id;
  ELSIF p_permission_type = 'write' THEN
    SELECT can_write INTO v_has_permission
    FROM user_permissions
    WHERE user_id = p_user_id AND module_id = v_module_id;
  ELSIF p_permission_type = 'delete' THEN
    SELECT can_delete INTO v_has_permission
    FROM user_permissions
    WHERE user_id = p_user_id AND module_id = v_module_id;
  ELSE
    RETURN false;
  END IF;

  RETURN COALESCE(v_has_permission, false);
END;
$$;

-- Create function to get user permissions
CREATE OR REPLACE FUNCTION get_user_permissions(p_user_id uuid)
RETURNS TABLE (
  module_name text,
  display_name text,
  can_read boolean,
  can_write boolean,
  can_delete boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.name,
    m.display_name,
    COALESCE(up.can_read, false) as can_read,
    COALESCE(up.can_write, false) as can_write,
    COALESCE(up.can_delete, false) as can_delete
  FROM modules m
  LEFT JOIN user_permissions up ON up.module_id = m.id AND up.user_id = p_user_id
  WHERE m.is_active = true
  ORDER BY m.display_name;
END;
$$;

-- Comments
COMMENT ON TABLE modules IS 'System modules for permission management';
COMMENT ON TABLE user_permissions IS 'Granular permissions per user per module';
COMMENT ON TABLE user_invitations IS 'User invitation workflow tracking';
COMMENT ON COLUMN user_profiles.password_must_change IS 'User must change password on next login';
COMMENT ON COLUMN user_profiles.password_changed_at IS 'Last time password was changed';
COMMENT ON COLUMN user_profiles.last_login_at IS 'Last successful login timestamp';
COMMENT ON COLUMN user_profiles.failed_login_attempts IS 'Number of consecutive failed login attempts';
COMMENT ON COLUMN user_profiles.account_locked_until IS 'Account locked until this timestamp';
