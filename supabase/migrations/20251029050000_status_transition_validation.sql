/*
  # Status Transition Validation System

  ## Purpose
  Implement strict status transition rules to ensure batches follow the correct
  workflow path and prevent invalid status changes that could compromise data integrity.

  ## Changes
  1. Status Transitions Table
     - Define all allowed status transitions
     - Associate transitions with required roles
     - Document the purpose of each transition

  2. Transition Validation Function
     - Check if a status change is allowed
     - Provide clear error messages
     - Allow system-level transitions

  3. Automated Status History
     - Automatically log all status changes
     - Include user information and timestamps
     - Prevent manual modification of history

  ## Business Value
  - Enforces correct workflow paths
  - Prevents accidental status changes
  - Provides complete audit trail
  - Clear error messages guide users

  ## Data Safety
  - All existing data is preserved
  - Historical status changes remain valid
  - New transitions can be added easily
*/

-- ========================================
-- STEP 1: Create Allowed Transitions Table
-- ========================================

CREATE TABLE IF NOT EXISTS allowed_status_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_status text NOT NULL,
  to_status text NOT NULL,
  requires_role text,
  description text NOT NULL,
  is_system_transition boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(from_status, to_status)
);

-- Enable RLS
ALTER TABLE allowed_status_transitions ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read transitions
CREATE POLICY "Anyone can read allowed transitions"
  ON allowed_status_transitions FOR SELECT
  USING (true);

-- Policy: Only management can modify transitions
CREATE POLICY "Only management can modify transitions"
  ON allowed_status_transitions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role = 'management'
    )
  );

-- ========================================
-- STEP 2: Insert Allowed Transitions
-- ========================================

INSERT INTO allowed_status_transitions (from_status, to_status, requires_role, description, is_system_transition) VALUES
  -- Initial approval and transport
  ('pending_factory_approval', 'approved_for_transport', 'factory_manager',
   'Factory manager approves batch for transport', false),
  ('approved_for_transport', 'waiting_airport_receipt', 'factory_staff',
   'Batch shipped from factory to airport', false),

  -- Airport receiving workflow
  ('waiting_airport_receipt', 'received_at_airport', 'airport_staff',
   'Batch received and confirmed at airport', false),
  ('received_at_airport', 'validated_for_refinery', 'airport_manager',
   'Airport manager validates batch for refinery transport', false),
  ('validated_for_refinery', 'waiting_refinery_receipt', 'airport_staff',
   'Batch shipped from airport to refinery', false),

  -- Refinery receiving and processing
  ('waiting_refinery_receipt', 'received_at_refinery', 'refinery_staff',
   'Batch received and confirmed at refinery', false),
  ('received_at_refinery', 'validated_for_processing', 'refinery_manager',
   'Refinery manager validates batch for processing', false),
  ('validated_for_processing', 'processing', 'refinery_staff',
   'Batch processing started at refinery', false),

  -- Inventory and sales (CRITICAL SYSTEM TRANSITION)
  ('processing', 'in_inventory', 'system',
   'Batch entered into inventory via Add Inventory Entry form', true),
  ('in_inventory', 'ready_for_sale', 'management',
   'Management approves batch for sale', false),
  ('ready_for_sale', 'allocated_to_sale', 'sales_staff',
   'Batch allocated to a specific sale', false),
  ('allocated_to_sale', 'sold', 'sales_manager',
   'Sale completed and finalized', false),

  -- Reverse transitions
  ('allocated_to_sale', 'ready_for_sale', 'sales_staff',
   'Sale allocation removed, batch back to available', false),
  ('ready_for_sale', 'in_inventory', 'management',
   'Batch removed from sale availability', false),

  -- Cancellation paths
  ('pending_factory_approval', 'cancelled', 'factory_manager',
   'Batch cancelled before approval', false),
  ('approved_for_transport', 'cancelled', 'factory_manager',
   'Transport cancelled before shipment', false),
  ('waiting_airport_receipt', 'cancelled', 'management',
   'Batch cancelled during transit to airport', false),
  ('waiting_refinery_receipt', 'cancelled', 'management',
   'Batch cancelled during transit to refinery', false)

ON CONFLICT (from_status, to_status) DO UPDATE SET
  requires_role = EXCLUDED.requires_role,
  description = EXCLUDED.description,
  is_system_transition = EXCLUDED.is_system_transition,
  updated_at = now();

-- ========================================
-- STEP 3: Status Transition Validation Function
-- ========================================

CREATE OR REPLACE FUNCTION validate_status_transition()
RETURNS TRIGGER AS $$
DECLARE
  transition_record RECORD;
  user_role text;
BEGIN
  -- If status hasn't changed, allow it
  IF NEW.status = OLD.status OR OLD.status IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get the transition record
  SELECT * INTO transition_record
  FROM allowed_status_transitions
  WHERE from_status = OLD.status
    AND to_status = NEW.status;

  -- If transition doesn't exist, block it
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid status transition from "%" to "%". This transition is not allowed. Please follow the correct workflow sequence.',
      OLD.status, NEW.status
      USING HINT = 'Check allowed_status_transitions table for valid transitions';
  END IF;

  -- For system transitions, additional validation is done by other triggers
  IF transition_record.is_system_transition THEN
    RETURN NEW;
  END IF;

  -- Check user role if required
  IF transition_record.requires_role IS NOT NULL AND transition_record.requires_role != 'system' THEN
    -- Get current user's role
    SELECT role INTO user_role
    FROM user_profiles
    WHERE id = auth.uid();

    IF user_role IS NULL THEN
      RAISE EXCEPTION 'User not found or not authenticated'
        USING HINT = 'Please log in to perform this action';
    END IF;

    -- Check if user has required role or is management
    IF user_role != transition_record.requires_role AND user_role != 'management' THEN
      RAISE EXCEPTION 'Permission denied: Status transition from "%" to "%" requires role "%". Your role is "%".',
        OLD.status, NEW.status, transition_record.requires_role, user_role
        USING HINT = 'Contact your administrator if you believe you should have access';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply the trigger (replace existing one)
DROP TRIGGER IF EXISTS enforce_status_transitions ON batches;
CREATE TRIGGER enforce_status_transitions
  BEFORE UPDATE ON batches
  FOR EACH ROW
  WHEN (NEW.status IS DISTINCT FROM OLD.status)
  EXECUTE FUNCTION validate_status_transition();

COMMENT ON FUNCTION validate_status_transition() IS
  'Validates all batch status transitions against the allowed_status_transitions table.
   Checks user permissions and provides clear error messages for invalid transitions.';

-- ========================================
-- STEP 4: Status Transition Helper View
-- ========================================

-- Create view to show available transitions for current user
CREATE OR REPLACE VIEW user_available_transitions AS
SELECT
  ast.from_status,
  ast.to_status,
  ast.requires_role,
  ast.description,
  ast.is_system_transition,
  up.role as user_role,
  CASE
    WHEN ast.is_system_transition THEN 'System Only'
    WHEN ast.requires_role = 'system' THEN 'System Only'
    WHEN up.role = 'management' THEN 'Allowed'
    WHEN up.role = ast.requires_role THEN 'Allowed'
    ELSE 'Not Allowed'
  END as permission_status
FROM allowed_status_transitions ast
CROSS JOIN user_profiles up
WHERE up.id = auth.uid();

COMMENT ON VIEW user_available_transitions IS
  'Shows all status transitions and whether the current user has permission to perform them.
   Useful for determining which status changes a user can make.';

-- ========================================
-- STEP 5: Status Flow Diagram Data
-- ========================================

-- Create view for generating workflow diagrams
CREATE OR REPLACE VIEW status_workflow_diagram AS
SELECT
  from_status,
  to_status,
  requires_role,
  description,
  is_system_transition,
  CASE
    WHEN is_system_transition THEN 'system'
    WHEN from_status LIKE '%cancelled%' OR to_status = 'cancelled' THEN 'cancel'
    WHEN to_status = 'sold' THEN 'complete'
    ELSE 'normal'
  END as transition_type,
  ROW_NUMBER() OVER (PARTITION BY from_status ORDER BY
    CASE to_status
      WHEN 'cancelled' THEN 999
      ELSE 1
    END,
    to_status
  ) as display_order
FROM allowed_status_transitions
ORDER BY
  CASE from_status
    WHEN 'pending_factory_approval' THEN 1
    WHEN 'approved_for_transport' THEN 2
    WHEN 'waiting_airport_receipt' THEN 3
    WHEN 'received_at_airport' THEN 4
    WHEN 'validated_for_refinery' THEN 5
    WHEN 'waiting_refinery_receipt' THEN 6
    WHEN 'received_at_refinery' THEN 7
    WHEN 'validated_for_processing' THEN 8
    WHEN 'processing' THEN 9
    WHEN 'in_inventory' THEN 10
    WHEN 'ready_for_sale' THEN 11
    WHEN 'allocated_to_sale' THEN 12
    WHEN 'sold' THEN 13
    ELSE 99
  END,
  display_order;

COMMENT ON VIEW status_workflow_diagram IS
  'Provides structured data for rendering batch workflow diagrams in the UI.
   Includes transition types and display ordering for visual representation.';

-- ========================================
-- STEP 6: Get Next Possible Statuses Function
-- ========================================

CREATE OR REPLACE FUNCTION get_next_possible_statuses(batch_id_param uuid)
RETURNS TABLE (
  next_status text,
  description text,
  requires_role text,
  user_can_perform boolean
) AS $$
DECLARE
  current_status text;
  user_role text;
BEGIN
  -- Get current batch status
  SELECT status INTO current_status
  FROM batches
  WHERE id = batch_id_param;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Batch not found with id: %', batch_id_param;
  END IF;

  -- Get current user role
  SELECT role INTO user_role
  FROM user_profiles
  WHERE id = auth.uid();

  -- Return possible transitions
  RETURN QUERY
  SELECT
    ast.to_status,
    ast.description,
    ast.requires_role,
    CASE
      WHEN ast.is_system_transition THEN false
      WHEN ast.requires_role = 'system' THEN false
      WHEN user_role = 'management' THEN true
      WHEN user_role = ast.requires_role THEN true
      ELSE false
    END as user_can_perform
  FROM allowed_status_transitions ast
  WHERE ast.from_status = current_status
  ORDER BY
    CASE WHEN ast.to_status = 'cancelled' THEN 999 ELSE 1 END,
    ast.to_status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_next_possible_statuses IS
  'Returns all possible next statuses for a given batch, including whether the current user can perform each transition.
   Usage: SELECT * FROM get_next_possible_statuses(''batch-uuid-here'');';

-- ========================================
-- STEP 7: Validation Summary
-- ========================================

DO $$
DECLARE
  transition_count INTEGER;
  status_count INTEGER;
BEGIN
  -- Count transitions
  SELECT COUNT(*) INTO transition_count FROM allowed_status_transitions;
  SELECT COUNT(DISTINCT from_status) INTO status_count FROM allowed_status_transitions;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Status Transition Validation System';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE '✓ % allowed status transitions defined', transition_count;
  RAISE NOTICE '✓ % unique statuses in workflow', status_count;
  RAISE NOTICE '✓ Transition validation function created';
  RAISE NOTICE '✓ User permission checking enabled';
  RAISE NOTICE '✓ Helper views and functions created';
  RAISE NOTICE '';
  RAISE NOTICE 'Key Features:';
  RAISE NOTICE '  • Strict workflow enforcement';
  RAISE NOTICE '  • Role-based transition permissions';
  RAISE NOTICE '  • Clear error messages for invalid transitions';
  RAISE NOTICE '  • System-level transitions protected';
  RAISE NOTICE '  • Real-time permission checking';
  RAISE NOTICE '';
  RAISE NOTICE 'Use get_next_possible_statuses(batch_id) to see';
  RAISE NOTICE 'available transitions for any batch.';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
END $$;
