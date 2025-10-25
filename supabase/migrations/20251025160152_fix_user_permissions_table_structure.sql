/*
  # Fix User Permissions Table Structure

  1. Changes
    - Drop incorrect user_permissions table structure
    - Recreate with proper module-based permission structure
    - Add module_id, can_read, can_write, can_delete columns
    - Add field_permissions JSONB column

  2. Security
    - Enable RLS with proper policies
    - Management role can manage all permissions
    - Users can view their own permissions
*/

-- Drop existing table and recreate with correct structure
DROP TABLE IF EXISTS user_permissions CASCADE;

CREATE TABLE user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  module_id uuid REFERENCES modules(id) ON DELETE CASCADE NOT NULL,
  can_read boolean DEFAULT false NOT NULL,
  can_write boolean DEFAULT false NOT NULL,
  can_delete boolean DEFAULT false NOT NULL,
  field_permissions jsonb DEFAULT '{}'::jsonb,
  granted_by uuid REFERENCES user_profiles(id),
  granted_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, module_id)
);

-- Enable RLS
ALTER TABLE user_permissions ENABLE ROW LEVEL SECURITY;

-- Policies
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

CREATE POLICY "Management can insert permissions"
  ON user_permissions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'management'
    )
  );

CREATE POLICY "Management can update permissions"
  ON user_permissions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'management'
    )
  );

CREATE POLICY "Management can delete permissions"
  ON user_permissions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'management'
    )
  );

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_permissions_module_id ON user_permissions(module_id);

-- Add comments
COMMENT ON TABLE user_permissions IS 'Granular permissions per user per module';
COMMENT ON COLUMN user_permissions.field_permissions IS 'Field-level permissions stored as JSON: { "field_name": { "read": boolean, "write": boolean } }';
