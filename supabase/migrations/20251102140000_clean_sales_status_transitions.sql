/*
  # Clean Sales Status Transitions Table

  1. Purpose
    - Remove all existing transitions from sales_status_transitions table
    - Prepare for new workflow implementation
    - Remove obsolete triggers and constraints

  2. Actions
    - Delete all records from sales_status_transitions
    - Drop existing validation triggers
    - Clean up any related functions

  3. Important Notes
    - This is a destructive operation
    - Should be followed immediately by migration 20251102140001
    - Backup recommended before execution
*/

-- Drop existing triggers on sales table related to status transitions
DROP TRIGGER IF EXISTS trigger_validate_sales_status_transition ON sales;
DROP TRIGGER IF EXISTS check_sales_status_transition_trigger ON sales;

-- Drop related validation functions
DROP FUNCTION IF EXISTS check_sales_status_transition();
DROP FUNCTION IF EXISTS validate_sales_status_transition(text, text);

-- Delete all existing records from sales_status_transitions
DELETE FROM sales_status_transitions;

-- Log the cleanup
DO $$
BEGIN
  RAISE NOTICE 'Sales status transitions table cleaned successfully';
  RAISE NOTICE 'All existing transitions have been removed';
  RAISE NOTICE 'Ready for new workflow implementation';
END $$;
