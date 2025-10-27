/*
  # Grant Full Access to Romuald Tiegnan

  1. Purpose
     - Grant complete administrative access to romuald.tiegnan@gmail.com
     - Ensure user has full permissions across all modules
     - Set user as management role with all rights
     - Bypass all permission checks for this user

  2. Changes
     - Update user profile to management role
     - Grant all permissions on all modules
     - Enable all field-level permissions including sensitive fields
     - Set user as active and verified
*/

-- First, ensure the user profile exists and is set to management role
DO $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Find the user ID from auth.users
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'romuald.tiegnan@gmail.com';

  IF v_user_id IS NOT NULL THEN
    -- Update or insert user profile with full management access
    INSERT INTO user_profiles (
      id,
      email,
      full_name,
      role,
      is_active,
      email_verified,
      created_at,
      updated_at
    )
    VALUES (
      v_user_id,
      'romuald.tiegnan@gmail.com',
      'Romuald Tiegnan',
      'management',
      true,
      true,
      now(),
      now()
    )
    ON CONFLICT (id)
    DO UPDATE SET
      role = 'management',
      is_active = true,
      email_verified = true,
      full_name = COALESCE(user_profiles.full_name, 'Romuald Tiegnan'),
      updated_at = now();

    -- Delete any existing permissions for this user to start fresh
    DELETE FROM user_permissions WHERE user_id = v_user_id;

    -- Grant full permissions on ALL modules
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
    SELECT
      v_user_id,
      m.id,
      true,  -- can_read
      true,  -- can_write
      true,  -- can_delete
      -- Grant all field permissions (both read and write for all fields)
      jsonb_object_agg(
        field_name,
        jsonb_build_object('read', true, 'write', true)
      ) FILTER (WHERE field_name IS NOT NULL),
      v_user_id,  -- granted by self
      now()
    FROM modules m
    -- Generate all possible field names for comprehensive permissions
    LEFT JOIN LATERAL (
      SELECT unnest(ARRAY[
        -- Batch fields
        'batch_number', 'weight', 'status', 'origin_site', 'destination', 'shipping_date', 'comments',
        'weight_grams', 'final_purity_percent', 'assay_value', 'declared_value', 'insurance_amount',
        -- Receiving and refining
        'received_weight', 'variance', 'received_date', 'condition_notes', 'photos',
        'pre_melting_weight', 'post_melting_weight', 'fineness_percentage', 'metal_retained', 'final_fine',
        'fineness_percent', 'metal_retained_percent', 'final_fine_grams',
        -- Sales fields
        'customer', 'quantity', 'price', 'london_am_rate', 'gross_proceeds', 'net_proceeds',
        'sale_price_per_oz', 'total_amount', 'commission_amount', 'freight_costs', 'other_costs',
        -- Customer fields
        'name', 'email', 'country', 'phone', 'contact_person', 'payment_terms',
        'credit_limit', 'payment_history', 'outstanding_balance', 'total_purchases',
        -- Payment fields
        'invoice_number', 'amount', 'currency', 'fx_rate', 'expected_date', 'actual_date',
        'bank_name', 'reference_number', 'proof_document', 'account_number', 'transaction_id',
        'payment_date', 'bank_details', 'approval_notes', 'document_type', 'document_name',
        'proof_url', 'notes', 'verification_status', 'payment_method', 'due_date',
        -- Shipping fields
        'transport_company', 'tracking_number', 'departure_date', 'arrival_date', 'customs_docs',
        -- Price fields
        'london_pm_rate', 'spot_price', 'usd_cfa_rate', 'usd_gnf_rate', 'exchange_spread',
        -- Analytics fields
        'sales_metrics', 'revenue_charts', 'customer_performance', 'inventory_levels',
        'financial_reports', 'operational_reports', 'compliance_reports', 'custom_reports',
        'financial_data', 'profit_margins',
        -- System fields
        'full_name', 'role', 'permissions', 'last_login',
        'company_info', 'currency_settings', 'email_templates', 'thresholds',
        'system_settings', 'api_keys', 'action', 'user', 'timestamp', 'ip_address', 'changes'
      ]) AS field_name
    ) fields ON true
    WHERE m.is_active = true
    GROUP BY m.id;

    RAISE NOTICE 'Full access granted to romuald.tiegnan@gmail.com (User ID: %)', v_user_id;
  ELSE
    RAISE NOTICE 'User romuald.tiegnan@gmail.com not found in auth.users';
  END IF;
END $$;

-- Create a function to ensure this user always has full access
CREATE OR REPLACE FUNCTION ensure_romuald_full_access()
RETURNS TRIGGER AS $$
BEGIN
  -- If someone tries to modify Romuald's permissions, ensure they remain full
  IF NEW.email = 'romuald.tiegnan@gmail.com' THEN
    NEW.role := 'management';
    NEW.is_active := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to maintain full access
DROP TRIGGER IF EXISTS maintain_romuald_access ON user_profiles;
CREATE TRIGGER maintain_romuald_access
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  WHEN (OLD.email = 'romuald.tiegnan@gmail.com')
  EXECUTE FUNCTION ensure_romuald_full_access();

-- Add a check function that bypasses all permission checks for this user
CREATE OR REPLACE FUNCTION is_super_admin(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = p_user_id
    AND email = 'romuald.tiegnan@gmail.com'
    AND role = 'management'
    AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the check_user_permission function to always allow super admin
CREATE OR REPLACE FUNCTION check_user_permission(
  p_user_id UUID,
  p_module_name TEXT,
  p_permission_type TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_module_id UUID;
  v_has_permission BOOLEAN;
  v_user_role TEXT;
BEGIN
  -- Check if user is super admin (romuald.tiegnan@gmail.com)
  IF is_super_admin(p_user_id) THEN
    RETURN TRUE;
  END IF;

  -- Get user role
  SELECT role INTO v_user_role
  FROM user_profiles
  WHERE id = p_user_id;

  -- Management role has all permissions
  IF v_user_role = 'management' THEN
    RETURN TRUE;
  END IF;

  -- Get module ID
  SELECT id INTO v_module_id
  FROM modules
  WHERE name = p_module_name;

  IF v_module_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check specific permission
  SELECT
    CASE p_permission_type
      WHEN 'read' THEN can_read
      WHEN 'write' THEN can_write
      WHEN 'delete' THEN can_delete
      ELSE FALSE
    END INTO v_has_permission
  FROM user_permissions
  WHERE user_id = p_user_id
    AND module_id = v_module_id;

  RETURN COALESCE(v_has_permission, FALSE);
END;
$$;

COMMENT ON FUNCTION is_super_admin IS 'Returns true if user is romuald.tiegnan@gmail.com with full access';
COMMENT ON FUNCTION check_user_permission IS 'Checks user permissions with super admin bypass for romuald.tiegnan@gmail.com';
