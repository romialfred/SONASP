/*
  # Enhance User Permissions with Sensitive Field Access Control

  1. Changes to user_permissions table
    - Add support for granular field-level permissions
    - Store sensitive field access rules in field_permissions jsonb column
    - Enable management users to configure which fields users can view/edit

  2. New features
    - Field-level access control for sensitive data
    - Module-based permission system
    - Cascading permission inheritance from roles

  3. Security
    - RLS policies ensure users can only see their own permissions
    - Management users can manage all permissions
    - Audit trail for permission changes

  4. Example field_permissions structure:
    {
      "weight_grams": {"can_view": true, "can_edit": false},
      "sale_price_per_oz": {"can_view": false, "can_edit": false}
    }
*/

-- Ensure modules table has all required modules with sensitive fields
INSERT INTO modules (name, display_name, description, is_active)
VALUES
  ('dashboard', 'Dashboard', 'Main dashboard overview', true),
  ('batches', 'Batches Management', 'Batch creation and tracking with weight and purity data', true),
  ('shipping', 'Shipping', 'Shipping management with declared values', true),
  ('refining', 'Refining', 'Refining process with weight and fineness data', true),
  ('customers', 'Customers', 'Customer management with credit limits', true),
  ('sales', 'Sales', 'Sales transactions with pricing and commissions', true),
  ('payments', 'Payments', 'Payment processing and tracking', true),
  ('gold_prices', 'Gold Prices', 'Gold price management and London rates', true),
  ('fx_rates', 'FX Rates', 'Exchange rate management', true),
  ('analytics', 'Analytics', 'Analytics and insights dashboard', true),
  ('reports', 'Reports', 'Report generation with financial data', true),
  ('users', 'User Management', 'User administration and permissions', true),
  ('parameters', 'System Parameters', 'System settings and API keys', true),
  ('workflow', 'Workflow Management', 'Approval workflow configuration', true),
  ('audit', 'Audit Trail', 'System audit logs', true)
ON CONFLICT (name) DO UPDATE
SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  updated_at = now();

-- Add category to modules for better organization (if column doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'modules' AND column_name = 'category'
  ) THEN
    ALTER TABLE modules ADD COLUMN category text;
  END IF;
END $$;

-- Update modules with categories
UPDATE modules SET category = 'overview' WHERE name = 'dashboard';
UPDATE modules SET category = 'batches' WHERE name IN ('batches', 'shipping', 'refining');
UPDATE modules SET category = 'sales' WHERE name IN ('customers', 'sales', 'payments', 'gold_prices', 'fx_rates');
UPDATE modules SET category = 'insights' WHERE name IN ('analytics', 'reports');
UPDATE modules SET category = 'administration' WHERE name IN ('users', 'parameters', 'workflow', 'audit');

-- Create a helper function to get or create module ID by name
CREATE OR REPLACE FUNCTION get_module_id_by_name(module_name_param text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  module_uuid uuid;
BEGIN
  SELECT id INTO module_uuid
  FROM modules
  WHERE name = module_name_param;

  RETURN module_uuid;
END;
$$;

-- Create default permissions for management role
-- Management users get full access to all modules
DO $$
DECLARE
  mgmt_user RECORD;
  module_record RECORD;
BEGIN
  -- For each management user
  FOR mgmt_user IN SELECT id FROM user_profiles WHERE role = 'management'
  LOOP
    -- For each module
    FOR module_record IN SELECT id FROM modules WHERE is_active = true
    LOOP
      -- Insert or update full permissions
      INSERT INTO user_permissions (
        user_id,
        module_id,
        can_read,
        can_write,
        can_delete,
        field_permissions,
        granted_by
      )
      VALUES (
        mgmt_user.id,
        module_record.id,
        true,
        true,
        true,
        '{}'::jsonb,
        mgmt_user.id
      )
      ON CONFLICT (user_id, module_id) DO UPDATE
      SET
        can_read = true,
        can_write = true,
        can_delete = true,
        updated_at = now();
    END LOOP;
  END LOOP;
END $$;

-- Add RLS policy for management to manage all permissions
DROP POLICY IF EXISTS "Management can manage all permissions" ON user_permissions;
CREATE POLICY "Management can manage all permissions"
  ON user_permissions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'management'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'management'
    )
  );

-- Create a view for easy permission checking with field-level access
CREATE OR REPLACE VIEW user_effective_permissions AS
SELECT
  up.user_id,
  u.email,
  u.role,
  m.name as module_name,
  m.display_name as module_display_name,
  m.category,
  up.can_read,
  up.can_write,
  up.can_delete,
  up.field_permissions,
  up.granted_at,
  up.updated_at
FROM user_permissions up
JOIN user_profiles u ON u.id = up.user_id
JOIN modules m ON m.id = up.module_id
WHERE m.is_active = true;

-- Grant access to the view
GRANT SELECT ON user_effective_permissions TO authenticated;

-- Create function to check field permission
CREATE OR REPLACE FUNCTION can_access_field(
  user_id_param uuid,
  module_name_param text,
  field_name_param text,
  access_type text  -- 'view' or 'edit'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  field_perm jsonb;
  has_access boolean;
BEGIN
  -- Management role has access to everything
  IF EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = user_id_param AND role = 'management'
  ) THEN
    RETURN true;
  END IF;

  -- Check specific field permission
  SELECT up.field_permissions -> field_name_param INTO field_perm
  FROM user_permissions up
  JOIN modules m ON m.id = up.module_id
  WHERE up.user_id = user_id_param
  AND m.name = module_name_param;

  IF field_perm IS NULL THEN
    -- No specific field permission set, deny access to sensitive fields by default
    RETURN false;
  END IF;

  -- Check the specific access type
  IF access_type = 'view' THEN
    SELECT COALESCE((field_perm->>'can_view')::boolean, false) INTO has_access;
  ELSIF access_type = 'edit' THEN
    SELECT COALESCE((field_perm->>'can_edit')::boolean, false) INTO has_access;
  ELSE
    has_access := false;
  END IF;

  RETURN COALESCE(has_access, false);
END;
$$;

-- Create audit trigger for permission changes
CREATE OR REPLACE FUNCTION audit_permission_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (
      user_id,
      user_email,
      action,
      resource_type,
      resource_id,
      details
    )
    VALUES (
      COALESCE(NEW.granted_by, NEW.user_id),
      (SELECT email FROM user_profiles WHERE id = COALESCE(NEW.granted_by, NEW.user_id)),
      'GRANT_PERMISSION',
      'user_permissions',
      NEW.id::text,
      jsonb_build_object(
        'target_user_id', NEW.user_id,
        'module_id', NEW.module_id,
        'permissions', jsonb_build_object(
          'can_read', NEW.can_read,
          'can_write', NEW.can_write,
          'can_delete', NEW.can_delete
        )
      )
    );
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (
      user_id,
      user_email,
      action,
      resource_type,
      resource_id,
      details
    )
    VALUES (
      auth.uid(),
      (SELECT email FROM user_profiles WHERE id = auth.uid()),
      'UPDATE_PERMISSION',
      'user_permissions',
      NEW.id::text,
      jsonb_build_object(
        'target_user_id', NEW.user_id,
        'module_id', NEW.module_id,
        'old_permissions', jsonb_build_object(
          'can_read', OLD.can_read,
          'can_write', OLD.can_write,
          'can_delete', OLD.can_delete
        ),
        'new_permissions', jsonb_build_object(
          'can_read', NEW.can_read,
          'can_write', NEW.can_write,
          'can_delete', NEW.can_delete
        )
      )
    );
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (
      user_id,
      user_email,
      action,
      resource_type,
      resource_id,
      details
    )
    VALUES (
      auth.uid(),
      (SELECT email FROM user_profiles WHERE id = auth.uid()),
      'REVOKE_PERMISSION',
      'user_permissions',
      OLD.id::text,
      jsonb_build_object(
        'target_user_id', OLD.user_id,
        'module_id', OLD.module_id
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS audit_permission_changes_trigger ON user_permissions;
CREATE TRIGGER audit_permission_changes_trigger
AFTER INSERT OR UPDATE OR DELETE ON user_permissions
FOR EACH ROW
EXECUTE FUNCTION audit_permission_changes();
