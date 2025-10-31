/*
  # Update Sales Table Schema for New Workflow

  1. Purpose
    - Update status constraint to include new workflow statuses
    - Add seller tracking columns
    - Add timestamp columns for approval tracking
    - Add columns for approval user tracking

  2. New Columns
    - seller_id (uuid) - ID of the seller (mining company or Mansa)
    - seller_type (text) - Type of seller: 'mining_company' or 'mansa'
    - is_internal_sale (boolean) - TRUE for internal sales (mining co to Mansa)
    - management_approved_at (timestamptz)
    - management_approved_by (uuid)
    - customer_approved_at (timestamptz)
    - customer_approved_by (uuid)

  3. Updated Constraints
    - Status constraint with all new status values
    - Seller type constraint

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

-- CRITICAL: Drop the status transition triggers temporarily during migration
DROP TRIGGER IF EXISTS trigger_validate_sales_status_transition ON sales;
DROP TRIGGER IF EXISTS check_sales_status_transition_trigger ON sales;

DO $$
BEGIN
  RAISE NOTICE 'Status transition triggers temporarily removed for migration';
END $$;

-- First, list all existing constraints on sales table
DO $$
DECLARE
  v_constraint record;
BEGIN
  RAISE NOTICE '--- Existing constraints on sales table ---';
  FOR v_constraint IN
    SELECT conname, pg_get_constraintdef(oid) as definition
    FROM pg_constraint
    WHERE conrelid = 'sales'::regclass
      AND conname LIKE '%status%'
  LOOP
    RAISE NOTICE 'Constraint: % - Definition: %', v_constraint.conname, v_constraint.definition;
  END LOOP;
END $$;

-- Drop ALL existing status constraints
DO $$
DECLARE
  v_constraint_name text;
BEGIN
  -- Find and drop all status-related check constraints dynamically
  FOR v_constraint_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'sales'::regclass
      AND contype = 'c'
      AND conname LIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE sales DROP CONSTRAINT IF EXISTS %I', v_constraint_name);
    RAISE NOTICE 'Dropped constraint: %', v_constraint_name;
  END LOOP;

  RAISE NOTICE 'All status constraints dropped';
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

-- Add seller tracking columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'seller_id'
  ) THEN
    ALTER TABLE sales ADD COLUMN seller_id uuid;
    COMMENT ON COLUMN sales.seller_id IS 'ID of the seller (mining company or Mansa Ressources)';
    RAISE NOTICE 'Added column: seller_id';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'seller_type'
  ) THEN
    ALTER TABLE sales ADD COLUMN seller_type text CHECK (seller_type IN ('mining_company', 'mansa'));
    COMMENT ON COLUMN sales.seller_type IS 'Type of seller: mining_company or mansa';
    RAISE NOTICE 'Added column: seller_type';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'is_internal_sale'
  ) THEN
    ALTER TABLE sales ADD COLUMN is_internal_sale boolean DEFAULT false;
    COMMENT ON COLUMN sales.is_internal_sale IS 'TRUE when mining company sells to Mansa (internal), FALSE for external sales';
    RAISE NOTICE 'Added column: is_internal_sale';
  END IF;
END $$;

-- Set default values for existing records (assume all are Mansa external sales)
UPDATE sales
SET
  seller_type = 'mansa',
  is_internal_sale = false
WHERE seller_type IS NULL;

-- Create indexes for seller columns
CREATE INDEX IF NOT EXISTS idx_sales_seller_id ON sales(seller_id);
CREATE INDEX IF NOT EXISTS idx_sales_seller_type ON sales(seller_type);
CREATE INDEX IF NOT EXISTS idx_sales_is_internal ON sales(is_internal_sale);
CREATE INDEX IF NOT EXISTS idx_sales_seller_composite ON sales(seller_id, seller_type, is_internal_sale);

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

-- Note: Status transition triggers will be recreated in migration 20251102140006_create_status_transition_triggers.sql
DO $$
BEGIN
  RAISE NOTICE 'Status transition triggers will be recreated in the next migration';
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
  RAISE NOTICE 'Status transition triggers removed (will be recreated in next migration)';
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
