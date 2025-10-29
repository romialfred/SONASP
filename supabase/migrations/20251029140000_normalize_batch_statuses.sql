/*
  # Normalize All Batch Statuses to Match Allowed Transitions
  
  ## Problem
  Some batches may have statuses that don't follow the correct workflow defined
  in allowed_status_transitions. This migration ensures all batches have valid
  statuses that match the allowed transitions.
  
  ## Strategy
  1. Analyze current batch statuses
  2. Map invalid statuses to their correct equivalents
  3. Update batches to use valid statuses
  4. Log all changes for audit purposes
  
  ## Status Mapping Logic
  - If status exists in allowed_status_transitions → Keep it
  - If status is invalid → Map to closest valid status
  - Preserve the intent of the original status
*/

-- ========================================
-- STEP 1: Create temporary audit table
-- ========================================

CREATE TEMP TABLE batch_status_updates (
  batch_id UUID,
  batch_number TEXT,
  old_status TEXT,
  new_status TEXT,
  reason TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ========================================
-- STEP 2: Analyze and fix invalid statuses
-- ========================================

DO $$
DECLARE
  batch_record RECORD;
  new_status TEXT;
  valid_statuses TEXT[] := ARRAY[
    'pending_factory_approval',
    'approved_for_transport',
    'waiting_airport_receipt',
    'received_at_airport',
    'validated_for_refinery',
    'waiting_refinery_receipt',
    'received_at_refinery',
    'validated_for_processing',
    'processing',
    'processed',
    'in_inventory',
    'ready_for_sale',
    'allocated_to_sale',
    'sold',
    'cancelled'
  ];
  total_batches INTEGER := 0;
  updated_batches INTEGER := 0;
BEGIN
  -- Count total batches
  SELECT COUNT(*) INTO total_batches FROM batches;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Batch Status Normalization';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total batches to analyze: %', total_batches;
  RAISE NOTICE '';

  -- Loop through all batches
  FOR batch_record IN 
    SELECT id, batch_number, status 
    FROM batches 
    WHERE status IS NOT NULL
  LOOP
    new_status := batch_record.status;
    
    -- Check if status is valid
    IF NOT (batch_record.status = ANY(valid_statuses)) THEN
      -- Map invalid statuses to valid ones
      CASE 
        -- Old status variations that might exist
        WHEN batch_record.status IN ('created', 'draft', 'new') THEN
          new_status := 'pending_factory_approval';
          
        WHEN batch_record.status IN ('validated', 'approved') THEN
          new_status := 'approved_for_transport';
          
        WHEN batch_record.status IN ('in_transit_to_airport', 'shipping_to_airport') THEN
          new_status := 'waiting_airport_receipt';
          
        WHEN batch_record.status IN ('at_airport', 'airport_received') THEN
          new_status := 'received_at_airport';
          
        WHEN batch_record.status IN ('airport_validated', 'airport_approved') THEN
          new_status := 'validated_for_refinery';
          
        WHEN batch_record.status IN ('in_transit_to_refinery', 'shipping_to_refinery') THEN
          new_status := 'waiting_refinery_receipt';
          
        WHEN batch_record.status IN ('at_refinery', 'refinery_received') THEN
          new_status := 'received_at_refinery';
          
        WHEN batch_record.status IN ('refinery_validated', 'ready_to_process') THEN
          new_status := 'validated_for_processing';
          
        WHEN batch_record.status IN ('in_processing', 'being_processed') THEN
          new_status := 'processing';
          
        WHEN batch_record.status IN ('process_complete', 'processing_complete') THEN
          new_status := 'processed';
          
        WHEN batch_record.status IN ('inventory', 'in_stock', 'available') THEN
          new_status := 'in_inventory';
          
        WHEN batch_record.status IN ('for_sale', 'available_for_sale') THEN
          new_status := 'ready_for_sale';
          
        WHEN batch_record.status IN ('allocated', 'reserved') THEN
          new_status := 'allocated_to_sale';
          
        WHEN batch_record.status IN ('sale_complete', 'completed') THEN
          new_status := 'sold';
          
        WHEN batch_record.status IN ('canceled', 'deleted', 'archived') THEN
          new_status := 'cancelled';
          
        ELSE
          -- Unknown status, set to pending_factory_approval for safety
          new_status := 'pending_factory_approval';
      END CASE;
      
      -- Log the change
      INSERT INTO batch_status_updates (batch_id, batch_number, old_status, new_status, reason)
      VALUES (
        batch_record.id,
        batch_record.batch_number,
        batch_record.status,
        new_status,
        'Invalid status mapped to valid equivalent'
      );
      
      -- Update the batch
      UPDATE batches 
      SET status = new_status, updated_at = now()
      WHERE id = batch_record.id;
      
      updated_batches := updated_batches + 1;
      
      RAISE NOTICE 'Updated batch %: % → %', 
        batch_record.batch_number, 
        batch_record.status, 
        new_status;
    END IF;
  END LOOP;
  
  -- ========================================
  -- STEP 3: Validate all statuses have valid transitions
  -- ========================================
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Validating Status Transitions';
  RAISE NOTICE '========================================';
  
  -- Check for statuses without valid next transitions
  FOR batch_record IN
    SELECT DISTINCT b.status, COUNT(*) as batch_count
    FROM batches b
    WHERE b.status NOT IN ('sold', 'cancelled')
      AND NOT EXISTS (
        SELECT 1 FROM allowed_status_transitions ast
        WHERE ast.from_status = b.status
      )
    GROUP BY b.status
  LOOP
    RAISE WARNING 'Status "%" has no outgoing transitions (% batches affected)', 
      batch_record.status, 
      batch_record.batch_count;
  END LOOP;
  
  -- ========================================
  -- STEP 4: Summary Report
  -- ========================================
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Normalization Complete';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Total batches analyzed: %', total_batches;
  RAISE NOTICE 'Batches updated: %', updated_batches;
  RAISE NOTICE 'Batches unchanged: %', total_batches - updated_batches;
  RAISE NOTICE '';
  
  IF updated_batches > 0 THEN
    RAISE NOTICE 'Changes logged in batch_status_updates table';
    RAISE NOTICE 'Review with: SELECT * FROM batch_status_updates;';
  ELSE
    RAISE NOTICE '✓ All batch statuses are valid!';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
END $$;

-- ========================================
-- STEP 5: Show current status distribution
-- ========================================

DO $$
DECLARE
  status_record RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Current Batch Status Distribution';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  
  FOR status_record IN
    SELECT status, COUNT(*) as count
    FROM batches
    GROUP BY status
    ORDER BY count DESC
  LOOP
    RAISE NOTICE '  % : % batches', RPAD(status_record.status, 30), status_record.count;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
END $$;

-- ========================================
-- STEP 6: Save audit log permanently (optional)
-- ========================================

-- If you want to keep the audit trail, uncomment this:
-- CREATE TABLE IF NOT EXISTS batch_status_normalization_audit (LIKE batch_status_updates INCLUDING ALL);
-- INSERT INTO batch_status_normalization_audit SELECT * FROM batch_status_updates;

-- Show any updates that were made
SELECT 
  batch_number,
  old_status,
  new_status,
  reason,
  updated_at
FROM batch_status_updates
ORDER BY updated_at;
