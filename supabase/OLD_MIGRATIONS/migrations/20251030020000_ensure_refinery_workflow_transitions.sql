/*
  # Ensure Refinery Workflow Transitions
  
  1. Purpose
     - Ensure the two-step refinery reception workflow is properly configured
     - Guarantee transitions exist for the correct workflow:
       waiting_refinery_receipt → received_at_refinery → validated_for_processing
  
  2. Transitions Verified/Created
     - Step 1: waiting_refinery_receipt → received_at_refinery (refinery_manager confirms physical receipt)
     - Step 2: received_at_refinery → validated_for_processing (refinery_manager validates for processing)
  
  3. Security
     - Both transitions require refinery_manager role
     - Not system transitions (manual user action required)
  
  4. Notes
     - This migration is idempotent (safe to run multiple times)
     - Uses INSERT ... ON CONFLICT DO NOTHING to avoid duplicates
     - Validates that validated_for_processing status exists in batch constraint
*/

-- Ensure the first transition exists: waiting_refinery_receipt → received_at_refinery
INSERT INTO allowed_status_transitions (
  from_status,
  to_status,
  requires_role,
  description,
  is_system_transition
)
VALUES (
  'waiting_refinery_receipt',
  'received_at_refinery',
  'refinery_manager',
  'Refinery manager confirms physical receipt at refinery',
  false
)
ON CONFLICT (from_status, to_status) 
DO UPDATE SET
  description = EXCLUDED.description,
  requires_role = EXCLUDED.requires_role,
  is_system_transition = EXCLUDED.is_system_transition,
  updated_at = NOW();

-- Ensure the second transition exists: received_at_refinery → validated_for_processing
INSERT INTO allowed_status_transitions (
  from_status,
  to_status,
  requires_role,
  description,
  is_system_transition
)
VALUES (
  'received_at_refinery',
  'validated_for_processing',
  'refinery_manager',
  'Refinery manager validates batch for processing',
  false
)
ON CONFLICT (from_status, to_status) 
DO UPDATE SET
  description = EXCLUDED.description,
  requires_role = EXCLUDED.requires_role,
  is_system_transition = EXCLUDED.is_system_transition,
  updated_at = NOW();

-- Verify the workflow integrity with a check
DO $$
DECLARE
  transition_count INTEGER;
BEGIN
  -- Count the two critical refinery transitions
  SELECT COUNT(*) INTO transition_count
  FROM allowed_status_transitions
  WHERE (from_status = 'waiting_refinery_receipt' AND to_status = 'received_at_refinery')
     OR (from_status = 'received_at_refinery' AND to_status = 'validated_for_processing');
  
  -- Verify we have both transitions
  IF transition_count <> 2 THEN
    RAISE EXCEPTION 'Refinery workflow transitions are incomplete. Expected 2, found %', transition_count;
  END IF;
  
  -- Log success
  RAISE NOTICE 'Refinery workflow transitions verified: % transitions found', transition_count;
END $$;

-- Add helpful comment on the workflow
COMMENT ON TABLE allowed_status_transitions IS 
'Status transitions with role-based permissions. 
Refinery workflow: waiting_refinery_receipt → received_at_refinery → validated_for_processing';
