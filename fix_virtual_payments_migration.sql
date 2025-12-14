/*
  # Fix Virtual Payments Migration
  
  This script fixes the NOT NULL constraint issue on the payments table
  and sets up the virtual payments system properly.
*/

-- =====================================================
-- STEP 1: Fix existing payments table structure
-- =====================================================

-- Make bank_name nullable (virtual payments don't have bank details yet)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payments' 
    AND column_name = 'bank_name'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE payments ALTER COLUMN bank_name DROP NOT NULL;
    RAISE NOTICE 'Removed NOT NULL constraint from payments.bank_name';
  END IF;
END $$;

-- Make other optional columns nullable if needed
DO $$
BEGIN
  -- payment_reference can be null for virtual payments
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payments' 
    AND column_name = 'payment_reference'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE payments ALTER COLUMN payment_reference DROP NOT NULL;
    RAISE NOTICE 'Removed NOT NULL constraint from payments.payment_reference';
  END IF;

  -- payment_method can be null for virtual payments
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payments' 
    AND column_name = 'payment_method'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE payments ALTER COLUMN payment_method DROP NOT NULL;
    RAISE NOTICE 'Removed NOT NULL constraint from payments.payment_method';
  END IF;

  -- actual_date can be null for pending payments
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'payments' 
    AND column_name = 'actual_date'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE payments ALTER COLUMN actual_date DROP NOT NULL;
    RAISE NOTICE 'Removed NOT NULL constraint from payments.actual_date';
  END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_payments_sale_id ON payments(sale_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_expected_date ON payments(expected_date);

RAISE NOTICE 'Table structure updated successfully';

-- =====================================================
-- STEP 2: Enable RLS on payments table
-- =====================================================

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Allow authenticated users to view all payments" ON payments;
DROP POLICY IF EXISTS "Allow authenticated users to create payments" ON payments;
DROP POLICY IF EXISTS "Allow authenticated users to update payments" ON payments;
DROP POLICY IF EXISTS "Allow authenticated users to delete payments" ON payments;

-- Create RLS policies
CREATE POLICY "Allow authenticated users to view all payments"
  ON payments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to create payments"
  ON payments FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update payments"
  ON payments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete payments"
  ON payments FOR DELETE TO authenticated USING (true);

RAISE NOTICE 'RLS policies configured';

-- =====================================================
-- STEP 3: Create function to calculate expected date
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_payment_expected_date(
  p_mechanism_type TEXT,
  p_approval_date DATE DEFAULT CURRENT_DATE
)
RETURNS DATE
LANGUAGE plpgsql
AS $$
BEGIN
  -- Calculate expected payment date based on mechanism type
  CASE p_mechanism_type
    WHEN 'spot' THEN
      RETURN p_approval_date;
    WHEN 'forward_7', 'forward_7_days' THEN
      RETURN p_approval_date + INTERVAL '7 days';
    WHEN 'forward_14', 'forward_14_days' THEN
      RETURN p_approval_date + INTERVAL '14 days';
    ELSE
      RETURN p_approval_date + INTERVAL '2 days';
  END CASE;
END;
$$;

RAISE NOTICE 'Function calculate_payment_expected_date() created';

-- =====================================================
-- STEP 4: Create trigger function for automatic payment creation
-- =====================================================

CREATE OR REPLACE FUNCTION create_virtual_payment_on_customer_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_expected_date DATE;
  v_invoice_number TEXT;
  v_payment_exists BOOLEAN;
BEGIN
  -- Only proceed if status changed to customer_approved or waiting_for_payment
  IF NEW.status IN ('customer_approved', 'waiting_for_payment') AND
     (OLD.status IS NULL OR OLD.status NOT IN ('customer_approved', 'waiting_for_payment')) THEN

    -- Check if payment already exists for this sale
    SELECT EXISTS(
      SELECT 1 FROM payments WHERE sale_id = NEW.id
    ) INTO v_payment_exists;

    -- Only create if payment doesn't exist
    IF NOT v_payment_exists THEN
      -- Calculate expected date based on mechanism type
      v_expected_date := calculate_payment_expected_date(NEW.mechanism_type, CURRENT_DATE);

      -- Generate invoice number
      v_invoice_number := 'INV-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || UPPER(SUBSTRING(NEW.id::TEXT, 1, 8));

      -- Create virtual payment record (with NULL for optional fields)
      INSERT INTO payments (
        sale_id,
        customer_id,
        invoice_number,
        expected_date,
        due_date,
        amount,
        currency,
        status,
        created_by,
        created_at,
        bank_name,
        payment_reference,
        payment_method,
        actual_date
      ) VALUES (
        NEW.id,
        NEW.customer_id,
        v_invoice_number,
        v_expected_date,
        v_expected_date + INTERVAL '30 days',
        NEW.final_proceeds,
        COALESCE(NEW.currency, 'USD'),
        'pending',
        NEW.created_by,
        NOW(),
        NULL,  -- Will be filled when actual payment is received
        NULL,  -- Will be filled when actual payment is received
        NULL,  -- Will be filled when actual payment is received
        NULL   -- Will be filled when actual payment is received
      );

      RAISE NOTICE 'Virtual payment created for sale %', NEW.sale_number;
    ELSE
      RAISE NOTICE 'Payment already exists for sale %', NEW.sale_number;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

RAISE NOTICE 'Function create_virtual_payment_on_customer_approval() created';

-- =====================================================
-- STEP 5: Create trigger on sales table
-- =====================================================

DROP TRIGGER IF EXISTS trigger_create_virtual_payment ON sales;

CREATE TRIGGER trigger_create_virtual_payment
  AFTER INSERT OR UPDATE OF status
  ON sales
  FOR EACH ROW
  EXECUTE FUNCTION create_virtual_payment_on_customer_approval();

RAISE NOTICE 'Trigger created on sales table';

-- =====================================================
-- STEP 6: Backfill existing customer_approved sales
-- =====================================================

DO $$
DECLARE
  v_sale RECORD;
  v_expected_date DATE;
  v_invoice_number TEXT;
  v_created_count INTEGER := 0;
BEGIN
  RAISE NOTICE 'Backfilling virtual payments for existing customer_approved sales...';

  FOR v_sale IN
    SELECT s.*
    FROM sales s
    LEFT JOIN payments p ON p.sale_id = s.id
    WHERE s.status IN ('customer_approved', 'waiting_for_payment')
      AND p.id IS NULL
  LOOP
    -- Calculate expected date
    v_expected_date := calculate_payment_expected_date(v_sale.mechanism_type, CURRENT_DATE);

    -- Generate invoice number
    v_invoice_number := 'INV-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || UPPER(SUBSTRING(v_sale.id::TEXT, 1, 8));

    -- Create payment with NULL for optional fields
    INSERT INTO payments (
      sale_id,
      customer_id,
      invoice_number,
      expected_date,
      due_date,
      amount,
      currency,
      status,
      created_by,
      created_at,
      bank_name,
      payment_reference,
      payment_method,
      actual_date
    ) VALUES (
      v_sale.id,
      v_sale.customer_id,
      v_invoice_number,
      v_expected_date,
      v_expected_date + INTERVAL '30 days',
      v_sale.final_proceeds,
      COALESCE(v_sale.currency, 'USD'),
      'pending',
      v_sale.created_by,
      NOW(),
      NULL,
      NULL,
      NULL,
      NULL
    );

    v_created_count := v_created_count + 1;
    RAISE NOTICE 'Created payment for sale: %', v_sale.sale_number;
  END LOOP;

  RAISE NOTICE 'Backfill complete: % virtual payments created', v_created_count;
END $$;

-- =====================================================
-- STEP 7: Verify setup
-- =====================================================

DO $$
DECLARE
  v_payments_count INTEGER;
  v_sales_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_payments_count FROM payments;
  SELECT COUNT(*) INTO v_sales_count FROM sales WHERE status IN ('customer_approved', 'waiting_for_payment');

  RAISE NOTICE '';
  RAISE NOTICE '=== Virtual Payments System Setup Complete ===';
  RAISE NOTICE 'Total payments in system: %', v_payments_count;
  RAISE NOTICE 'Total sales awaiting payment: %', v_sales_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Trigger: trigger_create_virtual_payment ON sales';
  RAISE NOTICE 'Function: create_virtual_payment_on_customer_approval()';
  RAISE NOTICE 'Helper: calculate_payment_expected_date()';
  RAISE NOTICE '';
  RAISE NOTICE '✅ System ready: New customer-approved sales will automatically create payment records';
END $$;
