/*
  # Add Missing Sales Status Transition

  ## Problem
  Customer approval from pending_approval status tries to go directly to waiting_for_payment
  but this transition doesn't exist in sales_status_transitions table.

  ## Analysis
  Current allowed transitions from pending_approval:
  - pending_approval → customer_rejected (customer/management rejects)
  - pending_approval → customer_approved (confusing name, but exists)

  ## Solution Options

  ### Option 1: Allow direct transition (if customer can approve without management)
  Add: pending_approval → waiting_for_payment

  ### Option 2: Clarify the workflow
  The current transition names are confusing. Let's clarify:
  - "customer_approved" actually means "management approved, awaiting customer"
  - The real customer approval is: customer_approved → waiting_for_payment

  ## Implementation
  We'll add a direct transition for cases where customer can approve before management
  (though this should be rare).
*/

-- Add transition: pending_approval → waiting_for_payment
-- This handles edge case where customer approves before management review
INSERT INTO sales_status_transitions (step_number, status_from, status_to, description, description_en, is_automatic, required_role, notes)
VALUES
  (0, 'pending_approval', 'waiting_for_payment', 'Client approuve directement avant validation management', 'Customer approves directly before management validation', false, 'customer', 'Edge case: Customer approves sale that is still pending management review. Payment commitment recorded.')
ON CONFLICT (status_from, status_to) DO NOTHING;

-- Update the confusing "customer_approved" transition to clarify it's actually management approval
UPDATE sales_status_transitions
SET
  description = 'MANAGEMENT approuve - Client notifié',
  description_en = 'MANAGEMENT approves - Customer notified',
  required_role = 'management',
  notes = 'Management reviews and approves sale. System sends email to customer for payment confirmation. Status name "customer_approved" is misleading - it means management approved.'
WHERE status_from = 'pending_approval' AND status_to = 'customer_approved';

-- Add helpful comment
COMMENT ON TABLE sales_status_transitions IS 'Valid sales workflow transitions. NOTE: "customer_approved" status means management approved and customer was notified, not that customer has approved yet. Customer approval happens at transition to waiting_for_payment.';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '
╔════════════════════════════════════════════════════════════════════════════════╗
║              SALES STATUS TRANSITION - MISSING TRANSITION ADDED                ║
╚════════════════════════════════════════════════════════════════════════════════╝

✓ Added transition: pending_approval → waiting_for_payment (edge case)
✓ Updated transition descriptions for clarity
✓ Added documentation comments

WORKFLOW CLARIFICATION:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Normal Flow (Management First):
  pending_approval → customer_approved (MANAGEMENT approves)
                  → waiting_for_payment (CUSTOMER confirms payment)

Edge Case (Customer First):
  pending_approval → waiting_for_payment (CUSTOMER approves before management)

NOTE: Status name "customer_approved" is misleading!
      It actually means "management approved, customer notified"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
END $$;
