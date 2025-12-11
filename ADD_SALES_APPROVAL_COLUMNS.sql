/*
  # Add Sales Approval Workflow Columns

  This migration adds columns to track the approval workflow:
  - Management approval fields
  - Customer approval fields
  - Payment fields
  - Completion fields
*/

-- Management approval fields
ALTER TABLE sales ADD COLUMN IF NOT EXISTS management_approved_by uuid REFERENCES auth.users(id);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS management_approved_at timestamptz;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS management_approval_notes text;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS management_rejected_by uuid REFERENCES auth.users(id);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS management_rejected_at timestamptz;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS management_rejection_notes text;

-- Customer approval fields
ALTER TABLE sales ADD COLUMN IF NOT EXISTS customer_approved_by uuid REFERENCES auth.users(id);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS customer_approved_at timestamptz;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS customer_approval_notes text;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS customer_rejected_by uuid REFERENCES auth.users(id);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS customer_rejected_at timestamptz;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS customer_rejection_notes text;

-- Payment fields
ALTER TABLE sales ADD COLUMN IF NOT EXISTS payment_amount numeric(15,2);
ALTER TABLE sales ADD COLUMN IF NOT EXISTS payment_date date;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS payment_method text;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS payment_proof_url text;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS payment_notes text;
ALTER TABLE sales ADD COLUMN IF NOT EXISTS payment_received_at timestamptz;

-- Completion field
ALTER TABLE sales ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_sales_management_approved_by ON sales(management_approved_by);
CREATE INDEX IF NOT EXISTS idx_sales_customer_approved_by ON sales(customer_approved_by);
CREATE INDEX IF NOT EXISTS idx_sales_payment_date ON sales(payment_date);

-- Add comment for documentation
COMMENT ON COLUMN sales.management_approved_by IS 'User who approved the sale (management level)';
COMMENT ON COLUMN sales.customer_approved_by IS 'User who approved the sale (customer level)';
COMMENT ON COLUMN sales.payment_amount IS 'Amount paid by customer';
COMMENT ON COLUMN sales.completed_at IS 'Timestamp when sale was completed';
