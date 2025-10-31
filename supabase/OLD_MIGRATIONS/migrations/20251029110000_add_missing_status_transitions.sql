/*
  # Add Missing Status Transitions

  ## Problem
  When a batch with status 'approved_for_transport' arrives at the airport,
  there's no direct transition to 'received_at_airport' or 'waiting_airport_receipt'.
  This causes receipt confirmation to fail.

  ## Solution
  Add the missing transition from 'approved_for_transport' to 'received_at_airport'
  to allow direct receipt confirmation when batches haven't been marked as "in transit".

  ## Changes
  1. Add transition: approved_for_transport → received_at_airport
  2. This allows airport staff to confirm receipt even if factory didn't mark it as shipped

  ## Business Logic
  In practice, sometimes batches arrive at airport before the system is updated
  with "waiting_airport_receipt". This transition provides flexibility.
*/

-- Add missing transition from approved_for_transport to received_at_airport
INSERT INTO allowed_status_transitions (from_status, to_status, requires_role, description, is_system_transition)
VALUES
  ('approved_for_transport', 'received_at_airport', 'airport_staff',
   'Batch directly received at airport (when not marked as shipped)', false)
ON CONFLICT (from_status, to_status) DO UPDATE SET
  requires_role = EXCLUDED.requires_role,
  description = EXCLUDED.description,
  is_system_transition = EXCLUDED.is_system_transition,
  updated_at = now();

-- Verify the transition was added
DO $$
DECLARE
  transition_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM allowed_status_transitions
    WHERE from_status = 'approved_for_transport'
      AND to_status = 'received_at_airport'
  ) INTO transition_exists;

  IF transition_exists THEN
    RAISE NOTICE '✓ Transition added: approved_for_transport → received_at_airport';
  ELSE
    RAISE WARNING '✗ Failed to add transition';
  END IF;
END $$;
