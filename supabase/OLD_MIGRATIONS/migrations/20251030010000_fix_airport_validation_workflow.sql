/*
  # Fix Airport Validation Workflow

  ## Purpose
  Ensure the workflow for airport validation is correct:
  - received_at_airport → validated_for_refinery (by airport_staff)
  - validated_for_refinery → waiting_refinery_receipt (when shipped to refinery)

  ## Changes
  1. Ensure transition received_at_airport → validated_for_refinery exists
  2. Ensure transition validated_for_refinery → waiting_refinery_receipt exists
  3. Verify complete Airport → Refinery workflow

  ## Safety
  - Uses ON CONFLICT to avoid duplicates
  - Does not modify existing transitions
*/

-- Ensure received_at_airport → validated_for_refinery transition exists
INSERT INTO allowed_status_transitions (
  from_status,
  to_status,
  requires_role,
  is_system_transition,
  description
) VALUES
  ('received_at_airport', 'validated_for_refinery', 'airport_staff', false,
   'Airport staff validates batch for refinery transport')
ON CONFLICT (from_status, to_status) DO NOTHING;

-- Ensure validated_for_refinery → waiting_refinery_receipt transition exists
INSERT INTO allowed_status_transitions (
  from_status,
  to_status,
  requires_role,
  is_system_transition,
  description
) VALUES
  ('validated_for_refinery', 'waiting_refinery_receipt', 'airport_staff', false,
   'Batch shipped from airport to refinery')
ON CONFLICT (from_status, to_status) DO NOTHING;

-- Verify complete Airport → Refinery workflow
DO $$
DECLARE
  v_transitions TEXT[];
  v_count INTEGER;
BEGIN
  -- Critical transitions for Airport → Refinery workflow
  v_transitions := ARRAY[
    'approved_for_transport → waiting_airport_receipt',
    'waiting_airport_receipt → received_at_airport',
    'received_at_airport → validated_for_refinery',
    'validated_for_refinery → waiting_refinery_receipt',
    'waiting_refinery_receipt → received_at_refinery'
  ];

  -- Count how many critical transitions exist
  SELECT COUNT(*) INTO v_count
  FROM allowed_status_transitions
  WHERE (from_status = 'approved_for_transport' AND to_status = 'waiting_airport_receipt')
     OR (from_status = 'waiting_airport_receipt' AND to_status = 'received_at_airport')
     OR (from_status = 'received_at_airport' AND to_status = 'validated_for_refinery')
     OR (from_status = 'validated_for_refinery' AND to_status = 'waiting_refinery_receipt')
     OR (from_status = 'waiting_refinery_receipt' AND to_status = 'received_at_refinery');

  RAISE NOTICE '✓ Airport → Refinery workflow: % of 5 critical transitions verified', v_count;

  IF v_count < 5 THEN
    RAISE WARNING 'Some Airport → Refinery transitions may be missing. Expected 5, found %', v_count;
  ELSE
    RAISE NOTICE '✓ Complete Airport → Refinery workflow is configured correctly';
  END IF;
END $$;
