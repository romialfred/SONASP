/*
  # Fix Management Approved to Pending Customer Approval Transition

  1. Purpose
    - Fix the transition from management_approved to pending_for_customer_approval
    - This transition should be automatic after management approval
    - Currently it's manual, which breaks the approveSale workflow

  2. Changes
    - Update the transition to be automatic
    - This allows approveSale() to do both steps without error

  3. Security
    - No security changes needed
*/

-- Update the transition to be automatic
UPDATE sales_status_transitions
SET
  is_automatic = true,
  notes = 'Automatic transition after management approval to send to customer'
WHERE
  status_from = 'management_approved'
  AND status_to = 'pending_for_customer_approval';

-- Verify the update
DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM sales_status_transitions
  WHERE status_from = 'management_approved'
    AND status_to = 'pending_for_customer_approval'
    AND is_automatic = true;

  IF v_count = 0 THEN
    RAISE EXCEPTION 'Failed to update management_approved transition to automatic';
  END IF;

  RAISE NOTICE 'Successfully updated management_approved -> pending_for_customer_approval transition to automatic';
END $$;
