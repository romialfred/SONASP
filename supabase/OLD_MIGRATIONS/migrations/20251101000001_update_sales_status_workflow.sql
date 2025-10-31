/*
  # Update Sales Status Workflow to 7-Step Process

  1. New Status Values (Official Workflow)
    - create_sales → pending_approval → customer_approved → waiting_for_payment
    - virtual_payment → payment_received → completed
    - Rejection path: pending_approval → customer_rejected

  2. Changes
    - Drop old status constraint
    - Create new constraint with 7 official statuses
    - Migrate existing status values to new workflow
    - Update indexes

  3. Migration Strategy
    - Safe migration of existing data
    - Maintains backward compatibility where possible
*/

-- First, migrate existing status values to new workflow
DO $$
BEGIN
  -- Update 'pending' to 'create_sales'
  UPDATE sales SET status = 'create_sales' WHERE status = 'pending';

  -- Update 'approved' to 'customer_approved'
  UPDATE sales SET status = 'customer_approved' WHERE status = 'approved';

  -- Update 'rejected' to 'customer_rejected'
  UPDATE sales SET status = 'customer_rejected' WHERE status = 'rejected';

  -- 'customer_approved' stays as is
  -- 'payment_received' stays as is
  -- 'completed' stays as is

  -- Any unknown statuses default to 'create_sales'
  UPDATE sales
  SET status = 'create_sales'
  WHERE status NOT IN (
    'create_sales',
    'pending_approval',
    'customer_rejected',
    'customer_approved',
    'waiting_for_payment',
    'virtual_payment',
    'payment_received',
    'completed'
  );

  RAISE NOTICE 'Migrated existing sales statuses to new workflow';
END $$;

-- Drop the old constraint if it exists
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_status_check;

-- Create new constraint with 7 official statuses
ALTER TABLE sales ADD CONSTRAINT sales_status_check
  CHECK (status IN (
    'create_sales',
    'pending_approval',
    'customer_rejected',
    'customer_approved',
    'waiting_for_payment',
    'virtual_payment',
    'payment_received',
    'completed'
  ));

-- Set default status to 'create_sales' for new records
ALTER TABLE sales ALTER COLUMN status SET DEFAULT 'create_sales';

-- Update the comment with new workflow description
COMMENT ON COLUMN sales.status IS 'Sale status workflow: create_sales → pending_approval → [customer_rejected OR customer_approved] → waiting_for_payment → virtual_payment → payment_received → completed';

-- Create index on status for filtering
DROP INDEX IF EXISTS idx_sales_status;
CREATE INDEX idx_sales_status ON sales(status);

-- Create composite index for status-based queries
CREATE INDEX IF NOT EXISTS idx_sales_status_created ON sales(status, created_at DESC);

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Sales status workflow updated successfully to 7-step process';
END $$;
