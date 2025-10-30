/*
  # Fix Sales Approval Workflow

  ## Changes
  1. Update sales status constraint to include new workflow statuses
  2. Ensure virtual payment columns exist in payments table
  3. Add mechanism_type column to sales table if missing
  
  ## Status Flow
  - pending_approval → approved → customer_approved → waiting_for_payment → payment_received → completed
  - Alternative: → customer_rejected (dead end)
  - Alternative: → rejected (dead end)
  - Alternative: → cancelled (dead end)
  
  ## Details
  This migration fixes the customer approval workflow by:
  - Adding missing status values to sales table constraint
  - Ensuring virtual payment tracking columns exist
  - Adding mechanism_type to sales for payment terms tracking
*/

-- ============================================
-- 1. Fix sales table status constraint
-- ============================================

-- Drop existing constraint if it exists
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_status_check;

-- Add comprehensive status constraint
ALTER TABLE sales ADD CONSTRAINT sales_status_check 
CHECK (status IN (
  'pending_approval',
  'approved',
  'customer_approved',
  'customer_rejected',
  'waiting_for_payment',
  'payment_received',
  'completed',
  'rejected',
  'cancelled'
));

-- Update any existing sales with invalid status to pending_approval
UPDATE sales 
SET status = 'pending_approval' 
WHERE status NOT IN (
  'pending_approval',
  'approved',
  'customer_approved',
  'customer_rejected',
  'waiting_for_payment',
  'payment_received',
  'completed',
  'rejected',
  'cancelled'
);

-- ============================================
-- 2. Add mechanism_type to sales if missing
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'mechanism_type'
  ) THEN
    ALTER TABLE sales ADD COLUMN mechanism_type text DEFAULT 'spot';
    COMMENT ON COLUMN sales.mechanism_type IS 'Payment mechanism: spot, forward_7, forward_14';
  END IF;
END $$;

-- ============================================
-- 3. Ensure customer_approval_date column exists
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sales' AND column_name = 'customer_approval_date'
  ) THEN
    ALTER TABLE sales ADD COLUMN customer_approval_date timestamptz;
    COMMENT ON COLUMN sales.customer_approval_date IS 'Timestamp when customer approved the sale';
  END IF;
END $$;

-- ============================================
-- 4. Add virtual payment columns to payments table
-- ============================================

-- Add is_virtual column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'is_virtual'
  ) THEN
    ALTER TABLE payments ADD COLUMN is_virtual boolean DEFAULT false;
    COMMENT ON COLUMN payments.is_virtual IS 'True if this is a virtual payment (not yet received)';
  END IF;
END $$;

-- Add payment_type column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'payment_type'
  ) THEN
    ALTER TABLE payments ADD COLUMN payment_type text;
    COMMENT ON COLUMN payments.payment_type IS 'Type of payment: virtual, wire_transfer, cash, etc.';
  END IF;
END $$;

-- Add mechanism_type column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'mechanism_type'
  ) THEN
    ALTER TABLE payments ADD COLUMN mechanism_type text;
    COMMENT ON COLUMN payments.mechanism_type IS 'Payment mechanism: spot, forward_7, forward_14';
  END IF;
END $$;

-- Add auto_credited_at column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'auto_credited_at'
  ) THEN
    ALTER TABLE payments ADD COLUMN auto_credited_at timestamptz;
    COMMENT ON COLUMN payments.auto_credited_at IS 'Timestamp when virtual payment was auto-created';
  END IF;
END $$;

-- Add virtual_due_date column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'virtual_due_date'
  ) THEN
    ALTER TABLE payments ADD COLUMN virtual_due_date date;
    COMMENT ON COLUMN payments.virtual_due_date IS 'Due date for virtual payment';
  END IF;
END $$;

-- ============================================
-- 5. Create indexes for performance
-- ============================================

-- Index for virtual payments lookup
CREATE INDEX IF NOT EXISTS idx_payments_is_virtual 
ON payments(is_virtual) 
WHERE is_virtual = true;

-- Index for virtual payments due date tracking
CREATE INDEX IF NOT EXISTS idx_payments_virtual_due_date 
ON payments(virtual_due_date) 
WHERE virtual_due_date IS NOT NULL;

-- Index for sales status lookups
CREATE INDEX IF NOT EXISTS idx_sales_status 
ON sales(status);

-- Index for sales waiting for payment
CREATE INDEX IF NOT EXISTS idx_sales_waiting_payment 
ON sales(status) 
WHERE status = 'waiting_for_payment';

-- ============================================
-- 6. Create audit_trail table if missing
-- ============================================

CREATE TABLE IF NOT EXISTS audit_trail (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  table_name text NOT NULL,
  record_id text NOT NULL,
  details jsonb,
  user_email text,
  created_at timestamptz DEFAULT now()
);

-- Create index for audit trail lookups
CREATE INDEX IF NOT EXISTS idx_audit_trail_record 
ON audit_trail(table_name, record_id);

CREATE INDEX IF NOT EXISTS idx_audit_trail_created 
ON audit_trail(created_at DESC);

-- Enable RLS on audit_trail
ALTER TABLE audit_trail ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist, then recreate
DROP POLICY IF EXISTS "Allow authenticated users to insert audit logs" ON audit_trail;
DROP POLICY IF EXISTS "Allow authenticated users to view audit logs" ON audit_trail;

-- Policy to allow authenticated users to insert audit logs
CREATE POLICY "Allow authenticated users to insert audit logs"
  ON audit_trail FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy to allow authenticated users to view audit logs
CREATE POLICY "Allow authenticated users to view audit logs"
  ON audit_trail FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- 7. Add trigger to auto-update customer_approval_date
-- ============================================

CREATE OR REPLACE FUNCTION update_customer_approval_date()
RETURNS TRIGGER AS $$
BEGIN
  -- When status changes to customer_approved or waiting_for_payment
  IF NEW.status IN ('customer_approved', 'waiting_for_payment') 
     AND OLD.status NOT IN ('customer_approved', 'waiting_for_payment')
     AND NEW.customer_approval_date IS NULL THEN
    NEW.customer_approval_date = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_customer_approval_date ON sales;

CREATE TRIGGER trigger_update_customer_approval_date
  BEFORE UPDATE ON sales
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_approval_date();

-- ============================================
-- 8. Verification queries
-- ============================================

-- Show updated status constraint
SELECT
  con.conname as constraint_name,
  pg_get_constraintdef(con.oid) as constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'sales'
  AND con.contype = 'c'
  AND con.conname LIKE '%status%';

-- Show virtual payment columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'payments'
AND column_name IN ('is_virtual', 'payment_type', 'mechanism_type', 'auto_credited_at', 'virtual_due_date')
ORDER BY ordinal_position;

-- Show current sales statuses distribution
SELECT status, COUNT(*) as count
FROM sales
GROUP BY status
ORDER BY count DESC;
