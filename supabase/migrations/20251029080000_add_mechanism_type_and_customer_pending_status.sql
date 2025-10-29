/*
  # Add mechanism_type and customer_pending status to sales table

  1. Changes
    - Add `mechanism_type` column to sales table to track pricing mechanism used
    - Update status CHECK constraint to include 'customer_pending' status
    - Add index on mechanism_type for performance

  2. Description
    - mechanism_type: Optional text field to store the pricing mechanism (spot, forward_7, forward_14)
    - customer_pending: New status for sales submitted directly to customer for approval
*/

-- Add mechanism_type column to sales table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'mechanism_type'
  ) THEN
    ALTER TABLE sales ADD COLUMN mechanism_type text;

    -- Add comment for documentation
    COMMENT ON COLUMN sales.mechanism_type IS 'Pricing mechanism used: spot, forward_7, forward_14, etc.';

    -- Add index for filtering by mechanism type
    CREATE INDEX IF NOT EXISTS idx_sales_mechanism_type ON sales(mechanism_type);
  END IF;
END $$;

-- Update status constraint to include customer_pending
DO $$
BEGIN
  -- Drop the existing constraint
  ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_status_check;

  -- Add the new constraint with customer_pending
  ALTER TABLE sales ADD CONSTRAINT sales_status_check
    CHECK (status IN (
      'pending',
      'customer_pending',
      'approved',
      'customer_approved',
      'payment_received',
      'completed',
      'rejected'
    ));
END $$;

-- Add comment for the new status
COMMENT ON COLUMN sales.status IS 'Sale status: pending (awaiting management), customer_pending (sent to customer), approved (management approved), customer_approved (customer confirmed), payment_received, completed, rejected';
