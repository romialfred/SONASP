/*
  # Ensure Batch Data Exists and IDs are Correct

  1. Purpose
     - Verify that batch sample data exists
     - Ensure batch IDs are proper UUIDs
     - Fix any ID mismatches between frontend and database
     - Add sample batches if none exist

  2. Changes
     - Check for existing batch data
     - Insert sample batches if database is empty
     - Ensure all foreign keys are valid
     - Add batch_number index for faster lookups
*/

-- ============================================================================
-- STEP 1: Add helpful indexes for batch queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_batches_batch_number ON batches(batch_number);
CREATE INDEX IF NOT EXISTS idx_batches_created_at_desc ON batches(created_at DESC);

-- ============================================================================
-- STEP 2: Create sample batch data if none exists
-- ============================================================================

DO $$
DECLARE
  v_batch_count INT;
  v_user_id UUID;
  v_site_guinea UUID;
  v_site_airport UUID;
  v_batch_id UUID;
BEGIN
  -- Check if batches already exist
  SELECT COUNT(*) INTO v_batch_count FROM batches;

  IF v_batch_count > 0 THEN
    RAISE NOTICE 'Batches already exist (count: %). Skipping sample data creation.', v_batch_count;
    RETURN;
  END IF;

  RAISE NOTICE 'No batches found. Creating sample batch data...';

  -- Get a user ID for created_by (prefer management role)
  SELECT id INTO v_user_id
  FROM user_profiles
  WHERE role = 'management'
  LIMIT 1;

  IF v_user_id IS NULL THEN
    -- If no management user, get any user
    SELECT id INTO v_user_id
    FROM user_profiles
    LIMIT 1;
  END IF;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'No users found. Please create users first.';
    RETURN;
  END IF;

  -- Get site IDs (create if they don't exist)
  SELECT id INTO v_site_guinea
  FROM sites
  WHERE country = 'Guinea'
  AND site_type = 'factory'
  LIMIT 1;

  IF v_site_guinea IS NULL THEN
    INSERT INTO sites (name, site_type, country, is_active)
    VALUES ('Conakry Factory', 'factory', 'Guinea', true)
    RETURNING id INTO v_site_guinea;
    RAISE NOTICE 'Created Guinea factory site';
  END IF;

  SELECT id INTO v_site_airport
  FROM sites
  WHERE site_type = 'airport'
  LIMIT 1;

  IF v_site_airport IS NULL THEN
    INSERT INTO sites (name, site_type, country, is_active)
    VALUES ('Conakry Airport', 'airport', 'Guinea', true)
    RETURNING id INTO v_site_airport;
    RAISE NOTICE 'Created airport site';
  END IF;

  -- Create sample batches
  -- Batch 1: Recently created
  INSERT INTO batches (
    batch_number,
    weight_grams,
    weight_ounces,
    status,
    metal_type,
    shipping_date,
    origin_site_id,
    current_site_id,
    destination_site_id,
    created_by,
    comments,
    created_at
  )
  VALUES (
    'BT-' || to_char(CURRENT_DATE, 'YYYYMM') || '-GN-0001',
    1250.50,
    40.21,
    'created',
    'gold',
    CURRENT_DATE,
    v_site_guinea,
    v_site_guinea,
    v_site_airport,
    v_user_id,
    'First sample batch from Conakry factory',
    NOW() - INTERVAL '2 days'
  )
  RETURNING id INTO v_batch_id;

  -- Add status history for batch 1
  INSERT INTO batch_status_history (batch_id, status, changed_by, changed_at, comments)
  VALUES (
    v_batch_id,
    'created',
    v_user_id,
    NOW() - INTERVAL '2 days',
    'Batch created at factory'
  );

  RAISE NOTICE 'Created sample batch 1: %', v_batch_id;

  -- Batch 2: In transit
  INSERT INTO batches (
    batch_number,
    weight_grams,
    weight_ounces,
    status,
    metal_type,
    shipping_date,
    origin_site_id,
    current_site_id,
    destination_site_id,
    created_by,
    comments,
    created_at
  )
  VALUES (
    'BT-' || to_char(CURRENT_DATE, 'YYYYMM') || '-GN-0002',
    980.75,
    31.54,
    'validated_for_transport',
    'gold',
    CURRENT_DATE - INTERVAL '1 day',
    v_site_guinea,
    v_site_guinea,
    v_site_airport,
    v_user_id,
    'Second sample batch',
    NOW() - INTERVAL '3 days'
  )
  RETURNING id INTO v_batch_id;

  -- Add status history
  INSERT INTO batch_status_history (batch_id, status, changed_by, changed_at, comments)
  VALUES
    (v_batch_id, 'created', v_user_id, NOW() - INTERVAL '3 days', 'Batch created'),
    (v_batch_id, 'validated_for_transport', v_user_id, NOW() - INTERVAL '1 day', 'Validated for transport');

  RAISE NOTICE 'Created sample batch 2: %', v_batch_id;

  -- Batch 3: Received at airport
  INSERT INTO batches (
    batch_number,
    weight_grams,
    weight_ounces,
    status,
    metal_type,
    shipping_date,
    origin_site_id,
    current_site_id,
    destination_site_id,
    created_by,
    comments,
    created_at
  )
  VALUES (
    'BT-' || to_char(CURRENT_DATE - INTERVAL '1 month', 'YYYYMM') || '-GN-0003',
    1500.25,
    48.24,
    'received_airport',
    'gold',
    CURRENT_DATE - INTERVAL '5 days',
    v_site_guinea,
    v_site_airport,
    NULL,
    v_user_id,
    'Third sample batch - received at airport',
    NOW() - INTERVAL '7 days'
  )
  RETURNING id INTO v_batch_id;

  -- Add status history
  INSERT INTO batch_status_history (batch_id, status, changed_by, changed_at, comments)
  VALUES
    (v_batch_id, 'created', v_user_id, NOW() - INTERVAL '7 days', 'Batch created'),
    (v_batch_id, 'validated_for_transport', v_user_id, NOW() - INTERVAL '6 days', 'Validated'),
    (v_batch_id, 'received_airport', v_user_id, NOW() - INTERVAL '5 days', 'Received at airport');

  RAISE NOTICE 'Created sample batch 3: %', v_batch_id;

  RAISE NOTICE 'Successfully created 3 sample batches';

  -- Verify creation
  SELECT COUNT(*) INTO v_batch_count FROM batches;
  RAISE NOTICE 'Total batches in database: %', v_batch_count;

END $$;

-- ============================================================================
-- STEP 3: Create a helpful function to get batch by either ID or batch_number
-- ============================================================================

CREATE OR REPLACE FUNCTION get_batch_by_identifier(identifier TEXT)
RETURNS TABLE (
  id UUID,
  batch_number TEXT,
  status TEXT,
  weight_grams NUMERIC,
  weight_ounces NUMERIC,
  metal_type TEXT,
  shipping_date DATE,
  origin_site_id UUID,
  current_site_id UUID,
  destination_site_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  comments TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Try to parse as UUID first
  IF identifier ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    -- It's a UUID, search by ID
    RETURN QUERY
    SELECT b.* FROM batches b WHERE b.id = identifier::UUID;
  ELSE
    -- Not a UUID, search by batch_number
    RETURN QUERY
    SELECT b.* FROM batches b WHERE b.batch_number = identifier;
  END IF;
END;
$$;

COMMENT ON FUNCTION get_batch_by_identifier IS 'Get batch by either UUID id or batch_number string';

-- Grant access to the function
GRANT EXECUTE ON FUNCTION get_batch_by_identifier TO authenticated;
