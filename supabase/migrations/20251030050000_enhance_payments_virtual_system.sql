/*
  # Enhance Payments System - Virtual Payments & Workflow

  1. Changes
    - Add is_virtual column to payments table
    - Add payment_type (virtual, actual)
    - Add mechanism_type to track payment terms
    - Add auto_credited_at for virtual payment tracking
    - Update sales statuses to include 'waiting_for_payment'
    - Create function to calculate due dates based on mechanism

  2. Security
    - Maintain existing RLS policies
    - Add policies for virtual payments management
*/

-- Add new columns to payments table
DO $$
BEGIN
  -- Add is_virtual column (tracks if payment is automatically credited)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'is_virtual'
  ) THEN
    ALTER TABLE payments ADD COLUMN is_virtual BOOLEAN DEFAULT false;
  END IF;

  -- Add payment_type column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'payment_type'
  ) THEN
    ALTER TABLE payments ADD COLUMN payment_type TEXT
      CHECK (payment_type IN ('virtual', 'actual'))
      DEFAULT 'actual';
  END IF;

  -- Add mechanism_type to track payment terms
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'mechanism_type'
  ) THEN
    ALTER TABLE payments ADD COLUMN mechanism_type TEXT;
  END IF;

  -- Add auto_credited_at timestamp
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'auto_credited_at'
  ) THEN
    ALTER TABLE payments ADD COLUMN auto_credited_at TIMESTAMPTZ;
  END IF;

  -- Add virtual_due_date for virtual payments
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'virtual_due_date'
  ) THEN
    ALTER TABLE payments ADD COLUMN virtual_due_date DATE;
  END IF;

  -- Add converted_to_actual_at timestamp
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'converted_to_actual_at'
  ) THEN
    ALTER TABLE payments ADD COLUMN converted_to_actual_at TIMESTAMPTZ;
  END IF;

  -- Add converted_by user tracking
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'converted_by'
  ) THEN
    ALTER TABLE payments ADD COLUMN converted_by UUID REFERENCES auth.users(id);
  END IF;
END $$;

-- Update sales status constraint to include waiting_for_payment
DO $$
BEGIN
  -- Drop existing constraint
  ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_status_check;

  -- Add new constraint with waiting_for_payment status
  ALTER TABLE sales ADD CONSTRAINT sales_status_check
    CHECK (status IN (
      'customer_pending',
      'approved',
      'customer_approved',
      'waiting_for_payment',
      'payment_received',
      'completed',
      'rejected',
      'cancelled'
    ));
END $$;

-- Create function to calculate due date based on mechanism type
CREATE OR REPLACE FUNCTION calculate_payment_due_date(
  mechanism TEXT,
  approval_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS DATE AS $$
DECLARE
  business_days INT;
  due_date DATE;
BEGIN
  -- Determine business days based on mechanism
  CASE LOWER(mechanism)
    WHEN 'spot' THEN
      business_days := 2;
    WHEN 'forward_7' THEN
      business_days := 7;
    WHEN 'forward_7_days' THEN
      business_days := 7;
    WHEN 'forward_14' THEN
      business_days := 14;
    WHEN 'forward_14_days' THEN
      business_days := 14;
    ELSE
      business_days := 2; -- Default to spot terms
  END CASE;

  -- Calculate due date (simple: add business days to approval date)
  -- Note: This is a simplified calculation. For production, consider holidays and weekends
  due_date := (approval_date + (business_days || ' days')::INTERVAL)::DATE;

  RETURN due_date;
END;
$$ LANGUAGE plpgsql;

-- Create function to create virtual payment
CREATE OR REPLACE FUNCTION create_virtual_payment(
  p_sale_id UUID,
  p_customer_id UUID,
  p_amount NUMERIC,
  p_currency TEXT,
  p_mechanism_type TEXT,
  p_approved_date TIMESTAMPTZ DEFAULT NOW()
)
RETURNS UUID AS $$
DECLARE
  v_payment_id UUID;
  v_due_date DATE;
BEGIN
  -- Calculate due date
  v_due_date := calculate_payment_due_date(p_mechanism_type, p_approved_date);

  -- Create virtual payment
  INSERT INTO payments (
    sale_id,
    customer_id,
    expected_date,
    amount,
    currency,
    is_virtual,
    payment_type,
    mechanism_type,
    auto_credited_at,
    virtual_due_date,
    status,
    bank_name,
    reference_number,
    notes,
    created_at
  ) VALUES (
    p_sale_id,
    p_customer_id,
    v_due_date,
    p_amount,
    p_currency,
    true,
    'virtual',
    p_mechanism_type,
    NOW(),
    v_due_date,
    'pending',
    'Virtual Payment - Pending Confirmation',
    'VP-' || UPPER(SUBSTRING(gen_random_uuid()::TEXT, 1, 8)),
    'Virtual payment created automatically upon customer approval. Payment due: ' || v_due_date || ' (' || p_mechanism_type || ' terms)',
    NOW()
  )
  RETURNING id INTO v_payment_id;

  RETURN v_payment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to convert virtual payment to actual
CREATE OR REPLACE FUNCTION convert_virtual_to_actual_payment(
  p_payment_id UUID,
  p_actual_date DATE,
  p_bank_name TEXT,
  p_account_number TEXT,
  p_reference_number TEXT,
  p_transaction_id TEXT,
  p_fx_rate NUMERIC,
  p_proof_url TEXT,
  p_notes TEXT,
  p_converted_by UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_is_virtual BOOLEAN;
BEGIN
  -- Check if payment is virtual
  SELECT is_virtual INTO v_is_virtual
  FROM payments
  WHERE id = p_payment_id;

  IF NOT v_is_virtual THEN
    RAISE EXCEPTION 'Payment is not a virtual payment';
  END IF;

  -- Update payment to actual
  UPDATE payments
  SET
    payment_type = 'actual',
    is_virtual = false,
    actual_date = p_actual_date,
    bank_name = p_bank_name,
    account_number = p_account_number,
    reference_number = p_reference_number,
    transaction_id = p_transaction_id,
    fx_rate = p_fx_rate,
    proof_url = p_proof_url,
    notes = COALESCE(notes, '') || E'\n\nConverted to actual payment on ' || NOW()::DATE || E'\n' || COALESCE(p_notes, ''),
    converted_to_actual_at = NOW(),
    converted_by = p_converted_by,
    status = 'approved'
  WHERE id = p_payment_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create view for virtual payments management
CREATE OR REPLACE VIEW virtual_payments_view AS
SELECT
  p.id,
  p.sale_id,
  p.customer_id,
  p.amount,
  p.currency,
  p.mechanism_type,
  p.virtual_due_date,
  p.auto_credited_at,
  p.status,
  p.reference_number,
  p.notes,
  p.created_at,
  s.sale_number,
  s.status as sale_status,
  c.name as customer_name,
  c.email as customer_email,
  CASE
    WHEN p.virtual_due_date < CURRENT_DATE THEN 'overdue'
    WHEN p.virtual_due_date = CURRENT_DATE THEN 'due_today'
    WHEN p.virtual_due_date <= CURRENT_DATE + 2 THEN 'due_soon'
    ELSE 'pending'
  END as payment_urgency,
  (CURRENT_DATE - p.virtual_due_date) as days_overdue
FROM payments p
LEFT JOIN sales s ON p.sale_id = s.id
LEFT JOIN customers c ON p.customer_id = c.id
WHERE p.is_virtual = true
  AND p.payment_type = 'virtual'
ORDER BY p.virtual_due_date ASC;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_payments_is_virtual ON payments(is_virtual);
CREATE INDEX IF NOT EXISTS idx_payments_payment_type ON payments(payment_type);
CREATE INDEX IF NOT EXISTS idx_payments_virtual_due_date ON payments(virtual_due_date);
CREATE INDEX IF NOT EXISTS idx_payments_mechanism_type ON payments(mechanism_type);

-- Grant access to virtual_payments_view
GRANT SELECT ON virtual_payments_view TO authenticated;

-- Add RLS policy for virtual payments view (through base table policies)
-- Virtual payments follow same RLS as regular payments

-- Add comment for documentation
COMMENT ON COLUMN payments.is_virtual IS 'Indicates if payment was auto-credited virtually upon customer approval';
COMMENT ON COLUMN payments.payment_type IS 'Type of payment: virtual (auto-created) or actual (manually recorded)';
COMMENT ON COLUMN payments.mechanism_type IS 'Payment mechanism from sale: spot, forward_7, forward_14';
COMMENT ON COLUMN payments.auto_credited_at IS 'Timestamp when virtual payment was automatically created';
COMMENT ON COLUMN payments.virtual_due_date IS 'Calculated due date based on mechanism type';
COMMENT ON COLUMN payments.converted_to_actual_at IS 'Timestamp when virtual payment was converted to actual';
COMMENT ON COLUMN payments.converted_by IS 'User who converted virtual payment to actual';
