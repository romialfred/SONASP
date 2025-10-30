/*
  # Add Direct Transition from validated_for_refinery to received_at_refinery
  
  1. Purpose
     - Allow refinery manager to directly confirm receipt when batch is in validated_for_refinery status
     - This handles cases where the batch hasn't transitioned to waiting_refinery_receipt yet
  
  2. Transition Added
     - validated_for_refinery → received_at_refinery (refinery_manager direct confirmation)
  
  3. Complete Workflow Options
     - Option A (3 steps): validated_for_refinery → waiting_refinery_receipt → received_at_refinery → validated_for_processing
     - Option B (2 steps): validated_for_refinery → received_at_refinery → validated_for_processing (direct confirmation)
     - Option C (2 steps): waiting_refinery_receipt → received_at_refinery → validated_for_processing
     - Option D (1 step): received_at_refinery → validated_for_processing
*/

-- Add the direct transition from validated_for_refinery to received_at_refinery
INSERT INTO allowed_status_transitions (
  from_status,
  to_status,
  requires_role,
  description,
  is_system_transition
)
VALUES (
  'validated_for_refinery',
  'received_at_refinery',
  'refinery_manager',
  'Refinery manager directly confirms receipt (skipping waiting status)',
  false
)
ON CONFLICT (from_status, to_status) 
DO UPDATE SET
  description = EXCLUDED.description,
  requires_role = EXCLUDED.requires_role,
  is_system_transition = EXCLUDED.is_system_transition,
  updated_at = NOW();

-- Verify all refinery transitions exist
DO $$
DECLARE
  transition_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO transition_count
  FROM allowed_status_transitions
  WHERE (from_status = 'validated_for_refinery' AND to_status IN ('waiting_refinery_receipt', 'received_at_refinery'))
     OR (from_status = 'waiting_refinery_receipt' AND to_status = 'received_at_refinery')
     OR (from_status = 'received_at_refinery' AND to_status = 'validated_for_processing');
  
  IF transition_count < 4 THEN
    RAISE WARNING 'Expected 4 refinery transitions, found %', transition_count;
  ELSE
    RAISE NOTICE 'All refinery workflow transitions verified: % transitions found', transition_count;
  END IF;
END $$;
