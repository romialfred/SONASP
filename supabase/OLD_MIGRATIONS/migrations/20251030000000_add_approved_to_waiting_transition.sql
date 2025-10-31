/*
  # Add Missing Transition: approved_for_transport → waiting_airport_receipt

  ## Purpose
  Ensure the transition from approved_for_transport to waiting_airport_receipt exists
  in the allowed_status_transitions table. This transition is needed when a batch
  is shipped from the factory to the airport.

  ## Changes
  1. Add transition if it doesn't exist
  2. Verify all airport workflow transitions are present

  ## Safety
  - Uses ON CONFLICT to avoid duplicates
  - Does not modify existing transitions
*/

-- Add the missing transition
INSERT INTO allowed_status_transitions (
  from_status,
  to_status,
  requires_role,
  is_system_transition,
  description
) VALUES
  ('approved_for_transport', 'waiting_airport_receipt', 'factory_staff', false,
   'Batch shipped from factory to airport')
ON CONFLICT (from_status, to_status) DO NOTHING;

-- Verify all critical airport transitions exist
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Count critical transitions
  SELECT COUNT(*) INTO v_count
  FROM allowed_status_transitions
  WHERE (from_status = 'approved_for_transport' AND to_status = 'waiting_airport_receipt')
     OR (from_status = 'waiting_airport_receipt' AND to_status = 'received_at_airport')
     OR (from_status = 'received_at_airport' AND to_status = 'validated_for_refinery')
     OR (from_status = 'validated_for_refinery' AND to_status = 'waiting_refinery_receipt');

  RAISE NOTICE '✓ Airport workflow transitions verified: % critical transitions found', v_count;

  IF v_count < 4 THEN
    RAISE WARNING 'Some airport workflow transitions may be missing. Expected 4, found %', v_count;
  END IF;
END $$;
