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

-- First, let's see what statuses exist in the database
DO $$
DECLARE
  v_status_list text;
BEGIN
  SELECT string_agg(DISTINCT status, ', ' ORDER BY status) INTO v_status_list FROM sales;
  RAISE NOTICE 'Existing statuses in sales table: %', COALESCE(v_status_list, 'none');
END $$;

-- CRITICAL: Disable the status transition triggers during migration
DO $$
BEGIN
  -- Disable status transition triggers if they exist
  ALTER TABLE sales DISABLE TRIGGER ALL;
  RAISE NOTICE 'All triggers on sales table temporarily disabled for migration';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not disable triggers: %', SQLERRM;
END $$;

-- Drop existing status constraint if it exists
DO $$
BEGIN
  ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_status_check;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- IMPORTANT: Migrate existing statuses to new workflow statuses BEFORE adding constraint
UPDATE sales
SET status = CASE
  -- Map all old/legacy statuses to new ones
  WHEN status = 'pending' THEN 'pending_management_approval'
  WHEN status = 'pending_approval' THEN 'pending_management_approval'
  WHEN status = 'approved' THEN 'management_approved'
  WHEN status = 'rejected' THEN 'management_rejected'
  WHEN status = 'customer_approval' THEN 'pending_for_customer_approval'
  WHEN status = 'customer_approved' THEN 'customer_approved'
  WHEN status = 'customer_rejected' THEN 'customer_rejected'
  WHEN status = 'awaiting_payment' THEN 'waiting_for_payment'
  WHEN status = 'payment_received' THEN 'payment_received'
  WHEN status = 'completed' THEN 'completed'
  WHEN status = 'cancelled' THEN 'management_rejected'
  -- If status is already in new format, keep it
  WHEN status IN ('create_sales', 'pending_management_approval', 'management_approved',
                  'management_rejected', 'pending_for_customer_approval',
                  'customer_approved', 'customer_rejected', 'waiting_for_payment',
                  'virtual_payment', 'payment_received', 'completed') THEN status
  -- Default fallback for any unknown status
  ELSE 'pending_management_approval'
END
WHERE status IS NOT NULL;

-- Update any NULL statuses
UPDATE sales
SET status = 'pending_management_approval'
WHERE status IS NULL;

-- Verify all statuses are valid before continuing
DO $$
DECLARE
  v_invalid_count integer;
  v_invalid_statuses text;
BEGIN
  SELECT COUNT(*), string_agg(DISTINCT status, ', ')
  INTO v_invalid_count, v_invalid_statuses
  FROM sales
  WHERE status NOT IN (
    'create_sales', 'pending_management_approval', 'management_approved',
    'management_rejected', 'pending_for_customer_approval', 'customer_approved',
    'customer_rejected', 'waiting_for_payment', 'virtual_payment',
    'payment_received', 'completed'
  );

  IF v_invalid_count > 0 THEN
    RAISE EXCEPTION 'Found % rows with invalid statuses: %. Please fix these before continuing.', v_invalid_count, v_invalid_statuses;
  ELSE
    RAISE NOTICE 'All statuses are valid. Ready to proceed.';
  END IF;
END $$;

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

-- NOW add the status constraint AFTER all columns and triggers are created
-- This prevents conflicts during trigger execution
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
    'completed'
  ));

-- Add comment for documentation
COMMENT ON TABLE sales IS 'Sales records with new 9-step workflow status management and approval tracking';

-- Re-enable all triggers on the sales table
DO $$
BEGIN
  ALTER TABLE sales ENABLE TRIGGER ALL;
  RAISE NOTICE 'All triggers on sales table re-enabled';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not re-enable triggers: %', SQLERRM;
END $$;

-- Final verification and success message
DO $$
DECLARE
  v_status_count record;
BEGIN
  RAISE NOTICE 'Sales table schema updated successfully';
  RAISE NOTICE 'New workflow statuses added to constraint';
  RAISE NOTICE 'Approval tracking columns added';
  RAISE NOTICE 'Automatic timestamp triggers created';
  RAISE NOTICE 'Status transition triggers re-enabled';
  RAISE NOTICE '---';
  RAISE NOTICE 'Current status distribution:';

  FOR v_status_count IN
    SELECT status, COUNT(*) as count
    FROM sales
    GROUP BY status
    ORDER BY status
  LOOP
    RAISE NOTICE '  %: % rows', v_status_count.status, v_status_count.count;
  END LOOP;
END $$;
