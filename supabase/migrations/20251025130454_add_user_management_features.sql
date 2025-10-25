/*
  # User Management Features

  ## Overview
  Adds missing tables and columns for comprehensive user management:
  - modules table for permission management
  - user_invitations for invitation workflow
  - Additional user_profiles columns

  ## New Tables
  - modules: System modules for granular permissions
  - user_invitations: Track invitation workflow

  ## Updated Tables
  - user_profiles: Add password and security columns

  ## Security
  - RLS enabled on all tables
  - Management role controls access
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

ALTER TABLE modules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Everyone can read active modules" ON modules;
CREATE POLICY "Everyone can read active modules"
  ON modules FOR SELECT
  TO authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "Management can manage modules" ON modules;
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

ALTER TABLE user_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Management can manage invitations" ON user_invitations;
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

-- Add missing columns to user_profiles
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
    WHERE table_name = 'user_profiles' AND column_name = 'account_locked_until'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN account_locked_until timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'invitation_id'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN invitation_id uuid;
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
  SELECT id INTO v_module_id
  FROM modules
  WHERE name = p_module_name AND is_active = true;

  IF v_module_id IS NULL THEN
    RETURN false;
  END IF;

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