/*
  # Fix processed → in_inventory Transition Role
  
  ## Problem
  The transition from 'processed' to 'in_inventory' was incorrectly set to 'system'.
  It should be 'refinery_staff' because the refinery staff manually adds the 
  processed batch to inventory via the "Add Inventory Entry" form.
  
  ## Changes
  - Update requires_role from 'system' to 'refinery_staff'
  - Update is_system_transition from true to false
*/

-- Update the transition role
UPDATE allowed_status_transitions
SET 
  requires_role = 'refinery_staff',
  is_system_transition = false,
  description = 'Processed batch added to inventory via Add Inventory Entry form by refinery staff',
  updated_at = now()
WHERE from_status = 'processed'
  AND to_status = 'in_inventory';

-- Verify the change
DO $$
DECLARE
  transition_role TEXT;
  is_system BOOLEAN;
BEGIN
  SELECT requires_role, is_system_transition 
  INTO transition_role, is_system
  FROM allowed_status_transitions
  WHERE from_status = 'processed' AND to_status = 'in_inventory';

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Transition Update: processed → in_inventory';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  
  IF transition_role = 'refinery_staff' AND is_system = false THEN
    RAISE NOTICE '✓ Transition role updated to: refinery_staff';
    RAISE NOTICE '✓ is_system_transition set to: false';
    RAISE NOTICE '';
    RAISE NOTICE 'The refinery staff can now manually add processed';
    RAISE NOTICE 'batches to inventory via the Add Inventory Entry form.';
  ELSE
    RAISE WARNING '✗ Update failed! Current role: %, is_system: %', transition_role, is_system;
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
END $$;
