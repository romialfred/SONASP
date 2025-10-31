/*
  # Fix Sales Approval Workflow

  1. Problem Identified
    - Approval service was setting status to 'approved' which doesn't exist in workflow
    - Workflow requires: pending_approval → customer_approved → waiting_for_payment
    - Missing tracking columns for management approval/rejection

  2. Changes
    - Add management approval tracking columns to sales table
    - Update sales_status_transitions to clarify the workflow
    - Add helpful comments and documentation

  3. Official Workflow (7 Steps)
    Step 1: create_sales → pending_approval (automatic on creation)
    Step 2: pending_approval → customer_rejected (customer rejects)
    Step 3: pending_approval → customer_approved (MANAGEMENT approves, notifies customer)
    Step 4: customer_approved → waiting_for_payment (CUSTOMER confirms payment commitment)
    Step 5: waiting_for_payment → virtual_payment (system creates virtual payment)
    Step 6: waiting_for_payment/virtual_payment → payment_received (management confirms payment)
    Step 7: payment_received → completed (final closure)

  4. Security
    - No RLS changes needed
    - Columns are nullable for backward compatibility
*/

-- Add management approval tracking columns to sales table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'management_approved_at'
  ) THEN
    ALTER TABLE sales ADD COLUMN management_approved_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'management_approved_by'
  ) THEN
    ALTER TABLE sales ADD COLUMN management_approved_by text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'management_rejected_at'
  ) THEN
    ALTER TABLE sales ADD COLUMN management_rejected_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'management_rejected_by'
  ) THEN
    ALTER TABLE sales ADD COLUMN management_rejected_by text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'rejection_reason'
  ) THEN
    ALTER TABLE sales ADD COLUMN rejection_reason text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'customer_approved_at'
  ) THEN
    ALTER TABLE sales ADD COLUMN customer_approved_at timestamptz;
  END IF;
END $$;

-- Update descriptions in sales_status_transitions for clarity
UPDATE sales_status_transitions
SET
  description = 'Approbation par le MANAGEMENT - Notification envoyée au client',
  description_en = 'Approved by MANAGEMENT - Customer notification sent',
  notes = 'Management approves the sale and system sends email to customer for payment commitment'
WHERE status_from = 'pending_approval' AND status_to = 'customer_approved';

UPDATE sales_status_transitions
SET
  description = 'CLIENT confirme engagement de paiement',
  description_en = 'CUSTOMER confirms payment commitment',
  notes = 'Customer receives email, reviews terms, and confirms they will pay (creates payment record)'
WHERE status_from = 'customer_approved' AND status_to = 'waiting_for_payment';

-- Add comment to clarify workflow
COMMENT ON COLUMN sales.management_approved_at IS 'Timestamp when management approved the sale (moves to customer_approved status)';
COMMENT ON COLUMN sales.management_approved_by IS 'Email of management user who approved the sale';
COMMENT ON COLUMN sales.management_rejected_at IS 'Timestamp when management rejected the sale';
COMMENT ON COLUMN sales.management_rejected_by IS 'Email of management user who rejected the sale';
COMMENT ON COLUMN sales.customer_approved_at IS 'Timestamp when customer approved and confirmed payment commitment';
COMMENT ON COLUMN sales.rejection_reason IS 'Reason for rejection by management or customer';

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_sales_management_approved ON sales(management_approved_at) WHERE management_approved_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_customer_approved ON sales(customer_approved_at) WHERE customer_approved_at IS NOT NULL;

-- Success message with workflow clarification
DO $$
BEGIN
  RAISE NOTICE '
╔════════════════════════════════════════════════════════════════════════════════╗
║                     SALES APPROVAL WORKFLOW FIXED                              ║
╚════════════════════════════════════════════════════════════════════════════════╝

✓ Added management approval tracking columns
✓ Updated transition descriptions for clarity
✓ Added performance indexes

OFFICIAL 7-STEP WORKFLOW:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Step 1: create_sales → pending_approval
        └─ Sales created, awaiting MANAGEMENT review

Step 2a: pending_approval → customer_rejected
         └─ MANAGEMENT rejects sale

Step 3: pending_approval → customer_approved ⭐ MANAGEMENT APPROVAL
        └─ MANAGEMENT approves → Email sent to CUSTOMER

Step 4: customer_approved → waiting_for_payment ⭐ CUSTOMER APPROVAL
        └─ CUSTOMER confirms payment commitment via email link

Step 5: waiting_for_payment → virtual_payment
        └─ System auto-creates virtual payment record

Step 6: waiting_for_payment/virtual_payment → payment_received
        └─ MANAGEMENT confirms actual payment received

Step 7: payment_received → completed
        └─ Sale fully closed

KEY POINTS:
• "customer_approved" = MANAGEMENT approved + customer notified
• Customer then approves for payment (creates payment record)
• Virtual payment tracks expected payment
• Management confirms real payment received
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
END $$;
