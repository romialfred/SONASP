/*
  # Add 'processed' Status and Fix Complete Workflow

  ## Problem
  The current workflow is missing the 'processed' status and has incorrect transitions.

  Current incorrect flow:
  - Airport confirms receipt → goes to validated_for_refinery (WRONG)
  - Should be: Airport confirms → waiting_refinery_receipt (shipped to refinery)

  ## Correct Workflow
  1. Airport confirms receipt → waiting_refinery_receipt (shipped to refinery)
  2. Refinery receives → validated_for_processing (ready to process)
  3. Refinery starts processing → processing
  4. Refinery completes processing → processed
  5. Add to inventory → in_inventory

  ## Changes
  1. Add 'processed' status to batches table constraint
  2. Add/update status transitions for correct workflow
  3. Add transition: processing → processed
  4. Add transition: processed → in_inventory (for inventory entry)
*/

-- ========================================
-- STEP 1: Add 'processed' status to constraint
-- ========================================

-- Drop the old constraint
ALTER TABLE batches DROP CONSTRAINT IF EXISTS batches_status_check;

-- Add new constraint with 'processed' status
ALTER TABLE batches ADD CONSTRAINT batches_status_check CHECK (
  status IN (
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
  )
);

-- ========================================
-- STEP 2: Add Missing Transitions
-- ========================================

-- Airport to Refinery workflow
INSERT INTO allowed_status_transitions (from_status, to_status, requires_role, description, is_system_transition)
VALUES
  -- Airport confirms receipt and ships to refinery
  ('received_at_airport', 'waiting_refinery_receipt', 'airport_staff',
   'Batch shipped from airport to refinery after confirmation', false),

  -- Refinery receives and validates for processing
  ('received_at_refinery', 'validated_for_processing', 'refinery_manager',
   'Refinery manager validates batch for processing', false),

  -- Refinery starts processing
  ('validated_for_processing', 'processing', 'refinery_staff',
   'Batch processing started at refinery', false),

  -- Refinery completes processing (NEW)
  ('processing', 'processed', 'refinery_staff',
   'Batch processing completed at refinery', false),

  -- Processed batch added to inventory (SYSTEM)
  ('processed', 'in_inventory', 'system',
   'Processed batch added to inventory via Add Inventory Entry form', true)

ON CONFLICT (from_status, to_status) DO UPDATE SET
  requires_role = EXCLUDED.requires_role,
  description = EXCLUDED.description,
  is_system_transition = EXCLUDED.is_system_transition,
  updated_at = now();

-- ========================================
-- STEP 3: Remove Incorrect Transitions
-- ========================================

-- Remove the incorrect transition from processing directly to in_inventory
-- (Now it must go through 'processed' first)
DELETE FROM allowed_status_transitions
WHERE from_status = 'processing'
  AND to_status = 'in_inventory';

-- ========================================
-- STEP 4: Verification
-- ========================================

DO $$
DECLARE
  processed_transition_count INTEGER;
  workflow_valid BOOLEAN := true;
BEGIN
  -- Check if processed transitions exist
  SELECT COUNT(*) INTO processed_transition_count
  FROM allowed_status_transitions
  WHERE to_status = 'processed' OR from_status = 'processed';

  IF processed_transition_count < 2 THEN
    workflow_valid := false;
    RAISE WARNING 'Missing processed transitions!';
  END IF;

  -- Verify key transitions
  IF NOT EXISTS (
    SELECT 1 FROM allowed_status_transitions
    WHERE from_status = 'received_at_airport' AND to_status = 'waiting_refinery_receipt'
  ) THEN
    workflow_valid := false;
    RAISE WARNING 'Missing transition: received_at_airport → waiting_refinery_receipt';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM allowed_status_transitions
    WHERE from_status = 'received_at_refinery' AND to_status = 'validated_for_processing'
  ) THEN
    workflow_valid := false;
    RAISE WARNING 'Missing transition: received_at_refinery → validated_for_processing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM allowed_status_transitions
    WHERE from_status = 'processing' AND to_status = 'processed'
  ) THEN
    workflow_valid := false;
    RAISE WARNING 'Missing transition: processing → processed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM allowed_status_transitions
    WHERE from_status = 'processed' AND to_status = 'in_inventory'
  ) THEN
    workflow_valid := false;
    RAISE WARNING 'Missing transition: processed → in_inventory';
  END IF;

  -- Display results
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Processed Status & Workflow Update';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';

  IF workflow_valid THEN
    RAISE NOTICE '✓ Status "processed" added to constraint';
    RAISE NOTICE '✓ All required transitions added';
    RAISE NOTICE '✓ Workflow validated successfully';
    RAISE NOTICE '';
    RAISE NOTICE 'Complete Workflow:';
    RAISE NOTICE '  Airport → received_at_airport';
    RAISE NOTICE '  Airport ships → waiting_refinery_receipt';
    RAISE NOTICE '  Refinery receives → received_at_refinery';
    RAISE NOTICE '  Refinery validates → validated_for_processing';
    RAISE NOTICE '  Refinery starts → processing';
    RAISE NOTICE '  Refinery completes → processed';
    RAISE NOTICE '  Add to inventory → in_inventory';
  ELSE
    RAISE WARNING '✗ Some workflow transitions are missing!';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
END $$;
