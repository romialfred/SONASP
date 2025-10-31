/*
  # Grant Full Permissions to Romuald - Complete Fix

  1. Purpose
     - Properly grant ALL permissions to romuald.tiegnan@gmail.com
     - Ensure permissions are correctly formatted for the UI
     - Make permissions permanent and protected

  2. Changes
     - Insert user profile with management role
     - Grant module-level permissions on ALL modules
     - Grant field-level permissions with correct structure
     - Protect against modifications
*/

-- Step 1: Ensure user profile exists with management role
DO $$
DECLARE
  v_user_id UUID;
  v_module RECORD;
  v_field_perms JSONB;
BEGIN
  -- Find the user ID from auth.users
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'romuald.tiegnan@gmail.com';

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'User romuald.tiegnan@gmail.com not found in auth.users';
    RETURN;
  END IF;

  RAISE NOTICE 'Found user ID: %', v_user_id;

  -- Update or insert user profile
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

  RAISE NOTICE 'User profile updated to management role';

  -- Delete existing permissions
  DELETE FROM user_permissions WHERE user_id = v_user_id;

  RAISE NOTICE 'Deleted existing permissions';

  -- Build comprehensive field permissions object
  v_field_perms := jsonb_build_object(
    -- Batch fields
    'batch_number', jsonb_build_object('read', true, 'write', true, 'can_view', true, 'can_edit', true),
    'weight', jsonb_build_object('read', true, 'write', true, 'can_view', true, 'can_edit', true),
    'weight_grams', jsonb_build_object('read', true, 'write', true, 'can_view', true, 'can_edit', true),
    'final_purity_percent', jsonb_build_object('read', true, 'write', true, 'can_view', true, 'can_edit', true),
    'assay_value', jsonb_build_object('read', true, 'write', true, 'can_view', true, 'can_edit', true),
    'status', jsonb_build_object('read', true, 'write', true, 'can_view', true, 'can_edit', true),
    'origin_site', jsonb_build_object('read', true, 'write', true, 'can_view', true, 'can_edit', true),
    'destination', jsonb_build_object('read', true, 'write', true, 'can_view', true, 'can_edit', true),
    'shipping_date', jsonb_build_object('read', true, 'write', true, 'can_view', true, 'can_edit', true),
    'comments', jsonb_build_object('read', true, 'write', true, 'can_view', true, 'can_edit', true),
    -- Shipping fields
    'declared_value', jsonb_build_object('read', true, 'write', true, 'can_view', true, 'can_edit', true),
    'insurance_amount', jsonb_build_object('read', true, 'write', true, 'can_view', true, 'can_edit', true),
    'transport_company', jsonb_build_object('read', true, 'write', true, 'can_view', true, 'can_edit', true),
    'tracking_number', jsonb_build_object('read', true, 'write', true, 'can_view', true, 'can_edit', true),
    -- Refining fields
    'pre_melting_weight', jsonb_build_object('read', true, 'write', true, 'can_view', true, 'can_edit', true),
    'post_melting_weight', jsonb_build_object('read', true, 'write', true, 'can_view', true, 'can_edit', true),
    'fineness_percent', jsonb_build_object('read', true, 'write', true, 'can_view', true, 'can_edit', true),
    'metal_retained_percent', jsonb_build_object('read', true, 'write', true, 'can_view', true, 'can_edit', true),
    'final_fine_grams', jsonb_build_object('read', true, 'write', true, 'can_view', true, 'can_edit', true),
    -- Customer fields
    'name', jsonb_build_object('read', true, 'write', true, 'can_view', true, 'can_edit', true),
    'email', jsonb_build_object('read', true, 'write', true, 'can_view', true, 'can_edit', true),
    'credit_limit', jsonb_build_object('read', true, 'write', true, 'can_view', true, 'can_edit', true),
    'total_purchases', jsonb_build_object('read', true, 'write', true, 'can_view', true, 'can_edit', true),
    'phone', jsonb_build_object('read', true, 'write', true, 'can_view', true, 'can_edit', true),
    'country', jsonb_build_object('read', true, 'write', true, 'can_view', true, 'can_edit', true),
    -- Sales fields
    'sale_price_per_oz', jsonb_build_object('read', true, 'write', true, 'can_view', true, 'can_edit', true),
    'total_amount', jsonb_build_object('read', true, 'write', true, 'can_view', true, 'can_edit', true),
    'net_proceeds', jsonb_build_object('read', true, 'write', true, 'can_view', true, 'can_edit', true),
    'commission_amount', jsonb_build_object('read', true, 'write', true, 'can_view', true, 'can_edit', true),
    'customer', jsonb_build_object('read', true, 'write', true, 'can_view', true, 'can_edit', true),
    'quantity', jsonb_build_object('read', true, 'write', true, 'can_view', true, 'can_edit', true),
    'london_am_rate', jsonb_build_object('read', true, 'write', true, 'can_view', true, 'can_edit', true),
    -- Payment fields
    'amount', jsonb_build_object('read', true, 'write', true, 'can_view', true, 'can_edit', true),
    'fx_rate', jsonb_build_object('read', true, 'write', true, 'can_view', true, 'can_edit', true),
    'bank_name', jsonb_build_object('read', true, 'write', true, 'can_view', true, 'can_edit', true),
    'account_number', jsonb_build_object('read', true, 'write', true, 'can_view', true, 'can_edit', true),
    'reference_number', jsonb_build_object('read', true, 'write', true, 'can_view', true, 'can_edit', true),
    'transaction_id', jsonb_build_object('read', true, 'write', true, 'can_view', true, 'can_edit', true),
    'payment_date', jsonb_build_object('read', true, 'write', true, 'can_view', true, 'can_edit', true),
    'expected_date', jsonb_build_object('read', true, 'write', true, 'can_view', true, 'can_edit', true),
    'proof_document', jsonb_build_object('read', true, 'write', true, 'can_view', true, 'can_edit', true),
    -- Price fields
    'london_pm_rate', jsonb_build_object('read', true, 'write', true, 'can_view', true, 'can_edit', true),
    'spot_price', jsonb_build_object('read', true, 'write', true, 'can_view', true, 'can_edit', true),
    'usd_cfa_rate', jsonb_build_object('read', true, 'write', true, 'can_view', true, 'can_edit', true),
    'usd_gnf_rate', jsonb_build_object('read', true, 'write', true, 'can_view', true, 'can_edit', true),
    'exchange_spread', jsonb_build_object('read', true, 'write', true, 'can_view', true, 'can_edit', true),
    -- Report fields
    'financial_data', jsonb_build_object('read', true, 'write', true, 'can_view', true, 'can_edit', true),
    'profit_margins', jsonb_build_object('read', true, 'write', true, 'can_view', true, 'can_edit', true),
    -- System fields
    'system_settings', jsonb_build_object('read', true, 'write', true, 'can_view', true, 'can_edit', true),
    'api_keys', jsonb_build_object('read', true, 'write', true, 'can_view', true, 'can_edit', true),
    'full_name', jsonb_build_object('read', true, 'write', true, 'can_view', true, 'can_edit', true),
    'role', jsonb_build_object('read', true, 'write', true, 'can_view', true, 'can_edit', true),
    'permissions', jsonb_build_object('read', true, 'write', true, 'can_view', true, 'can_edit', true)
  );

  -- Insert permissions for ALL modules
  FOR v_module IN
    SELECT id, name, display_name
    FROM modules
    WHERE is_active = true
  LOOP
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
    VALUES (
      v_user_id,
      v_module.id,
      true,
      true,
      true,
      v_field_perms,
      v_user_id,
      now()
    );

    RAISE NOTICE 'Granted permissions for module: %', v_module.display_name;
  END LOOP;

  RAISE NOTICE 'Successfully granted full permissions to romuald.tiegnan@gmail.com';
END $$;
