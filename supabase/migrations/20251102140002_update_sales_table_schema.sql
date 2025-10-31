/*
  # Update Sales Table Schema for New Workflow

  1. Purpose
    - Update status constraint to include new workflow statuses
    - Add timestamp columns for approval tracking
    - Add columns for approval user tracking

  2. New Columns
    - management_approved_at (timestamptz)
    - management_approved_by (uuid)
    - customer_approved_at (timestamptz)
    - customer_approved_by (uuid)

  3. Updated Constraints
    - Status constraint with all new status values

  4. Security
    - Uses existing RLS policies
    - No new policies needed
*/

-- Drop existing status constraint if it exists
DO $$
BEGIN
  ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_status_check;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Add new status constraint with all workflow statuses
ALTER TABLE sales ADD CONSTRAINT sales_status_check
  CHECK (status IN (
    'create_sales',
    'pending_management_approval',
    'management_approved',
    'management_rejected',
    'pending_for_customer_approval',
    'customer_approved',
    'customer_rejected',
    'waiting_for_payment',
    'virtual_payment',
    'payment_received',
    'completed',
    -- Legacy statuses for backward compatibility during transition
    'pending',
    'approved',
    'rejected'
  ));

-- Add management approval tracking columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'management_approved_at'
  ) THEN
    ALTER TABLE sales ADD COLUMN management_approved_at timestamptz;
    COMMENT ON COLUMN sales.management_approved_at IS 'Timestamp when management approved the sale';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'management_approved_by'
  ) THEN
    ALTER TABLE sales ADD COLUMN management_approved_by uuid REFERENCES auth.users(id);
    COMMENT ON COLUMN sales.management_approved_by IS 'User ID of management who approved the sale';
  END IF;
END $$;

-- Add customer approval tracking columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'customer_approved_at'
  ) THEN
    ALTER TABLE sales ADD COLUMN customer_approved_at timestamptz;
    COMMENT ON COLUMN sales.customer_approved_at IS 'Timestamp when customer approved the sale';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'customer_approved_by'
  ) THEN
    ALTER TABLE sales ADD COLUMN customer_approved_by uuid REFERENCES auth.users(id);
    COMMENT ON COLUMN sales.customer_approved_by IS 'User ID of customer who approved the sale';
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_sales_management_approved ON sales(management_approved_at) WHERE management_approved_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_customer_approved ON sales(customer_approved_at) WHERE customer_approved_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sales_status_updated ON sales(status, updated_at);

-- Create function to auto-update approval timestamps
CREATE OR REPLACE FUNCTION update_sales_approval_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  -- Set management approval timestamp when status changes to management_approved
  IF NEW.status = 'management_approved' AND OLD.status != 'management_approved' THEN
    NEW.management_approved_at = now();
    IF NEW.management_approved_by IS NULL THEN
      NEW.management_approved_by = auth.uid();
    END IF;
  END IF;

  -- Set customer approval timestamp when status changes to customer_approved
  IF NEW.status = 'customer_approved' AND OLD.status != 'customer_approved' THEN
    NEW.customer_approved_at = now();
    IF NEW.customer_approved_by IS NULL THEN
      NEW.customer_approved_by = auth.uid();
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for approval timestamps
DROP TRIGGER IF EXISTS trigger_update_sales_approval_timestamps ON sales;
CREATE TRIGGER trigger_update_sales_approval_timestamps
  BEFORE UPDATE ON sales
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION update_sales_approval_timestamps();

-- Update any existing sales with old statuses to new workflow
-- Note: This is done safely with a mapping of old to new statuses
UPDATE sales
SET status = CASE
  WHEN status = 'pending' THEN 'pending_management_approval'
  WHEN status = 'approved' THEN 'management_approved'
  WHEN status = 'rejected' THEN 'management_rejected'
  ELSE status
END
WHERE status IN ('pending', 'approved', 'rejected');

-- Add comment for documentation
COMMENT ON TABLE sales IS 'Sales records with new 9-step workflow status management and approval tracking';

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Sales table schema updated successfully';
  RAISE NOTICE 'New workflow statuses added to constraint';
  RAISE NOTICE 'Approval tracking columns added';
  RAISE NOTICE 'Automatic timestamp triggers created';
END $$;
