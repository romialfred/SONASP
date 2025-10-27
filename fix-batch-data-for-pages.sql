/*
  Fix Batch Data for Shipping/Receiving and Refining Pages

  Based on the current data structure:
  - Batches at AIRPORT location with status "Received" → Show in Shipping/Receiving page
  - Batches with status "Processing" (at refinery) → Show in Refining page

  This script updates the existing batches to have the correct structure.
*/

-- First, let's see what we have
DO $$
DECLARE
  v_batch_count integer;
  v_airport_batches integer;
  v_processing_batches integer;
BEGIN
  SELECT COUNT(*) INTO v_batch_count FROM batches;
  RAISE NOTICE 'Total batches in database: %', v_batch_count;

  -- Count batches at airport
  SELECT COUNT(*) INTO v_airport_batches
  FROM batches b
  LEFT JOIN sites s ON b.current_site_id = s.id
  WHERE s.name ILIKE '%airport%';

  RAISE NOTICE 'Batches at airport locations: %', v_airport_batches;

  -- Count batches with Processing status
  SELECT COUNT(*) INTO v_processing_batches
  FROM batches
  WHERE status = 'Processing';

  RAISE NOTICE 'Batches with Processing status: %', v_processing_batches;
END $$;

-- ============================================================================
-- OPTION 1: If you already have the batches from the migration
-- Just make sure the statuses are capitalized correctly
-- ============================================================================
UPDATE batches
SET status = 'Pending'
WHERE LOWER(status) = 'pending';

UPDATE batches
SET status = 'Received'
WHERE LOWER(status) = 'received';

UPDATE batches
SET status = 'Processing'
WHERE LOWER(status) = 'processing';

-- ============================================================================
-- OPTION 2: If no batches exist, create sample data for testing
-- ============================================================================
DO $$
DECLARE
  v_airport_site_id uuid;
  v_mine_site_id uuid;
  v_user_id uuid;
  v_transport_id uuid;
  v_refinery_id uuid;
  v_batch_count integer;
BEGIN
  -- Check if we have any batches
  SELECT COUNT(*) INTO v_batch_count FROM batches;

  IF v_batch_count > 0 THEN
    RAISE NOTICE 'Batches already exist. Skipping sample data creation.';
    RETURN;
  END IF;

  RAISE NOTICE 'No batches found. Creating sample data...';

  -- Get required IDs
  SELECT id INTO v_airport_site_id FROM sites WHERE name ILIKE '%airport%' LIMIT 1;
  SELECT id INTO v_mine_site_id FROM sites WHERE site_type = 'factory' LIMIT 1;
  SELECT id INTO v_user_id FROM user_profiles LIMIT 1;
  SELECT id INTO v_transport_id FROM transport_companies LIMIT 1;
  SELECT id INTO v_refinery_id FROM refineries LIMIT 1;

  IF v_airport_site_id IS NULL OR v_mine_site_id IS NULL THEN
    RAISE NOTICE 'Required sites not found. Please run the main migrations first.';
    RETURN;
  END IF;

  -- Create batches for SHIPPING/RECEIVING page (at airport, status = Received)
  INSERT INTO batches (
    batch_number, status, origin_site_id, current_site_id,
    weight_grams, weight_ounces, metal_type, shipping_date,
    mine_to_airport_transport_id, destination_refinery_id,
    comments, created_by, created_at
  ) VALUES
    (
      'GN-20241018-001', 'Received', v_mine_site_id, v_airport_site_id,
      52000, 1671.67, 'gold', '2024-10-18',
      v_transport_id, v_refinery_id,
      'Received at airport, awaiting customs clearance', v_user_id, '2024-10-18 06:00:00'
    ),
    (
      'GN-20241015-001', 'Received', v_mine_site_id, v_airport_site_id,
      41000, 1317.90, 'gold', '2024-10-15',
      v_transport_id, v_refinery_id,
      'Delivered to airport for validation', v_user_id, '2024-10-15 10:00:00'
    ),
    (
      'GN-20241025-001', 'Pending', v_mine_site_id, v_airport_site_id,
      45000, 1446.52, 'gold', '2024-10-25',
      v_transport_id, v_refinery_id,
      'Pending arrival at airport', v_user_id, NOW()
    );

  -- Create batches for REFINING page (status = Processing, at refinery)
  INSERT INTO batches (
    batch_number, status, origin_site_id, current_site_id,
    weight_grams, weight_ounces, metal_type, shipping_date,
    mine_to_airport_transport_id, destination_refinery_id,
    comments, created_by, created_at
  ) VALUES
    (
      'GN-20241010-001', 'Processing', v_mine_site_id, v_airport_site_id,
      48000, 1543.06, 'gold', '2024-10-10',
      v_transport_id, v_refinery_id,
      'Currently in melting process', v_user_id, '2024-10-10 07:00:00'
    ),
    (
      'GN-20241005-001', 'Processing', v_mine_site_id, v_airport_site_id,
      35000, 1125.19, 'gold', '2024-10-05',
      v_transport_id, v_refinery_id,
      'Refining in progress', v_user_id, '2024-10-05 09:00:00'
    );

  RAISE NOTICE 'Created 5 sample batches:';
  RAISE NOTICE '  - 3 for Shipping/Receiving page (at airport)';
  RAISE NOTICE '  - 2 for Refining page (Processing status)';
END $$;

-- ============================================================================
-- Verification
-- ============================================================================
DO $$
DECLARE
  v_airport_received_count integer;
  v_processing_count integer;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'BATCH DATA VERIFICATION';
  RAISE NOTICE '========================================';

  -- Count batches that will appear in Shipping/Receiving
  SELECT COUNT(*) INTO v_airport_received_count
  FROM batches b
  LEFT JOIN sites s ON b.current_site_id = s.id
  WHERE s.name ILIKE '%airport%'
  AND b.status IN ('Received', 'Pending', 'Processing');

  RAISE NOTICE 'Batches for Shipping/Receiving page: %', v_airport_received_count;

  -- Show details
  FOR rec IN (
    SELECT b.batch_number, b.status, s.name as location
    FROM batches b
    LEFT JOIN sites s ON b.current_site_id = s.id
    WHERE s.name ILIKE '%airport%'
    AND b.status IN ('Received', 'Pending', 'Processing')
    ORDER BY b.created_at DESC
  ) LOOP
    RAISE NOTICE '  • % - Status: % - Location: %', rec.batch_number, rec.status, rec.location;
  END LOOP;

  RAISE NOTICE '';

  -- Count batches that will appear in Refining
  SELECT COUNT(*) INTO v_processing_count
  FROM batches
  WHERE status = 'Processing';

  RAISE NOTICE 'Batches for Refining page: %', v_processing_count;

  -- Show details
  FOR rec IN (
    SELECT batch_number, weight_grams, metal_type
    FROM batches
    WHERE status = 'Processing'
    ORDER BY created_at DESC
  ) LOOP
    RAISE NOTICE '  • % - Weight: %g - Metal: %', rec.batch_number, rec.weight_grams, rec.metal_type;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';

  IF v_airport_received_count = 0 AND v_processing_count = 0 THEN
    RAISE NOTICE '⚠️  No batches found for either page!';
    RAISE NOTICE '   Please run the main migration files first.';
  ELSIF v_airport_received_count > 0 OR v_processing_count > 0 THEN
    RAISE NOTICE '✅ Batch data configured correctly!';
    RAISE NOTICE '   - Shipping/Receiving page will show % batches', v_airport_received_count;
    RAISE NOTICE '   - Refining page will show % batches', v_processing_count;
  END IF;

  RAISE NOTICE '========================================';
END $$;
